from datetime import datetime
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.modules.configuracion_negocio.service import obtener_configuracion_negocio

from .pdf import (
    LOGO_HORIZONTAL,
    _draw_image_fit,
    _fecha,
    _text,
)
from .pdf_metadata import set_pdf_metadata
from .pdf_layout import collapse_repeated_words, draw_wrapped_text, normalize_inline_text, wrap_text
from .pdf_taller_presupuesto import _bicicleta_textos, _estado_humano


BOTTOM_MARGIN = 16 * mm
TEXT_LEADING = 4.5 * mm


def _ensure_space(c, y, needed, width, height, margin_x):
    if y - needed >= BOTTOM_MARGIN:
        return y

    c.showPage()
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, height - 16 * mm, "HOJA DE REPARACION")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin_x, height - 16 * mm, "Continuacion")
    c.setLineWidth(0.35)
    c.line(margin_x, height - 20 * mm, width - margin_x, height - 20 * mm)
    return height - 28 * mm


def _draw_label_value(c, y, width, height, margin_x, label, value, *, strong=False):
    value = collapse_repeated_words(value) or "-"
    max_width = width - 2 * margin_x
    lines = wrap_text(value, max_width, "Helvetica-Bold" if strong else "Helvetica", 9)
    needed = 8 * mm + len(lines) * TEXT_LEADING
    y = _ensure_space(c, y, needed, width, height, margin_x)

    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColorRGB(0.32, 0.36, 0.43)
    c.drawString(margin_x, y, label.upper())
    c.setFillColorRGB(0, 0, 0)
    y -= 4.5 * mm
    y = draw_wrapped_text(
        c,
        value,
        x=margin_x,
        y=y,
        max_width=max_width,
        font_name="Helvetica-Bold" if strong else "Helvetica",
        font_size=9,
        leading=TEXT_LEADING,
    )
    return y - 2 * mm


def _draw_field_row(c, y, width, height, margin_x, fields):
    gap = 6 * mm
    column_width = (width - 2 * margin_x - gap * (len(fields) - 1)) / len(fields)
    max_lines = 1
    wrapped = []

    for label, value in fields:
        lines = wrap_text(normalize_inline_text(value) or "-", column_width, "Helvetica", 8.5)
        wrapped.append((label, lines))
        max_lines = max(max_lines, len(lines))

    needed = 8 * mm + max_lines * TEXT_LEADING
    y = _ensure_space(c, y, needed, width, height, margin_x)

    x = margin_x
    for label, lines in wrapped:
        c.setFont("Helvetica-Bold", 7)
        c.setFillColorRGB(0.32, 0.36, 0.43)
        c.drawString(x, y, label.upper())
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 8.5)
        for index, line in enumerate(lines):
            c.drawString(x, y - 4.2 * mm - index * TEXT_LEADING, line)
        x += column_width + gap

    return y - needed


def _draw_checkbox(c, x, y, label):
    c.setLineWidth(0.45)
    c.rect(x, y - 3.1 * mm, 3.1 * mm, 3.1 * mm, fill=0, stroke=1)
    c.setFont("Helvetica", 8)
    c.drawString(x + 4.5 * mm, y - 2.4 * mm, label)


def _draw_item(c, y, width, height, margin_x, item):
    cantidad = item.get("cantidad") or 0
    detalle = collapse_repeated_words(item.get("descripcion_snapshot")) or "-"
    tipo = "Servicio" if item.get("tipo_item") == "servicio" else "Repuesto"
    lines = wrap_text(detalle, width - 2 * margin_x - 48 * mm, "Helvetica-Bold", 8.5)
    needed = max(14 * mm, 7 * mm + len(lines) * 4 * mm)
    y = _ensure_space(c, y, needed, width, height, margin_x)

    top = y
    c.setLineWidth(0.25)
    c.line(margin_x, top + 2 * mm, width - margin_x, top + 2 * mm)

    _draw_checkbox(c, margin_x, top - 1 * mm, "Hecho")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin_x + 23 * mm, top - 2.8 * mm, tipo)
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin_x, top - 2.8 * mm, f"Cant. {cantidad:g}")

    text_y = top - 7 * mm
    c.setFont("Helvetica-Bold", 8.5)
    for line in lines:
        c.drawString(margin_x + 23 * mm, text_y, line)
        text_y -= 4 * mm

    return y - needed


