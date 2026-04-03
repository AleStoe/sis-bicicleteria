from decimal import Decimal

from fastapi import HTTPException

from app.modules.authz.service import exigir_rol_admin
from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.pagos import service as pagos_service
from app.shared.constants import (
    ORIGEN_VENTA,
    ORIGEN_DEUDA_CLIENTE,
    DEUDA_ESTADO_ABIERTA,
    DEUDA_ESTADO_CERRADA,
    DEUDA_MOVIMIENTO_CARGO,
    DEUDA_MOVIMIENTO_PAGO,
    AUDITORIA_ENTIDAD_DEUDA,
    AUDITORIA_ACCION_DEUDA_GENERADA,
    AUDITORIA_ACCION_DEUDA_PAGO_REGISTRADO,
)

from . import repository


def _validar_cliente(conn, id_cliente: int):
    cliente = repository.get_cliente_by_id(conn, id_cliente)

    if cliente is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe el cliente {id_cliente}",
        )

    if not cliente["activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El cliente {id_cliente} está inactivo",
        )

    return cliente


def _validar_venta_para_deuda(conn, id_venta: int, id_cliente: int):
    venta = repository.get_venta_by_id_for_update(conn, id_venta)

    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {id_venta}",
        )

    if venta["id_cliente"] != id_cliente:
        raise HTTPException(
            status_code=400,
            detail="La venta no pertenece al cliente indicado",
        )

    deuda_existente = repository.get_deuda_abierta_by_origen(
        conn,
        ORIGEN_VENTA,
        id_venta,
    )
    if deuda_existente is not None:
        raise HTTPException(
            status_code=400,
            detail=f"La venta {id_venta} ya tiene una deuda abierta",
        )

    return venta


def crear_deuda_por_venta(data):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_rol_admin(conn, data.id_usuario)

            deuda = crear_deuda_desde_venta_entregada(
                conn,
                id_cliente=data.id_cliente,
                id_venta=data.id_venta,
                monto_inicial=data.monto_inicial,
                id_usuario=data.id_usuario,
                observacion=data.observacion,
            )

        return {
            "ok": True,
            "deuda_id": deuda["id"],
            "estado": deuda["estado"],
            "saldo_actual": deuda["saldo_actual"],
        }
    finally:
        conn.close()


def listar_deudas(
    *,
    id_cliente: int | None = None,
    estado: str | None = None,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
):
    conn = get_connection()
    try:
        return repository.get_deudas_filtradas(
            conn,
            id_cliente=id_cliente,
            estado=estado,
            origen_tipo=origen_tipo,
            origen_id=origen_id,
        )
    finally:
        conn.close()


def obtener_deuda(deuda_id: int):
    conn = get_connection()
    try:
        deuda = repository.get_deuda_by_id(conn, deuda_id)

        if deuda is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la deuda {deuda_id}",
            )

        movimientos = repository.get_deuda_movimientos(conn, deuda_id)

        return {
            "deuda": deuda,
            "movimientos": movimientos,
        }
    finally:
        conn.close()


