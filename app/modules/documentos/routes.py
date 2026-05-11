from fastapi import APIRouter
from fastapi.responses import Response

from .service import obtener_datos_comprobante_x_venta
from .pdf import generar_comprobante_x_pdf


router = APIRouter()


@router.get("/ventas/{venta_id}/comprobante-x")
def comprobante_x_venta(venta_id: int):
    data = obtener_datos_comprobante_x_venta(venta_id)
    pdf_bytes = generar_comprobante_x_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="comprobante-x-venta-{venta_id}.pdf"'
        },
    )