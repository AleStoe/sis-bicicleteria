from decimal import Decimal
from fastapi import HTTPException

from app.db.connection import get_connection
from .repository import (
    get_venta_for_update,
    insert_pago_venta,
    update_venta_saldo_y_estado,
    get_pagos,
    obtener_pagos_por_venta
)

MEDIOS_VALIDOS = {"efectivo", "transferencia", "mercadopago", "tarjeta"}


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

            saldo_restante = venta["saldo_pendiente"] - Decimal(str(data.monto))

            if saldo_restante == 0:
                nuevo_estado = "pagada_total"
            else:
                nuevo_estado = "pagada_parcial"

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