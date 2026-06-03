from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    get_venta_comprobante_by_id,
    get_venta_items_comprobante_by_venta_id,
    get_pagos_comprobante_by_venta_id,
    get_pago_recibo_by_id,
    get_resumen_cobros_venta_by_id,
    get_resumen_cobros_pagos_by_venta_id,
    get_resumen_cobros_items_preview_by_venta_id,
)
from .repository_taller_presupuesto import (
    get_orden_taller_presupuesto_by_id,
    get_orden_taller_items_presupuesto_by_orden_id,
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
        pagos = get_pagos_comprobante_by_venta_id(
            conn,
            venta_id,
        )
        return {
            "venta": venta,
            "items": items,
            "pagos": pagos,
        }

    finally:
        conn.close()
    
def obtener_datos_recibo_pago(pago_id: int):
    conn = get_connection()

    try:
        pago = get_pago_recibo_by_id(conn, pago_id)

        if pago is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el pago {pago_id}",
            )

        return {
            "pago": pago,
        }

    finally:
        conn.close()

def obtener_datos_resumen_cobros_venta(venta_id: int):
    conn = get_connection()

    try:
        venta = get_resumen_cobros_venta_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        pagos = get_resumen_cobros_pagos_by_venta_id(conn, venta_id)
        items_preview = get_resumen_cobros_items_preview_by_venta_id(conn, venta_id)

        return {
            "venta": venta,
            "pagos": pagos,
            "items_preview": items_preview,
        }

    finally:
        conn.close()


def obtener_datos_presupuesto_taller(orden_id: int):
    conn = get_connection()

    try:
        orden = get_orden_taller_presupuesto_by_id(conn, orden_id)

        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        items = get_orden_taller_items_presupuesto_by_orden_id(conn, orden_id)

        if not items:
            raise HTTPException(
                status_code=400,
                detail="La orden de taller no tiene items para presupuestar",
            )

        return {
            "orden": orden,
            "items": items,
        }

    finally:
        conn.close()
