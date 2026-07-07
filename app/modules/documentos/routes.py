from fastapi import APIRouter
from fastapi.responses import Response

from .service import (
    obtener_datos_comprobante_x_venta,
    obtener_datos_etiqueta_bicicleta,
    obtener_datos_etiqueta_variante,
    obtener_datos_recibo_pago,
    obtener_datos_resumen_cobros_venta,
    obtener_datos_presupuesto_taller,
    obtener_datos_cotizacion_pdf,
)

from .pdf import generar_comprobante_x_pdf
from .pdf_recibo_pago import generar_recibo_pago_pdf
from .pdf_resumen_cobros import generar_resumen_cobros_pdf
from .pdf_taller_presupuesto import generar_presupuesto_taller_pdf
from .pdf_cotizacion import generar_cotizacion_pdf
from .pdf_etiquetas import generar_cartel_precio_a4_pdf, generar_etiqueta_deposito_pdf
from .imagen_historia import generar_historia_precio_png
from .download_names import (
    compact_date,
    dated_document_name,
    item_download_code,
    numeric_code,
)

router = APIRouter()


@router.get("/ventas/{venta_id}/comprobante-x")
def comprobante_x_venta(venta_id: int):
    data = obtener_datos_comprobante_x_venta(venta_id)
    pdf_bytes = generar_comprobante_x_pdf(data, incluir_marca_agua=False)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{dated_document_name("FAC", venta_id)}"'
            )
        },
    )

@router.get("/pagos/{pago_id}/recibo")
def recibo_pago(pago_id: int):
    data = obtener_datos_recibo_pago(pago_id)

    pdf_bytes = generar_recibo_pago_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{dated_document_name("REC", pago_id)}"'
            )
        },
    )

@router.get("/ventas/{venta_id}/resumen-cobros")
def resumen_cobros_venta(venta_id: int):
    data = obtener_datos_resumen_cobros_venta(venta_id)
    pdf_bytes = generar_resumen_cobros_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{dated_document_name("COB", venta_id)}"'
            )
        },
    )


@router.get("/taller/{orden_id}/presupuesto")
def presupuesto_taller(orden_id: int):
    data = obtener_datos_presupuesto_taller(orden_id)
    pdf_bytes = generar_presupuesto_taller_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{dated_document_name("PRE-OT", orden_id)}"'
            )
        },
    )


@router.get("/cotizaciones/{cotizacion_id}/pdf")
def cotizacion_pdf(cotizacion_id: int):
    data = obtener_datos_cotizacion_pdf(cotizacion_id)
    pdf_bytes = generar_cotizacion_pdf(data)

    numero = data["cotizacion"].get("numero") or cotizacion_id
    filename = dated_document_name("COT", numero)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{filename}"'
            )
        },
    )


@router.get("/etiquetas/variantes/{variante_id}/deposito")
def etiqueta_deposito_variante(variante_id: int, copias: int = 1):
    data = obtener_datos_etiqueta_variante(variante_id)
    pdf_bytes = generar_etiqueta_deposito_pdf(data, copias=copias)
    code = item_download_code(data, f"VAR{numeric_code(variante_id)}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="Etiqueta-{code}.pdf"'
            )
        },
    )


@router.get("/etiquetas/variantes/{variante_id}/precio-a4")
def cartel_precio_variante(variante_id: int):
    data = obtener_datos_etiqueta_variante(variante_id)
    pdf_bytes = generar_cartel_precio_a4_pdf(data)
    code = item_download_code(data, f"VAR{numeric_code(variante_id)}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="Precio-{code}-{compact_date()}.pdf"'
            ),
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/etiquetas/variantes/{variante_id}/historia")
def historia_precio_variante(variante_id: int):
    data = obtener_datos_etiqueta_variante(variante_id)
    image_bytes = generar_historia_precio_png(data)
    code = item_download_code(data, f"VAR{numeric_code(variante_id)}")

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": (
                f'attachment; filename="Etiqueta-{code}.png"'
            ),
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


@router.get("/etiquetas/bicicletas/{bicicleta_id}/deposito")
def etiqueta_deposito_bicicleta(bicicleta_id: int, copias: int = 1):
    data = obtener_datos_etiqueta_bicicleta(bicicleta_id)
    pdf_bytes = generar_etiqueta_deposito_pdf(data, copias=copias)
    code = item_download_code(data, numeric_code(bicicleta_id))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="Etiqueta-BIC-{code}.pdf"'
            )
        },
    )


@router.get("/etiquetas/bicicletas/{bicicleta_id}/historia")
def historia_precio_bicicleta(bicicleta_id: int):
    data = obtener_datos_etiqueta_bicicleta(bicicleta_id)
    image_bytes = generar_historia_precio_png(data)
    code = item_download_code(data, numeric_code(bicicleta_id))

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": (
                f'attachment; filename="Etiqueta-BIC-{code}.png"'
            ),
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


@router.get("/etiquetas/bicicletas/{bicicleta_id}/precio-a4")
def cartel_precio_bicicleta(bicicleta_id: int):
    data = obtener_datos_etiqueta_bicicleta(bicicleta_id)
    pdf_bytes = generar_cartel_precio_a4_pdf(data)
    code = item_download_code(data, numeric_code(bicicleta_id))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="Precio-BIC-{code}-{compact_date()}.pdf"'
            ),
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
