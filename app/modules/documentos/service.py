from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    get_venta_comprobante_by_id,
    get_venta_items_comprobante_by_venta_id,
)


def obtener_datos_comprobante_x_venta(venta_id: int):
    conn = get_connection()

    try:
        venta = get_venta_comprobante_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        items = get_venta_items_comprobante_by_venta_id(
            conn,
            venta_id,
        )

        if not items:
            raise HTTPException(
                status_code=400,
                detail="La venta no tiene items para imprimir",
            )

        return {
            "venta": venta,
            "items": items,
        }

    finally:
        conn.close()