from decimal import Decimal
from app.shared.money import redondear_monto
from fastapi import HTTPException
from app.modules.authz.service import exigir_permiso_revertir_pago
from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)
from .repository import (
    get_pago_by_id_for_update,
    get_reversion_by_pago_original,
    get_venta_for_update,
    get_pagos,
    insert_pago,
    insert_pago_reversion_relacion,
    obtener_pagos_por_venta,
    update_pago_estado,
    update_venta_saldo_y_estado,
)

from app.shared.constants import (
    MEDIOS_PAGO_VALIDOS,
    ORIGENES_PAGO_VALIDOS,
    ORIGEN_VENTA,
    VENTA_ESTADO_CREADA,
    VENTA_ESTADO_ANULADA,
    VENTA_ESTADO_ENTREGADA,
    VENTA_ESTADO_PAGADA_TOTAL,
    VENTA_ESTADO_PAGADA_PARCIAL,
    PAGO_ESTADO_REVERTIDO,
    AUDITORIA_ENTIDAD_PAGO,
    AUDITORIA_ACCION_PAGO_REGISTRADO,
    AUDITORIA_ACCION_PAGO_REVERTIDO,
    CAJA_MOVIMIENTO_INGRESO,
    CAJA_MOVIMIENTO_EGRESO,
    CAJA_ORIGEN_PAGO,
)

def _obtener_caja_abierta_obligatoria(conn, id_sucursal: int):
    caja = get_caja_abierta_hoy_by_sucursal_for_update(conn, id_sucursal)

    if caja is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No hay caja abierta para la sucursal {id_sucursal}. "
                "Abrí caja antes de registrar pagos"
            ),
        )

    return caja


