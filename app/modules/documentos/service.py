from fastapi import HTTPException
from decimal import Decimal

from app.db.connection import get_connection
from app.modules.reglas_comerciales.repository import (
    get_reglas_activas_por_medios,
    get_tarjeta_planes,
)

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
from app.modules.cotizaciones.repository import (
    get_cotizacion_by_id,
    get_cotizacion_items,
)
from .repository_etiquetas import (
    get_bicicleta_etiqueta_by_id,
    get_variante_etiqueta_by_id,
)


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def _opciones_pago_etiquetas(conn):
    reglas = get_reglas_activas_por_medios(conn, ["efectivo", "transferencia"])
    planes = get_tarjeta_planes(conn, solo_activos=True)

    opciones_contado = []
    for medio in ["efectivo", "transferencia"]:
        descuento = sum(
            _dec(regla.get("porcentaje"))
            for regla in reglas
            if regla.get("tipo") == "descuento"
            and regla.get("porcentaje") is not None
            and regla.get("medio_pago") in {None, medio}
        )

        opciones_contado.append(
            {
                "medio_pago": medio,
                "label": "Efectivo" if medio == "efectivo" else "Transferencia",
                "porcentaje_descuento": descuento,
            }
        )

    opciones_tarjeta = [
        {
            "label": plan["nombre"],
            "cuotas": int(plan["cuotas"]),
            "porcentaje_recargo": _dec(plan["porcentaje_recargo_cliente"]),
        }
        for plan in planes
        if plan.get("medio_pago") == "tarjeta"
    ]

    return {
        "contado": opciones_contado,
        "tarjeta": opciones_tarjeta,
    }


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


def obtener_datos_cotizacion_pdf(cotizacion_id: int):
    conn = get_connection()

    try:
        cotizacion = get_cotizacion_by_id(conn, cotizacion_id)

        if cotizacion is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la cotizacion {cotizacion_id}",
            )

        items = get_cotizacion_items(conn, cotizacion_id)

        return {
            "cotizacion": cotizacion,
            "items": items,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_etiqueta_variante(variante_id: int):
    conn = get_connection()

    try:
        item = get_variante_etiqueta_by_id(conn, variante_id)

        if item is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {variante_id}",
            )

        return {
            "tipo": "variante",
            "item": item,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_etiqueta_bicicleta(bicicleta_id: int):
    conn = get_connection()

    try:
        item = get_bicicleta_etiqueta_by_id(conn, bicicleta_id)

        if item is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la bicicleta serializada {bicicleta_id}",
            )

        return {
            "tipo": "bicicleta",
            "item": item,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()