def registrar_pago_deuda(deuda_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            deuda = repository.get_deuda_by_id_for_update(conn, deuda_id)

            if deuda is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la deuda {deuda_id}",
                )

            if deuda["estado"] != DEUDA_ESTADO_ABIERTA:
                raise HTTPException(
                    status_code=400,
                    detail=f"La deuda {deuda_id} no está abierta",
                )

            monto = Decimal(str(data.monto))
            saldo_actual = Decimal(str(deuda["saldo_actual"]))

            if monto <= Decimal("0"):
                raise HTTPException(
                    status_code=400,
                    detail="El monto del pago debe ser mayor a 0",
                )

            if monto > saldo_actual:
                raise HTTPException(
                    status_code=400,
                    detail="El monto del pago supera el saldo de la deuda",
                )

            # Necesitamos la venta origen para conocer la sucursal
            if deuda["origen_tipo"] != ORIGEN_VENTA:
                raise HTTPException(
                    status_code=400,
                    detail="En este MVP solo se permite pagar deudas originadas en venta",
                )

            venta = repository.get_venta_by_id_for_update(conn, deuda["origen_id"])
            if venta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la venta origen {deuda['origen_id']}",
                )

            # Reutilizamos pagos para registrar pago + caja
            pagos_service.registrar_pago(
                conn,
                {
                    "id_sucursal": venta["id_sucursal"],
                    "id_cliente": deuda["id_cliente"],
                    "origen_tipo": ORIGEN_DEUDA_CLIENTE,
                    "origen_id": deuda_id,
                    "medio_pago": data.medio_pago,
                    "monto": monto,
                    "nota": data.nota,
                    "id_usuario": data.id_usuario,
                },
            )

            nuevo_saldo = saldo_actual - monto
            nuevo_estado = (
                DEUDA_ESTADO_CERRADA
                if nuevo_saldo == Decimal("0")
                else DEUDA_ESTADO_ABIERTA
            )

            repository.insert_deuda_movimiento(
                conn,
                {
                    "id_deuda": deuda_id,
                    "tipo_movimiento": DEUDA_MOVIMIENTO_PAGO,
                    "monto": monto,
                    "origen_tipo": ORIGEN_DEUDA_CLIENTE,
                    "origen_id": deuda_id,
                    "nota": data.nota or f"Pago registrado sobre deuda #{deuda_id}",
                    "id_usuario": data.id_usuario,
                },
            )

            repository.update_deuda_saldo_y_estado(
                conn,
                deuda_id=deuda_id,
                saldo_actual=nuevo_saldo,
                estado=nuevo_estado,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_DEUDA,
                entidad_id=deuda_id,
                accion=AUDITORIA_ACCION_DEUDA_PAGO_REGISTRADO,
                detalle=(
                    f"Pago de deuda registrado. "
                    f"monto={monto}, saldo_nuevo={nuevo_saldo}, estado_nuevo={nuevo_estado}"
                ),
            )

        return {
            "ok": True,
            "deuda_id": deuda_id,
            "saldo_actual": nuevo_saldo,
            "estado": nuevo_estado,
        }
    finally:
        conn.close()

def crear_deuda_desde_venta_entregada(
    conn,
    *,
    id_cliente: int,
    id_venta: int,
    monto_inicial,
    id_usuario: int,
    observacion: str | None = None,
):
    monto_inicial = Decimal(str(monto_inicial))

    if monto_inicial <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto inicial de la deuda debe ser mayor a 0",
        )

    _validar_cliente(conn, id_cliente)
    venta = _validar_venta_para_deuda(conn, id_venta, id_cliente)

    deuda = repository.insert_deuda_cliente(
        conn,
        {
            "id_cliente": id_cliente,
            "origen_tipo": ORIGEN_VENTA,
            "origen_id": id_venta,
            "saldo_actual": monto_inicial,
            "genera_recargo": False,
            "tasa_recargo": None,
            "proximo_vencimiento": None,
            "estado": DEUDA_ESTADO_ABIERTA,
            "observacion": observacion,
        },
    )

    repository.insert_deuda_movimiento(
        conn,
        {
            "id_deuda": deuda["id"],
            "tipo_movimiento": DEUDA_MOVIMIENTO_CARGO,
            "monto": monto_inicial,
            "origen_tipo": ORIGEN_VENTA,
            "origen_id": id_venta,
            "nota": f"Deuda generada desde venta #{id_venta}",
            "id_usuario": id_usuario,
        },
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=venta["id_sucursal"],
        entidad=AUDITORIA_ENTIDAD_DEUDA,
        entidad_id=deuda["id"],
        accion=AUDITORIA_ACCION_DEUDA_GENERADA,
        detalle=(
            f"Deuda generada desde venta. "
            f"venta_id={id_venta}, cliente={id_cliente}, monto={monto_inicial}"
        ),
    )

    return deuda

def obtener_deuda_abierta_por_origen(conn, *, origen_tipo: str, origen_id: int):
    return repository.get_deuda_abierta_by_origen(conn, origen_tipo, origen_id)