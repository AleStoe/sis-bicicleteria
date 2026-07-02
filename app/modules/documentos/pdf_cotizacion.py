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
from .pdf_layout import (
    collapse_repeated_words,
    draw_wrapped_text,
    wrap_text,
)
from app.modules.configuracion_negocio.service import obtener_configuracion_negocio


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


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def _label_tipo_precio(tipo_precio):
    return "Mayorista" if tipo_precio == "mayorista" else "Minorista"


def _format_percent(value):
    numero = _dec(value)
    return f"{numero.normalize():f}".rstrip("0").rstrip(".")


def _monto_con_descuento(precio, porcentaje_descuento):
    return _dec(precio) * (Decimal("1") - (_dec(porcentaje_descuento) / Decimal("100")))


def _monto_con_recargo(precio, porcentaje_recargo):
    return _dec(precio) * (Decimal("1") + (_dec(porcentaje_recargo) / Decimal("100")))


def _build_opciones_pago(precio, opciones_pago):
    precio = _dec(precio)
    if precio <= 0:
        return []

    contado = (opciones_pago or {}).get("contado") or []
    tarjeta = (opciones_pago or {}).get("tarjeta") or []
    lineas = []

    descuentos = [
        _dec(opcion.get("porcentaje_descuento"))
        for opcion in contado
        if opcion.get("medio_pago") in {"efectivo", "transferencia"}
    ]
    if descuentos:
        descuento_contado = max(descuentos)
        label = "Contado / Transferencia"
        if descuento_contado > 0:
            label = f"{label} ({_format_percent(descuento_contado)}% OFF)"
        lineas.append((label, _money(_monto_con_descuento(precio, descuento_contado))))

    for plan in sorted(tarjeta, key=lambda p: (p.get("cuotas") or 1, p.get("label") or ""))[:4]:
        cuotas = int(plan.get("cuotas") or 1)
        total = _monto_con_recargo(precio, plan.get("porcentaje_recargo"))
        if cuotas > 1:
            cuota = total / Decimal(cuotas)
            monto = f"{cuotas} cuotas de {_money(cuota)}"
        else:
            monto = _money(total)
        lineas.append((plan.get("label") or f"Tarjeta {cuotas} cuota", monto))

    return lineas


def _draw_opciones_pago(c, *, y, width, margin_x, cotizacion, opciones_pago):
    opciones = _build_opciones_pago(cotizacion.get("total_final"), opciones_pago)
    if not opciones:
        return y

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Opciones de pago")
    y -= 5 * mm

    c.setFont("Helvetica", 9)
    for label, monto in opciones[:5]:
        c.drawString(margin_x, y, label)
        c.drawRightString(width - margin_x, y, monto)
        y -= 5 * mm

    return y - 2 * mm


def _draw_info_pair(c, *, y, width, margin_x, left, right):
    gap = 8 * mm
    column_width = (width - 2 * margin_x - gap) / 2
    right_x = margin_x + column_width + gap
    left_lines = wrap_text(left[1], column_width, "Helvetica", 9)
    right_lines = wrap_text(right[1], column_width, "Helvetica", 9)
    line_count = max(len(left_lines), len(right_lines))

    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColorRGB(0.32, 0.36, 0.43)
    c.drawString(margin_x, y, left[0].upper())
    c.drawString(right_x, y, right[0].upper())
    c.setFillColorRGB(0, 0, 0)
    value_y = y - 4.3 * mm
    c.setFont("Helvetica", 9)

    for index, line in enumerate(left_lines):
        c.drawString(margin_x, value_y - index * 4.2 * mm, line)
    for index, line in enumerate(right_lines):
        c.drawString(right_x, value_y - index * 4.2 * mm, line)

    return y - 4.3 * mm - line_count * 4.2 * mm - 2 * mm


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


def _ensure_space(
    c,
    y,
    needed,
    width,
    height,
    margin_x,
    repeat_table_header=True,
):
    if y - needed >= 18 * mm:
        return y
    c.showPage()
    _draw_watermark(c, width, height)
    y = height - 18 * mm
    if repeat_table_header:
        return _table_header(c, y, width, margin_x)
    return y