def registrar_pago(conn, data: dict):
    """
    Función transaccional reutilizable.
    NO abre conexión.
    NO hace commit.
    Debe ejecutarse dentro de una transacción externa.

    data esperado:
    {
        "id_sucursal": int,  # obligatorio para reserva / otros, no para venta
        "id_cliente": int | None,
        "origen_tipo": "venta" | "reserva" | "orden_taller" | "deuda_cliente",
        "origen_id": int,
        "medio_pago": str,
        "monto": Decimal,
        "nota": str | None,
        "id_usuario": int
    }
    """
    
    medio_pago = data["medio_pago"]
    origen_tipo = data["origen_tipo"]

    if not isinstance(data["monto"], Decimal):
        raise ValueError("monto debe ser Decimal")

    monto = redondear_monto(data["monto"])

    if medio_pago not in MEDIOS_PAGO_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Medio de pago inválido: {medio_pago}",
        )

    if origen_tipo not in ORIGENES_PAGO_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Origen de pago inválido: {origen_tipo}",
        )

    if monto <= 0:
        raise HTTPException(
            status_code=400,
            detail="El monto del pago debe ser mayor a 0",
        )

    # =====================================================
    # CASO 1: PAGO DE VENTA
    # =====================================================
    if origen_tipo == ORIGEN_VENTA:
        venta = get_venta_for_update(conn, data["origen_id"])

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {data['origen_id']}",
            )

        if venta["estado"] == VENTA_ESTADO_ANULADA:
            raise HTTPException(
                status_code=400,
                detail=f"La venta {venta['id']} está anulada y no puede recibir pagos",
            )

        if venta["estado"] == VENTA_ESTADO_ENTREGADA:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"La venta {venta['id']} ya fue entregada. "
                    "Si tiene saldo pendiente, registrá el pago sobre la deuda correspondiente"
                ),
            )

        saldo_pendiente = redondear_monto(venta["saldo_pendiente"])

        if saldo_pendiente <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"La venta {venta['id']} no tiene saldo pendiente",
            )

        if monto > saldo_pendiente:
            raise HTTPException(
                status_code=400,
                detail="El monto del pago supera el saldo pendiente",
            )

        caja = _obtener_caja_abierta_obligatoria(conn, venta["id_sucursal"])
        saldo_restante = redondear_monto(saldo_pendiente - monto)
        nuevo_estado = (
            VENTA_ESTADO_PAGADA_TOTAL
            if saldo_restante == 0
            else VENTA_ESTADO_PAGADA_PARCIAL
        )

        pago_id = insert_pago(
            conn,
            {
                "id_cliente": venta["id_cliente"],
                "origen_tipo": ORIGEN_VENTA,
                "origen_id": venta["id"],
                "medio_pago": medio_pago,
                "monto_total_cobrado": monto,
                "nota": data.get("nota"),
                "id_usuario": data["id_usuario"],
            },
        )

        insert_caja_movimiento(
            conn,
            id_caja=caja["id"],
            tipo_movimiento=CAJA_MOVIMIENTO_INGRESO,
            submedio=medio_pago,
            monto=monto,
            origen_tipo=CAJA_ORIGEN_PAGO,
            origen_id=pago_id,
            nota=f"Pago venta #{venta['id']}",
            id_usuario=data["id_usuario"],
        )

        update_venta_saldo_y_estado(
            conn,
            venta["id"],
            saldo_restante,
            nuevo_estado,
        )

        auditoria_service.registrar_evento(
            conn,
            id_usuario=data["id_usuario"],
            id_sucursal=venta["id_sucursal"],
            entidad=AUDITORIA_ENTIDAD_PAGO,
            entidad_id=pago_id,
            accion=AUDITORIA_ACCION_PAGO_REGISTRADO,
            detalle=(
                f"Pago registrado para venta #{venta['id']}. "
                f"medio={medio_pago}, monto={monto}, "
                f"saldo_restante={saldo_restante}, "
                f"estado_venta={nuevo_estado}"
            ),
            metadata={
                "tipo": "pago_venta_registrado",
                "pago_id": pago_id,
                "venta_id": venta["id"],
                "cliente_id": venta["id_cliente"],
                "medio_pago": medio_pago,
                "monto": str(monto),
                "saldo_restante": str(saldo_restante),
                "estado_venta": nuevo_estado,
            },
            origen_tipo="venta",
            origen_id=venta["id"],
        )

        return {
            "ok": True,
            "pago_id": pago_id,
            "venta_id": venta["id"],
            "estado_venta": nuevo_estado,
            "saldo_restante": saldo_restante,
        }

    # =====================================================
    # CASO 2: PAGO DE RESERVA / OTROS ORÍGENES
    # =====================================================
    if "id_sucursal" not in data:
        raise HTTPException(
            status_code=400,
            detail="id_sucursal es obligatorio para pagos que no sean de venta",
        )

    id_sucursal = data["id_sucursal"]
    caja = _obtener_caja_abierta_obligatoria(conn, id_sucursal)

    pago_id = insert_pago(
        conn,
        {
            "id_cliente": data.get("id_cliente"),
            "origen_tipo": origen_tipo,
            "origen_id": data["origen_id"],
            "medio_pago": medio_pago,
            "monto_total_cobrado": monto,
            "nota": data.get("nota"),
            "id_usuario": data["id_usuario"],
        },
    )

    insert_caja_movimiento(
        conn,
        id_caja=caja["id"],
        tipo_movimiento=CAJA_MOVIMIENTO_INGRESO,
        submedio=medio_pago,
        monto=monto,
        origen_tipo=CAJA_ORIGEN_PAGO,
        origen_id=pago_id,
        nota=f"Pago {origen_tipo} #{data['origen_id']}",
        id_usuario=data["id_usuario"],
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=data["id_usuario"],
        id_sucursal=id_sucursal,
        entidad=AUDITORIA_ENTIDAD_PAGO,
        entidad_id=pago_id,
        accion=AUDITORIA_ACCION_PAGO_REGISTRADO,
        detalle=(
            f"Pago registrado. origen_tipo={origen_tipo}, "
            f"origen_id={data['origen_id']}, medio={medio_pago}, monto={monto}"
        ),
        metadata={
            "tipo": "pago_registrado",
            "pago_id": pago_id,
            "origen_tipo": origen_tipo,
            "origen_id": data["origen_id"],
            "id_cliente": data.get("id_cliente"),
            "medio_pago": medio_pago,
            "monto": str(monto),
        },
        origen_tipo=origen_tipo,
        origen_id=data["origen_id"],
    )

    return {
        "ok": True,
        "pago_id": pago_id,
        "origen_tipo": origen_tipo,
        "origen_id": data["origen_id"],
    }


def crear_pago(data):
    """
    Wrapper para endpoint / uso simple.
    """
    conn = get_connection()

    try:
        with conn.transaction():
            payload = {
                "id_cliente": getattr(data, "id_cliente", None),
                "origen_tipo": data.origen_tipo,
                "origen_id": data.origen_id,
                "medio_pago": data.medio_pago,
                "monto": data.monto,
                "nota": data.nota,
                "id_usuario": data.id_usuario,
            }

            if hasattr(data, "id_sucursal"):
                payload["id_sucursal"] = data.id_sucursal

            return registrar_pago(conn, payload)
    finally:
        conn.close()


