from fastapi import HTTPException

from app.modules.ventas.service import obtener_venta


def obtener_datos_comprobante_x_venta(venta_id: int):
    detalle = obtener_venta(venta_id)

    venta = detalle["venta"]
    items = detalle["items"]

    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    if not items:
        raise HTTPException(
            status_code=400,
            detail="La venta no tiene items para imprimir",
        )

    return {
        "venta": venta,
        "items": items,
        "situacion_financiera": detalle.get("situacion_financiera"),
    }