def _draw_row(c, *, y, width, margin_x, item):
    detalle = collapse_repeated_words(item.get("descripcion_snapshot"))
    detail_width = width - (2 * margin_x) - 58 * mm
    lines = wrap_text(detalle, detail_width, "Helvetica", 8)
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
    opciones_pago = data.get("opciones_pago")
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

    y = _draw_info_pair(
        c,
        y=y,
        width=width,
        margin_x=margin_x,
        left=("Cliente", collapse_repeated_words(cliente)),
        right=(
            "Estado",
            _text(cotizacion.get("estado")).replace("_", " ").capitalize(),
        ),
    )
    y = _draw_info_pair(
        c,
        y=y,
        width=width,
        margin_x=margin_x,
        left=(
            "Sucursal",
            collapse_repeated_words(cotizacion.get("sucursal_nombre")),
        ),
        right=(
            "Lista aplicada",
            _label_tipo_precio(cotizacion.get("tipo_precio")),
        ),
    )

    if cotizacion.get("fecha_validez"):
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Validez:")
        c.setFont("Helvetica", 10)
        c.drawString(margin_x + 24 * mm, y, _fecha(cotizacion.get("fecha_validez"))[:20])
        y -= 6 * mm

    if cotizacion.get("problema_reportado"):
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Consulta:")
        y -= 5 * mm
        y = draw_wrapped_text(
            c,
            cotizacion.get("problema_reportado"),
            x=margin_x + 3 * mm,
            y=y,
            max_width=width - 2 * margin_x - 3 * mm,
            font_name="Helvetica",
            font_size=9,
            leading=4.5 * mm,
        )

    if cotizacion.get("observaciones"):
        y -= 1 * mm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Notas:")
        y -= 5 * mm
        y = draw_wrapped_text(
            c,
            cotizacion.get("observaciones"),
            x=margin_x + 3 * mm,
            y=y,
            max_width=width - 2 * margin_x - 3 * mm,
            font_name="Helvetica",
            font_size=9,
            leading=4.5 * mm,
        )

    y -= 5 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Detalle cotizado")
    y -= 8 * mm
    y = _table_header(c, y, width, margin_x)

    for item in items:
        detail_width = width - (2 * margin_x) - 58 * mm
        lines_count = len(
            wrap_text(
                collapse_repeated_words(item.get("descripcion_snapshot")),
                detail_width,
                "Helvetica",
                8,
            )
        )
        needed = max(
            10 * mm,
            1.5 * mm + lines_count * 4.6 * mm + 3.2 * mm,
        ) + 4 * mm
        y = _ensure_space(c, y, needed, width, height, margin_x)
        y = _draw_row(c, y=y, width=width, margin_x=margin_x, item=item)

    y = _ensure_space(
        c,
        y,
        80 * mm,
        width,
        height,
        margin_x,
        repeat_table_header=False,
    )
    y -= 2 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x - 34 * mm, y, "Subtotal")
    c.drawRightString(width - margin_x, y, _money(cotizacion.get("subtotal")))
    y -= 6 * mm
    c.drawRightString(width - margin_x - 34 * mm, y, "Descuento")
    c.drawRightString(width - margin_x, y, f"- {_money(cotizacion.get('descuento_total'))}")
    y -= 6 * mm
    c.drawRightString(width - margin_x - 34 * mm, y, "Financiacion")
    c.drawRightString(width - margin_x, y, f"+ {_money(cotizacion.get('recargo_total'))}")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(width - margin_x - 34 * mm, y, "TOTAL")
    c.drawRightString(width - margin_x, y, _money(cotizacion.get("total_final")))

    y -= 11 * mm
    y = _draw_opciones_pago(
        c,
        y=y,
        width=width,
        margin_x=margin_x,
        cotizacion=cotizacion,
        opciones_pago=opciones_pago,
    )

    y -= 5 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    y -= 7 * mm
    c.setFont("Helvetica", 8)
    condiciones = [
        "Esta cotización no implica una venta ni reserva de mercadería.",
        "Los precios están sujetos a disponibilidad de stock y vigencia indicada.",
    ]
    for condicion in condiciones:
        y = draw_wrapped_text(
            c,
            f"- {condicion}",
            x=margin_x,
            y=y,
            max_width=width - 2 * margin_x,
            font_name="Helvetica",
            font_size=8,
            leading=4.5 * mm,
        )

    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2, 12 * mm, f"{config.get('nombre_negocio')} - Documento interno")

    c.showPage()
    c.save()
    return buffer.getvalue()
