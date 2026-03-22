from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)
from .repository import (
    get_pago_by_id_for_update,
    get_reversion_by_pago_original,
    get_venta_for_update,
    get_pagos,
    insert_pago_reversion,
    insert_pago_reversion_relacion,
    insert_pago_venta,
    obtener_pagos_por_venta,
    update_pago_estado,
    update_venta_saldo_y_estado,
)

MEDIOS_VALIDOS = {"efectivo", "transferencia", "mercadopago", "tarjeta"}


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


def crear_pago(data):
    conn = get_connection()

    try:
        with conn.transaction():
            if data.medio_pago not in MEDIOS_VALIDOS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Medio de pago inválido: {data.medio_pago}",
                )

            venta = get_venta_for_update(conn, data.venta_id)

            if venta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la venta {data.venta_id}",
                )

            if venta["estado"] == "anulada":
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {data.venta_id} está anulada y no puede recibir pagos",
                )

            if venta["estado"] == "entregada":
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {data.venta_id} ya fue entregada y no admite nuevos pagos",
                )

            if venta["saldo_pendiente"] <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {data.venta_id} no tiene saldo pendiente",
                )

            if data.monto > venta["saldo_pendiente"]:
                raise HTTPException(
                    status_code=400,
                    detail="El monto del pago supera el saldo pendiente",
                )

            caja = _obtener_caja_abierta_obligatoria(conn, venta["id_sucursal"])
            saldo_restante = venta["saldo_pendiente"] - Decimal(str(data.monto))
            nuevo_estado = "pagada_total" if saldo_restante == 0 else "pagada_parcial"

            pago_id = insert_pago_venta(
                conn,
                {
                    "id_cliente": venta["id_cliente"],
                    "venta_id": venta["id"],
                    "medio_pago": data.medio_pago,
                    "monto": data.monto,
                    "nota": data.nota,
                    "id_usuario": data.id_usuario,
                },
            )

            insert_caja_movimiento(
                conn,
                id_caja=caja["id"],
                tipo_movimiento="ingreso",
                submedio=data.medio_pago,
                monto=data.monto,
                origen_tipo="pago",
                origen_id=pago_id,
                nota=f"Pago venta #{venta['id']}",
                id_usuario=data.id_usuario,
            )

            update_venta_saldo_y_estado(
                conn,
                venta["id"],
                saldo_restante,
                nuevo_estado,
            )

        return {
            "ok": True,
            "pago_id": pago_id,
            "venta_id": venta["id"],
            "estado_venta": nuevo_estado,
            "saldo_restante": saldo_restante,
        }
    finally:
        conn.close()


def revertir_pago(pago_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            pago_original = get_pago_by_id_for_update(conn, pago_id)
            if pago_original is None:
                raise HTTPException(status_code=404, detail=f"No existe el pago {pago_id}")

            if pago_original["origen_tipo"] != "venta":
                raise HTTPException(
                    status_code=400,
                    detail="Solo está implementada la reversión de pagos de venta",
                )

            if pago_original["estado"] == "revertido":
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

            if venta["estado"] == "entregada":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede revertir un pago de una venta ya entregada",
                )

            caja = _obtener_caja_abierta_obligatoria(conn, venta["id_sucursal"])
            saldo_restante = venta["saldo_pendiente"] + pago_original["monto_total_cobrado"]
            nuevo_estado = "creada" if saldo_restante == venta["total_final"] else "pagada_parcial"

            pago_reversion_id = insert_pago_reversion(
                conn,
                {
                    "id_cliente": pago_original["id_cliente"],
                    "venta_id": venta["id"],
                    "medio_pago": pago_original["medio_pago"],
                    "monto": pago_original["monto_total_cobrado"],
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

            update_pago_estado(conn, pago_original["id"], "revertido")
            update_pago_estado(conn, pago_reversion_id, "revertido")

            insert_caja_movimiento(
                conn,
                id_caja=caja["id"],
                tipo_movimiento="egreso",
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
