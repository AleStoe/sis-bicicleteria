from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.modules.configuracion_negocio.service import obtener_configuracion_negocio

from .pdf import LOGO_HORIZONTAL, _draw_image_fit, _fecha, _text
from .pdf_layout import collapse_repeated_words, draw_wrapped_text, normalize_inline_text, wrap_text
from .pdf_metadata import set_pdf_metadata
from .pdf_taller_presupuesto import _bicicleta_textos, _estado_humano


BOTTOM_MARGIN = 16 * mm
TEXT_LEADING = 4.2 * mm


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def _ensure_space(c, y, needed, width, height, margin_x):
    if y - needed >= BOTTOM_MARGIN:
        return y

    c.showPage()
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, height - 16 * mm, "HOJA DE RUTA TALLER")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin_x, height - 16 * mm, "Continuacion")
    c.setLineWidth(0.35)
    c.line(margin_x, height - 20 * mm, width - margin_x, height - 20 * mm)
    return height - 28 * mm


def _draw_header(c, width, height, margin_x, ordenes_count):
    config = obtener_configuracion_negocio()
    y = height - 18 * mm

    if LOGO_HORIZONTAL.exists():
        _draw_image_fit(c, LOGO_HORIZONTAL, margin_x, y - 16 * mm, 64 * mm, 16 * mm)
    else:
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin_x, y, normalize_inline_text(config.get("nombre_negocio")).upper())

    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - margin_x, y, "HOJA DE RUTA TALLER")
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "Uso interno - sin precios")
    y -= 7 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, f"{ordenes_count} OT seleccionada(s)")
    y -= 5 * mm
    c.setFont("Helvetica", 8.5)
    c.drawRightString(width - margin_x, y, f"Generado: {_fecha(datetime.now())}")
    y -= 10 * mm
    c.line(margin_x, y, width - margin_x, y)
    return y - 8 * mm


def _draw_metric(c, x, y, width, label, value, *, accent=False):
    c.saveState()
    if accent:
        c.setFillColorRGB(0.93, 0.98, 0.95)
        c.setStrokeColorRGB(0.53, 0.94, 0.65)
    else:
        c.setFillColorRGB(0.97, 0.98, 0.99)
        c.setStrokeColorRGB(0.86, 0.89, 0.94)
    c.roundRect(x, y - 18 * mm, width, 18 * mm, 3 * mm, fill=1, stroke=1)
    c.setFillColorRGB(0.30, 0.34, 0.41)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 3 * mm, y - 5 * mm, label.upper())
    c.setFillColorRGB(0.02, 0.09, 0.20)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 3 * mm, y - 12 * mm, str(value))
    c.restoreState()


def _draw_summary(c, y, width, height, margin_x, resumen):
    y = _ensure_space(c, y, 25 * mm, width, height, margin_x)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, "Resumen operativo")
    y -= 7 * mm

    gap = 4 * mm
    metric_w = (width - 2 * margin_x - 3 * gap) / 4
    _draw_metric(c, margin_x, y, metric_w, "Ordenes", resumen.get("ordenes", 0), accent=True)
    _draw_metric(c, margin_x + metric_w + gap, y, metric_w, "Items", resumen.get("items", 0))
    _draw_metric(c, margin_x + 2 * (metric_w + gap), y, metric_w, "Servicios", resumen.get("servicios", 0))
    _draw_metric(c, margin_x + 3 * (metric_w + gap), y, metric_w, "Repuestos", resumen.get("repuestos", 0))
    y -= 22 * mm

    return y


def _draw_section_title(c, y, width, height, margin_x, title):
    y = _ensure_space(c, y, 11 * mm, width, height, margin_x)
    c.setFillColorRGB(0.96, 0.97, 0.98)
    c.rect(margin_x, y - 6 * mm, width - 2 * margin_x, 8 * mm, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x + 2 * mm, y - 3.5 * mm, title)
    return y - 10 * mm


