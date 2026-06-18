from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .pdf import (
    LOGO_HORIZONTAL,
    LOGO_ICONO,
    _draw_image_fit,
    _fecha,
    _money,
    _text,
)
from app.modules.configuracion_negocio.service import obtener_configuracion_negocio
from app.modules.configuracion_negocio.template import lineas_configurables


def _draw_watermark(c, width, height):
    if not LOGO_ICONO.exists():
        return

    c.saveState()
    try:
        c.setFillAlpha(0.04)
    except Exception:
        pass

    _draw_image_fit(
        c,
        LOGO_ICONO,
        width / 2 - 55 * mm,
        height / 2 - 55 * mm,
        110 * mm,
        110 * mm,
    )
    c.restoreState()


def _wrap_text(value, max_chars=76):
    text = _text(value).strip()
    if not text:
        return [""]

    lines = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)
    return lines or [""]


def _table_header(c, y, width, margin_x):
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin_x, y, "Detalle")
    c.drawRightString(width - margin_x - 52 * mm, y, "Cant.")
    c.drawRightString(width - margin_x - 24 * mm, y, "Unitario")
    c.drawRightString(width - margin_x, y, "Subtotal")
    y -= 3 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    return y - 5 * mm


def _ensure_space(c, y, needed, width, height, margin_x):
    if y >= needed:
        return y
    c.showPage()
    _draw_watermark(c, width, height)
    return _table_header(c, height - 18 * mm, width, margin_x)


def _draw_row(c, *, y, width, margin_x, item):
    detalle = item.get("descripcion_snapshot")
    lines = _wrap_text(detalle, 58)[:4]
    line_height = 4.6 * mm
    row_height = max(10 * mm, 1.5 * mm + len(lines) * line_height + 3.2 * mm)

    c.setFont("Helvetica", 8)
    text_y = y - 1.5 * mm
    for line in lines:
        c.drawString(margin_x, text_y, line)
        text_y -= line_height

    cantidad = Decimal(str(item.get("cantidad") or 0))
    precio = Decimal(str(item.get("precio_unitario") or 0))
    subtotal = Decimal(str(item.get("subtotal") or 0))

    c.drawRightString(width - margin_x - 52 * mm, y - 1.5 * mm, f"{cantidad:g}")
    c.drawRightString(width - margin_x - 24 * mm, y - 1.5 * mm, _money(precio))
    c.drawRightString(width - margin_x, y - 1.5 * mm, _money(subtotal))

    y -= row_height
    c.setLineWidth(0.2)
    c.line(margin_x, y, width - margin_x, y)
    return y - 3 * mm


def generar_cotizacion_pdf(data: dict) -> bytes:
    cotizacion = data["cotizacion"]
    items = data.get("items", [])
    config = obtener_configuracion_negocio()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin_x = 16 * mm

    _draw_watermark(c, width, height)

    y = height - 18 * mm

    if LOGO_HORIZONTAL.exists():
        _draw_image_fit(c, LOGO_HORIZONTAL, margin_x, y - 17 * mm, 68 * mm, 17 * mm)
    else:
        c.setFont("Helvetica-Bold", 15)
        c.drawString(margin_x, y, "EMPRENDIMIENTO AGUS")

    titulo = "COTIZACION REPARACION" if cotizacion.get("tipo") == "reparacion" else "COTIZACION"

    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - margin_x, y, titulo)
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "NO FISCAL")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, cotizacion["numero"])
    y -= 5 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, f"Fecha: {_fecha(cotizacion.get('fecha'))}")

    y -= 13 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    y -= 8 * mm

    cliente = (
        cotizacion.get("cliente_nombre")
        or cotizacion.get("cliente_nombre_snapshot")
        or "Cliente mostrador"
    )

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Cliente:")
    c.setFont("Helvetica", 10)
    c.drawString(margin_x + 24 * mm, y, _text(cliente)[:70])

    c.setFont("Helvetica-Bold", 10)
    c.drawString(width / 2 + 4 * mm, y, "Estado:")
    c.setFont("Helvetica", 10)
    c.drawString(width / 2 + 25 * mm, y, _text(cotizacion.get("estado")).replace("_", " ").capitalize())
    y -= 6 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Sucursal:")
    c.setFont("Helvetica", 10)
    c.drawString(margin_x + 24 * mm, y, _text(cotizacion.get("sucursal_nombre"))[:70])
    y -= 6 * mm

    if cotizacion.get("fecha_validez"):
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Validez:")
        c.setFont("Helvetica", 10)
        c.drawString(margin_x + 24 * mm, y, _text(cotizacion.get("fecha_validez"))[:20])
        y -= 6 * mm

    if cotizacion.get("problema_reportado"):
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Consulta:")
        c.setFont("Helvetica", 9)
        first = True
        for line in _wrap_text(cotizacion.get("problema_reportado"), 92)[:3]:
            c.drawString(margin_x + (24 * mm if first else 0), y, line)
            first = False
            y -= 5 * mm

    if cotizacion.get("observaciones"):
        y -= 1 * mm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Notas:")
        c.setFont("Helvetica", 9)
        first = True
        for line in _wrap_text(cotizacion.get("observaciones"), 92)[:3]:
            c.drawString(margin_x + (24 * mm if first else 0), y, line)
            first = False
            y -= 5 * mm

    y -= 5 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Detalle cotizado")
    y -= 8 * mm
    y = _table_header(c, y, width, margin_x)

    for item in items:
        needed = 20 * mm
        y = _ensure_space(c, y, needed, width, height, margin_x)
        y = _draw_row(c, y=y, width=width, margin_x=margin_x, item=item)

    y = _ensure_space(c, y, 40 * mm, width, height, margin_x)
    y -= 2 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x - 34 * mm, y, "Subtotal")
    c.drawRightString(width - margin_x, y, _money(cotizacion.get("subtotal")))
    y -= 6 * mm
    c.drawRightString(width - margin_x - 34 * mm, y, "Descuento")
    c.drawRightString(width - margin_x, y, f"- {_money(cotizacion.get('descuento_total'))}")
    y -= 6 * mm
    c.drawRightString(width - margin_x - 34 * mm, y, "Recargo")
    c.drawRightString(width - margin_x, y, f"+ {_money(cotizacion.get('recargo_total'))}")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(width - margin_x - 34 * mm, y, "TOTAL")
    c.drawRightString(width - margin_x, y, _money(cotizacion.get("total_final")))

    y -= 15 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    y -= 7 * mm
    c.setFont("Helvetica", 8)
    condiciones = lineas_configurables(config.get("condiciones_cotizacion"), config)
    for condicion in condiciones:
        c.drawString(margin_x, y, f"- {condicion}")
        y -= 5 * mm

    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2, 12 * mm, f"{config.get('nombre_negocio')} - Documento interno")

    c.showPage()
    c.save()
    return buffer.getvalue()