def revertir_pago(pago_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_permiso_revertir_pago(conn, data.id_usuario)
            pago_original = get_pago_by_id_for_update(conn, pago_id)
            if pago_original is None:
                raise HTTPException(status_code=404, detail=f"No existe el pago {pago_id}")

            if pago_original["origen_tipo"] != ORIGEN_VENTA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo está implementada la reversión de pagos de venta",
                )

            if pago_original["estado"] == PAGO_ESTADO_REVERTIDO:
                raise HTTPException(status_code=400, detail=f"El pago {pago_id} ya fue revertido")

            reversion_existente = get_reversion_by_pago_original(conn, pago_id)
            if reversion_existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"El pago {pago_id} ya tiene una reversión registrada",
                )

            venta = get_venta_for_update(conn, pago_original["origen_id"])
            if venta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la venta {pago_original['origen_id']}",
                )

            if venta["estado"] == VENTA_ESTADO_ENTREGADA:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede revertir un pago de una venta ya entregada",
                )

            saldo_pendiente = redondear_monto(venta["saldo_pendiente"])
            monto_original = redondear_monto(pago_original["monto_total_cobrado"])
            total_final = redondear_monto(venta["total_final"])

            saldo_restante = redondear_monto(saldo_pendiente + monto_original)

            if saldo_restante > total_final:
                raise HTTPException(
                    status_code=500,
                    detail="Inconsistencia en cálculo de saldo tras reversión",
                )

            nuevo_estado = (
                VENTA_ESTADO_CREADA
                if saldo_restante == total_final
                else VENTA_ESTADO_PAGADA_PARCIAL
            )

            caja = _obtener_caja_abierta_obligatoria(conn, venta["id_sucursal"])

            pago_reversion_id = insert_pago(
                conn,
                {
                    "id_cliente": pago_original["id_cliente"],
                    "origen_tipo": ORIGEN_VENTA,
                    "origen_id": venta["id"],
                    "medio_pago": pago_original["medio_pago"],
                    "monto_total_cobrado": pago_original["monto_total_cobrado"],
                    "nota": f"Reversión de pago #{pago_original['id']}: {data.motivo}",
                    "id_usuario": data.id_usuario,
                },
            )

            reversion_id = insert_pago_reversion_relacion(
                conn,
                id_pago_original=pago_original["id"],
                id_pago_reversion=pago_reversion_id,
                motivo=data.motivo,
            )

            update_pago_estado(conn, pago_original["id"], PAGO_ESTADO_REVERTIDO)
            update_pago_estado(conn, pago_reversion_id, PAGO_ESTADO_REVERTIDO)

            insert_caja_movimiento(
                conn,
                id_caja=caja["id"],
                tipo_movimiento=CAJA_MOVIMIENTO_EGRESO,
                submedio=pago_original["medio_pago"],
                monto=pago_original["monto_total_cobrado"],
                origen_tipo="pago_reversion",
                origen_id=reversion_id,
                nota=f"Reversión pago #{pago_original['id']} venta #{venta['id']}",
                id_usuario=data.id_usuario,
            )

            update_venta_saldo_y_estado(
                conn,
                venta["id"],
                saldo_restante,
                nuevo_estado,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_PAGO,
                entidad_id=pago_original["id"],
                accion=AUDITORIA_ACCION_PAGO_REVERTIDO,
                detalle=(
                    f"Pago revertido. pago_original={pago_original['id']}, "
                    f"pago_reversion={pago_reversion_id}, "
                    f"motivo={data.motivo}"
                ),
                metadata={
                    "tipo": "pago_revertido",
                    "pago_original_id": pago_original["id"],
                    "pago_reversion_id": pago_reversion_id,
                    "reversion_id": reversion_id,
                    "venta_id": venta["id"],
                    "cliente_id": venta["id_cliente"],
                    "medio_pago": pago_original["medio_pago"],
                    "monto": str(monto_original),
                    "saldo_pendiente_anterior": str(saldo_pendiente),
                    "saldo_pendiente_nuevo": str(saldo_restante),
                    "estado_venta_nuevo": nuevo_estado,
                    "motivo": data.motivo,
                },
                origen_tipo="venta",
                origen_id=venta["id"],
            )

        return {
            "ok": True,
            "pago_id_original": pago_original["id"],
            "pago_id_reversion": pago_reversion_id,
            "venta_id": venta["id"],
            "estado_venta": nuevo_estado,
            "saldo_restante": saldo_restante,
            "reversion_id": reversion_id,
        }
    finally:
        conn.close()


def listar_pagos():
    conn = get_connection()
    try:
        return get_pagos(conn)
    finally:
        conn.close()


def obtener_pagos_venta(venta_id: int):
    conn = get_connection()
    try:
        return obtener_pagos_por_venta(conn, venta_id)
    finally:
        conn.close()