def _draw_section_title(c, y, width, height, margin_x, title):
    y = _ensure_space(c, y, 11 * mm, width, height, margin_x)
    c.setFillColorRGB(0.96, 0.97, 0.98)
    c.rect(margin_x, y - 6 * mm, width - 2 * margin_x, 8 * mm, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x + 2 * mm, y - 3.5 * mm, title)
    return y - 10 * mm


def _nota_label(tipo):
    labels = {
        "alerta_tecnica": "Alerta tecnica",
        "interna": "Nota interna",
        "cliente": "Nota cliente",
        "recomendacion_futura": "Recomendacion futura",
    }
    return labels.get(tipo, str(tipo or "Nota").replace("_", " ").capitalize())


def generar_hoja_reparacion_taller_pdf(data: dict) -> bytes:
    orden = data["orden"]
    items = [item for item in data.get("items", []) if item.get("etapa") != "cancelado"]
    notas = data.get("notas", [])
    config = obtener_configuracion_negocio()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    set_pdf_metadata(c, f"Hoja de reparacion - OT #{orden.get('id')}")
    width, height = A4
    margin_x = 16 * mm
    y = height - 18 * mm

    if LOGO_HORIZONTAL.exists():
        _draw_image_fit(c, LOGO_HORIZONTAL, margin_x, y - 16 * mm, 64 * mm, 16 * mm)
    else:
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin_x, y, normalize_inline_text(config.get("nombre_negocio")).upper())

    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - margin_x, y, "HOJA DE REPARACION")
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "Uso interno de taller")
    y -= 7 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - margin_x, y, f"OT #{orden['id']}")
    y -= 5 * mm
    c.setFont("Helvetica", 8.5)
    c.drawRightString(width - margin_x, y, f"Impresa: {_fecha(datetime.now())}")
    y -= 10 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 8 * mm

    bicicleta_principal, bicicleta_detalle = _bicicleta_textos(orden)
    bicicleta = bicicleta_principal
    if bicicleta_detalle:
        bicicleta += f" - {bicicleta_detalle}"

    y = _draw_field_row(
        c,
        y,
        width,
        height,
        margin_x,
        [
            ("Cliente", orden.get("cliente_nombre") or "-"),
            ("Telefono", orden.get("cliente_telefono") or "-"),
            ("Estado", _estado_humano(orden.get("estado"))),
        ],
    )
    y = _draw_field_row(
        c,
        y,
        width,
        height,
        margin_x,
        [
            ("Bicicleta", bicicleta or "-"),
            ("N. de cuadro", orden.get("bicicleta_numero_cuadro") or "-"),
            ("Entrega estimada", _fecha(orden.get("fecha_prometida")) or "-"),
        ],
    )

    y = _draw_label_value(
        c,
        y,
        width,
        height,
        margin_x,
        "Problema reportado",
        orden.get("problema_reportado"),
        strong=True,
    )

    observaciones = _text(orden.get("observaciones")).strip()
    if observaciones:
        y = _draw_label_value(c, y, width, height, margin_x, "Observaciones", observaciones)

    y = _draw_section_title(c, y, width, height, margin_x, "Trabajos y repuestos a realizar")
    if items:
        for item in items:
            y = _draw_item(c, y, width, height, margin_x, item)
    else:
        y = _draw_label_value(
            c,
            y,
            width,
            height,
            margin_x,
            "Sin items cargados",
            "Usar esta hoja para diagnostico inicial y completar la OT en el sistema.",
        )

    if notas:
        y = _draw_section_title(c, y, width, height, margin_x, "Notas para el equipo")
        for nota in notas:
            contenido = collapse_repeated_words(nota.get("contenido")) or "-"
            y = _draw_label_value(
                c,
                y,
                width,
                height,
                margin_x,
                _nota_label(nota.get("tipo")),
                contenido,
            )

    y = _draw_section_title(c, y, width, height, margin_x, "Control final")
    y = _ensure_space(c, y, 32 * mm, width, height, margin_x)
    checks = [
        "Frenos",
        "Cambios",
        "Ruedas",
        "Ajuste general",
        "Limpieza basica",
        "Prueba final",
    ]
    x = margin_x
    for index, label in enumerate(checks):
        if index == 3:
            x = margin_x
            y -= 8 * mm
        _draw_checkbox(c, x, y, label)
        x += 45 * mm
    y -= 14 * mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin_x, y, "Firma / responsable:")
    c.line(margin_x + 31 * mm, y, margin_x + 82 * mm, y)
    c.drawString(margin_x + 95 * mm, y, "Fecha:")
    c.line(margin_x + 108 * mm, y, width - margin_x, y)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
