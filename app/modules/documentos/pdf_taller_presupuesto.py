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
    _resolver_imagen_local,
    _text,
)
from app.modules.configuracion_negocio.service import obtener_configuracion_negocio
from app.modules.configuracion_negocio.template import lineas_configurables


ESTADOS_HUMANOS = {
    "ingresada": "Ingresada",
    "presupuestada": "Presupuestada",
    "esperando_aprobacion": "Esperando aprobación",
    "esperando_repuestos": "Esperando repuestos",
    "en_reparacion": "En reparación",
    "terminada": "Terminada",
    "facturada": "Facturada",
    "lista_para_retirar": "Lista para retirar",
    "retirada": "Retirada",
    "cancelada": "Cancelada",
}


def _estado_humano(estado: str | None) -> str:
    if not estado:
        return "-"
    return ESTADOS_HUMANOS.get(estado, str(estado).replace("_", " ").capitalize())


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


def _line(c, y, width, margin_x):
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    return y - 6 * mm


def _label_value(c, x, y, label, value, value_x=None, max_chars=70):
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y, label)
    c.setFont("Helvetica", 9)
    c.drawString(value_x or (x + 28 * mm), y, _text(value)[:max_chars])
    return y - 5.5 * mm


def _wrap_text(text, max_chars=70):
    text = _text(text).strip()
    if not text:
        return [""]

    words = text.split()
    lines = []
    current = ""

    for word in words:
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
    c.drawString(margin_x, y, "Img.")
    c.drawString(margin_x + 19 * mm, y, "Detalle")
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


def _draw_row(c, *, y, width, margin_x, detalle, cantidad, precio, subtotal, imagen=None):
    lines = _wrap_text(detalle, 58)[:4]
    line_height = 4.6 * mm
    row_padding_top = 1.5 * mm
    row_padding_bottom = 3.2 * mm
    img_size = 14 * mm
    row_height = max(17 * mm, row_padding_top + len(lines) * line_height + row_padding_bottom)

    text_y = y - row_padding_top
    img_path = _resolver_imagen_local(imagen)

    if img_path:
        _draw_image_fit(
            c,
            img_path,
            margin_x,
            y - img_size + 1 * mm,
            img_size,
            img_size,
        )
    else:
        c.setFont("Helvetica", 6)
        c.drawCentredString(margin_x + img_size / 2, y - 7 * mm, "Sin img.")

    c.setFont("Helvetica", 8)
    for line in lines:
        c.drawString(margin_x + 19 * mm, text_y, line)
        text_y -= line_height

    c.drawRightString(width - margin_x - 52 * mm, y - row_padding_top, f"{cantidad:g}")
    c.drawRightString(width - margin_x - 24 * mm, y - row_padding_top, _money(precio))
    c.drawRightString(width - margin_x, y - row_padding_top, _money(subtotal))

    y -= row_height
    c.setLineWidth(0.2)
    c.line(margin_x, y, width - margin_x, y)
    return y - 3 * mm