def _draw_ot_card(c, y, width, height, margin_x, orden):
    items = [item for item in orden.get("items", []) if item.get("etapa") != "cancelado"]

    y = _ensure_space(c, y, 40 * mm, width, height, margin_x)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, f"OT #{orden.get('id')} - {collapse_repeated_words(orden.get('cliente_nombre')) or 'Cliente'}")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin_x, y, _estado_humano(orden.get("estado")))
    y -= 5 * mm

    bicicleta_principal, bicicleta_detalle = _bicicleta_textos(orden)
    bicicleta = bicicleta_principal or "-"
    if bicicleta_detalle:
        bicicleta += f" - {bicicleta_detalle}"
    if orden.get("bicicleta_numero_cuadro"):
        bicicleta += f" - Cuadro {normalize_inline_text(orden.get('bicicleta_numero_cuadro'))}"

    c.setFont("Helvetica", 8.5)
    c.drawString(margin_x, y, f"Bicicleta: {bicicleta}")
    c.drawRightString(width - margin_x, y, f"Ingreso: {_fecha(orden.get('fecha_ingreso'))}")
    y -= 5 * mm

    y = draw_wrapped_text(
        c,
        f"Problema: {collapse_repeated_words(orden.get('problema_reportado')) or '-'}",
        x=margin_x,
        y=y,
        max_width=width - 2 * margin_x,
        font_name="Helvetica",
        font_size=8.5,
        leading=TEXT_LEADING,
    )
    y -= 2 * mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin_x, y, f"Items a revisar: {len(items)}")
    c.drawString(
        margin_x + 40 * mm,
        y,
        f"Servicios: {sum(1 for item in items if item.get('tipo_item') == 'servicio')}",
    )
    c.drawString(
        margin_x + 76 * mm,
        y,
        f"Repuestos: {sum(1 for item in items if item.get('tipo_item') != 'servicio')}",
    )
    c.drawRightString(width - margin_x, y, "Marcar lo realizado")
    y -= 7 * mm

    if items:
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(margin_x, y, "Trabajos / repuestos")
        y -= 4.5 * mm
        for item in items:
            y = _ensure_space(c, y, 8 * mm, width, height, margin_x)
            tipo = "Servicio" if item.get("tipo_item") == "servicio" else "Repuesto"
            detalle = collapse_repeated_words(item.get("descripcion_snapshot")) or "-"
            cantidad = _dec(item.get("cantidad"))
            lines = wrap_text(f"{tipo}: {detalle}", width - 2 * margin_x - 28 * mm, "Helvetica", 8)
            c.setFont("Helvetica", 8)
            c.drawString(margin_x, y, f"[ ] x {cantidad:g}")
            text_y = y
            for line in lines:
                c.drawString(margin_x + 18 * mm, text_y, line)
                text_y -= 3.8 * mm
            y = min(y - 5 * mm, text_y - 1 * mm)

    notas = orden.get("notas") or []
    notas_texto = [
        collapse_repeated_words(nota.get("contenido"))
        for nota in notas
        if _text(nota.get("contenido")).strip()
    ]
    if notas_texto:
        y -= 2 * mm
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(margin_x, y, "Notas")
        y -= 4.5 * mm
        for nota in notas_texto[:4]:
            y = draw_wrapped_text(
                c,
                f"- {nota}",
                x=margin_x,
                y=y,
                max_width=width - 2 * margin_x,
                font_name="Helvetica",
                font_size=8,
                leading=4 * mm,
            )

    c.setLineWidth(0.25)
    c.line(margin_x, y - 2 * mm, width - margin_x, y - 2 * mm)
    return y - 7 * mm


def generar_paquete_trabajo_taller_pdf(data: dict) -> bytes:
    ordenes = data.get("ordenes") or []
    resumen = data.get("resumen") or {}

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    set_pdf_metadata(c, "Hoja de ruta taller")
    width, height = A4
    margin_x = 15 * mm

    y = _draw_header(c, width, height, margin_x, len(ordenes))
    y = _draw_summary(c, y, width, height, margin_x, resumen)

    y = _draw_section_title(c, y, width, height, margin_x, "Ordenes incluidas")
    for orden in ordenes:
        y = _draw_ot_card(c, y, width, height, margin_x, orden)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
