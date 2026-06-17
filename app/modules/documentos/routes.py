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

@router.get("/pagos/{pago_id}/recibo")
def recibo_pago(pago_id: int):
    data = obtener_datos_recibo_pago(pago_id)

    pdf_bytes = generar_recibo_pago_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="recibo-pago-{pago_id}.pdf"'
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
                f'inline; filename="resumen-cobros-venta-{venta_id}.pdf"'
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
                f'inline; filename="presupuesto-taller-{orden_id}.pdf"'
            )
        },
    )


@router.get("/cotizaciones/{cotizacion_id}/pdf")
def cotizacion_pdf(cotizacion_id: int):
    data = obtener_datos_cotizacion_pdf(cotizacion_id)
    pdf_bytes = generar_cotizacion_pdf(data)

    numero = data["cotizacion"].get("numero") or cotizacion_id
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="cotizacion-{numero}.pdf"'
            )
        },
    )


@router.get("/etiquetas/variantes/{variante_id}/deposito")
def etiqueta_deposito_variante(variante_id: int, copias: int = 1):
    data = obtener_datos_etiqueta_variante(variante_id)
    pdf_bytes = generar_etiqueta_deposito_pdf(data, copias=copias)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="etiqueta-variante-{variante_id}.pdf"'
            )
        },
    )


@router.get("/etiquetas/variantes/{variante_id}/precio-a4")
def cartel_precio_variante(variante_id: int):
    data = obtener_datos_etiqueta_variante(variante_id)
    pdf_bytes = generar_cartel_precio_a4_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="precio-variante-{variante_id}.pdf"'
            )
        },
    )


@router.get("/etiquetas/bicicletas/{bicicleta_id}/deposito")
def etiqueta_deposito_bicicleta(bicicleta_id: int, copias: int = 1):
    data = obtener_datos_etiqueta_bicicleta(bicicleta_id)
    pdf_bytes = generar_etiqueta_deposito_pdf(data, copias=copias)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="etiqueta-bicicleta-{bicicleta_id}.pdf"'
            )
        },
    )


@router.get("/etiquetas/bicicletas/{bicicleta_id}/precio-a4")
def cartel_precio_bicicleta(bicicleta_id: int):
    data = obtener_datos_etiqueta_bicicleta(bicicleta_id)
    pdf_bytes = generar_cartel_precio_a4_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="precio-bicicleta-{bicicleta_id}.pdf"'
            )
        },
    )