def generar_presupuesto_taller_pdf(data: dict) -> bytes:
    orden = data["orden"]
    items = data.get("items", [])
    config = obtener_configuracion_negocio()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin_x = 16 * mm

    _draw_watermark(c, width, height)

    y = height - 18 * mm

    if LOGO_HORIZONTAL.exists():
        _draw_image_fit(
            c,
            LOGO_HORIZONTAL,
            margin_x,
            y - 17 * mm,
            68 * mm,
            17 * mm,
        )
    else:
        c.setFont("Helvetica-Bold", 15)
        c.drawString(margin_x, y, _text(config.get("nombre_negocio")).upper()[:40])

    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - margin_x, y, "PRESUPUESTO TALLER")

    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "NO FISCAL")

    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, f"Orden de taller #{orden['id']}")

    y -= 5 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, f"Fecha: {_fecha(datetime.now())}")

    y -= 12 * mm
    y = _line(c, y, width, margin_x)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Datos del cliente y bicicleta")
    y -= 8 * mm

    left_x = margin_x
    right_x = width / 2 + 3 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "Cliente:")
    c.setFont("Helvetica", 9)
    c.drawString(left_x + 24 * mm, y, _text(orden.get("cliente_nombre"))[:42])

    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x, y, "Teléfono:")
    c.setFont("Helvetica", 9)
    c.drawString(right_x + 31 * mm, y, _text(orden.get("cliente_telefono"))[:26])
    y -= 6 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "DNI:")
    c.setFont("Helvetica", 9)
    c.drawString(left_x + 24 * mm, y, _text(orden.get("cliente_dni"))[:30])

    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x, y, "Estado:")
    c.setFont("Helvetica", 9)
    c.drawString(right_x + 31 * mm, y, _estado_humano(orden.get("estado"))[:30])
    y -= 6 * mm

    responsable = orden.get("tecnico_nombre") or orden.get("usuario_creador_nombre") or "-"
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "Responsable:")
    c.setFont("Helvetica", 9)
    c.drawString(left_x + 24 * mm, y, _text(responsable)[:42])

    if orden.get("fecha_prometida"):
        c.setFont("Helvetica-Bold", 9)
        c.drawString(right_x, y, "Entrega estimada:")
        c.setFont("Helvetica", 9)
        c.drawString(right_x + 31 * mm, y, _fecha(orden.get("fecha_prometida"))[:30])
    y -= 6 * mm

    y = _label_value(c, left_x, y, "Bicicleta:", orden.get("bicicleta_descripcion"), left_x + 24 * mm, 95)

    if orden.get("bicicleta_numero_cuadro"):
        y = _label_value(c, left_x, y, "N° cuadro:", orden.get("bicicleta_numero_cuadro"), left_x + 24 * mm, 60)

    y -= 3 * mm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "Problema:")
    c.setFont("Helvetica", 9)
    problem_lines = _wrap_text(orden.get("problema_reportado"), 95)
    first = True
    for line in problem_lines[:3]:
        c.drawString(left_x + (24 * mm if first else 0), y, line)
        first = False
        y -= 5 * mm

    observaciones = _text(orden.get("observaciones")).strip()
    if observaciones:
        y -= 1 * mm
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left_x, y, "Observaciones:")
        c.setFont("Helvetica", 9)
        obs_lines = _wrap_text(observaciones, 95)
        first = True
        for line in obs_lines[:3]:
            c.drawString(left_x + (24 * mm if first else 0), y, line)
            first = False
            y -= 5 * mm

    y -= 5 * mm
    y = _line(c, y, width, margin_x)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Detalle presupuestado")
    y -= 8 * mm
    y = _table_header(c, y, width, margin_x)

    total = Decimal("0")

    for item in items:
        cantidad = Decimal(str(item.get("cantidad") or 0))
        precio = Decimal(str(item.get("precio_unitario") or 0))
        subtotal = Decimal(str(item.get("subtotal") or 0))
        total += subtotal

        lines_count = len(_wrap_text(item.get("descripcion_snapshot"), 58)[:4])
        needed = max(17 * mm, 1.5 * mm + lines_count * 4.6 * mm + 3.2 * mm) + 8 * mm
        y = _ensure_space(c, y, needed, width, height, margin_x)

        y = _draw_row(
            c,
            y=y,
            width=width,
            margin_x=margin_x,
            detalle=item.get("descripcion_snapshot"),
            cantidad=cantidad,
            precio=precio,
            subtotal=subtotal,
            imagen=item.get("imagen_principal"),
        )

    y = _ensure_space(c, y, 38 * mm, width, height, margin_x)
    y -= 2 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - margin_x - 30 * mm, y, "TOTAL")
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(width - margin_x, y, _money(total))

    y -= 14 * mm
    y = _line(c, y, width, margin_x)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Condiciones")
    y -= 6 * mm

    condiciones = lineas_configurables(
        config.get("condiciones_presupuesto_taller"),
        config,
    )

    c.setFont("Helvetica", 8)
    for condicion in condiciones:
        for line in _wrap_text(condicion, 105):
            c.drawString(margin_x, y, f"- {line}")
            y -= 5 * mm

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()

    y -= 8 * mm
    c.setFont("Helvetica", 8)
    c.drawString(margin_x, y, "Firma/Conformidad del cliente: ______________________________")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
