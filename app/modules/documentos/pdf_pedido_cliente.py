from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .brand import BROWN, ORANGE
from .pdf import _money, _text
from .pdf_layout import wrap_text
from .pdf_metadata import set_pdf_metadata


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def _format_date(value):
    if not value:
        return "-"
    try:
        return value.strftime("%d/%m/%Y %H:%M")
    except AttributeError:
        return str(value)


def _label_lista(value):
    return "Mayorista" if value == "mayorista" else "Minorista"


def _item_nombre(item):
    partes = [item.get("producto_nombre")]
    variante = item.get("nombre_variante")
    if variante and str(variante).strip().upper() not in {"UNICA", "ÚNICA"}:
        partes.append(variante)
    return " - ".join(str(parte) for parte in partes if parte)


def _item_codigo(item):
    return (
        item.get("sku")
        or item.get("codigo_barras")
        or item.get("codigo_proveedor")
        or f"VAR-{int(item.get('id_variante') or 0):08d}"
    )


def _item_precio(item, tipo_precio):
    if tipo_precio == "mayorista":
        return _dec(item.get("precio_mayorista"))
    if item.get("en_oferta") and item.get("precio_oferta") is not None:
        return _dec(item.get("precio_oferta"))
    return _dec(item.get("precio_minorista"))


def _format_percent(value):
    numero = _dec(value)
    texto = f"{numero:.4f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def _descuento_efectivo_transferencia(opciones_pago):
    contado = (opciones_pago or {}).get("contado") or []
    descuentos = [
        _dec(opcion.get("porcentaje_descuento"))
        for opcion in contado
        if opcion.get("medio_pago") in {"efectivo", "transferencia"}
    ]
    return max(descuentos) if descuentos else Decimal("0")


def _monto_con_descuento(precio, porcentaje_descuento):
    return _dec(precio) * (Decimal("1") - (_dec(porcentaje_descuento) / Decimal("100")))


def _draw_header(c, pedido, width, height, margin_x):
    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin_x, height - margin_x, "EMPRENDIMIENTO AGUS")
    c.setFillColorRGB(*ORANGE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin_x, height - margin_x - 6 * mm, "PEDIDO BORRADOR")

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - margin_x, height - margin_x, f"Pedido #{pedido.get('id')}")
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, height - margin_x - 5 * mm, _format_date(pedido.get("fecha_creacion")))

    c.setStrokeColorRGB(*ORANGE)
    c.setLineWidth(1.2)
    c.line(margin_x, height - margin_x - 12 * mm, width - margin_x, height - margin_x - 12 * mm)


def _draw_info_box(c, pedido, y, width, margin_x):
    box_h = 25 * mm
    c.setStrokeColorRGB(0.86, 0.89, 0.94)
    c.setFillColorRGB(1, 1, 1)
    c.roundRect(margin_x, y - box_h, width - 2 * margin_x, box_h, 4 * mm, stroke=1, fill=1)

    col_w = (width - 2 * margin_x) / 3
    labels = [
        ("Cliente", pedido.get("cliente_nombre") or "-"),
        ("Lista", _label_lista(pedido.get("tipo_precio"))),
        ("Total estimado", _money(pedido.get("total_estimado"))),
    ]

    for index, (label, value) in enumerate(labels):
        x = margin_x + 6 * mm + index * col_w
        c.setFillColorRGB(0.38, 0.45, 0.56)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x, y - 7 * mm, label.upper())
        c.setFillColorRGB(*BROWN)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x, y - 13 * mm, str(value)[:34])

    datos_cliente = " - ".join(
        dato
        for dato in [
            f"DNI {pedido.get('cliente_dni')}" if pedido.get("cliente_dni") else "",
            pedido.get("cliente_telefono") or "",
            pedido.get("sucursal_nombre") or "",
        ]
        if dato
    )
    if datos_cliente:
        c.setFillColorRGB(0.38, 0.45, 0.56)
        c.setFont("Helvetica", 8)
        c.drawString(margin_x + 6 * mm, y - 20 * mm, datos_cliente)

    return y - box_h - 8 * mm


def _draw_resumen_pago(c, pedido, y, width, margin_x):
    total = _dec(pedido.get("total_estimado"))
    descuento = _descuento_efectivo_transferencia(pedido.get("opciones_pago"))
    if descuento <= 0 or total <= 0:
        return y

    alto = 18 * mm
    x = width - margin_x - 78 * mm
    w = 78 * mm
    c.setFillColorRGB(1, 0.39, 0)
    c.setStrokeColorRGB(1, 0.39, 0)
    c.roundRect(x, y - alto, w, alto, 3 * mm, stroke=1, fill=1)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 4 * mm, y - 6 * mm, "EFECTIVO / TRANSFERENCIA")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 4 * mm, y - 12 * mm, f"{_format_percent(descuento)}% OFF")
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(x + w - 4 * mm, y - 11 * mm, _money(_monto_con_descuento(total, descuento)))

    return y - alto - 5 * mm


def _new_page(c, pedido, width, height, margin_x):
    c.showPage()
    _draw_header(c, pedido, width, height, margin_x)
    return height - margin_x - 22 * mm


def _draw_limited_lines(c, text, x, y, max_width, font_name, font_size, leading, max_lines):
    lines = wrap_text(text, max_width, font_name, font_size)[:max_lines]
    c.setFont(font_name, font_size)
    for index, line in enumerate(lines):
        c.drawString(x, y - index * leading, line)
    return lines


def generar_pedido_cliente_pdf(data: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin_x = 16 * mm
    set_pdf_metadata(c, f"Pedido borrador #{data.get('id')} - Emprendimiento Agus")

    pedido = data
    items = pedido.get("items") or []
    tipo_precio = pedido.get("tipo_precio")

    _draw_header(c, pedido, width, height, margin_x)
    y = height - margin_x - 21 * mm
    y = _draw_info_box(c, pedido, y, width, margin_x)

    if pedido.get("observaciones"):
        c.setFillColorRGB(1, 0.97, 0.93)
        c.setStrokeColorRGB(1, 0.72, 0.5)
        note_h = 14 * mm
        c.roundRect(margin_x, y - note_h, width - 2 * margin_x, note_h, 3 * mm, stroke=1, fill=1)
        c.setFillColorRGB(*BROWN)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin_x + 4 * mm, y - 5 * mm, "Observacion")
        c.setFont("Helvetica", 8)
        _draw_limited_lines(
            c,
            _text(pedido.get("observaciones")),
            margin_x + 4 * mm,
            y - 9 * mm,
            width - 2 * margin_x - 8 * mm,
            "Helvetica",
            8,
            leading=3.7 * mm,
            max_lines=2,
        )
        y -= note_h + 7 * mm

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, "Items del pedido")
    y -= 7 * mm

    headers = [("Producto", margin_x), ("Cant.", width - margin_x - 62 * mm), ("Unitario", width - margin_x - 39 * mm), ("Subtotal", width - margin_x)]
    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(0.28, 0.33, 0.42)
    c.line(margin_x, y + 3 * mm, width - margin_x, y + 3 * mm)
    for label, x in headers:
        if label == "Producto":
            c.drawString(x, y, label.upper())
        else:
            c.drawRightString(x, y, label.upper())
    y -= 5 * mm

    c.setFont("Helvetica", 8.5)
    for item in items:
        cantidad = _dec(item.get("cantidad"))
        precio = _item_precio(item, tipo_precio)
        subtotal = cantidad * precio
        nombre = _item_nombre(item)
        codigo = _item_codigo(item)
        nombre_lines = wrap_text(nombre, width - 2 * margin_x - 70 * mm, "Helvetica-Bold", 8.5)[:4]
        row_h = max(13 * mm, (len(nombre_lines) + 1) * 4.2 * mm + 5 * mm)

        if y - row_h < 24 * mm:
            y = _new_page(c, pedido, width, height, margin_x)
            c.setFont("Helvetica-Bold", 8)
            c.setFillColorRGB(0.28, 0.33, 0.42)
            c.drawString(margin_x, y, "PRODUCTO")
            c.drawRightString(width - margin_x - 62 * mm, y, "CANT.")
            c.drawRightString(width - margin_x - 39 * mm, y, "UNITARIO")
            c.drawRightString(width - margin_x, y, "SUBTOTAL")
            y -= 5 * mm

        c.setStrokeColorRGB(0.9, 0.92, 0.95)
        c.line(margin_x, y + 2 * mm, width - margin_x, y + 2 * mm)
        c.setFillColorRGB(*BROWN)
        c.setFont("Helvetica-Bold", 8.5)
        _draw_limited_lines(
            c,
            nombre,
            margin_x,
            y,
            width - 2 * margin_x - 70 * mm,
            "Helvetica-Bold",
            8.5,
            leading=3.8 * mm,
            max_lines=4,
        )
        c.setFillColorRGB(0.38, 0.45, 0.56)
        c.setFont("Helvetica", 8)
        c.drawString(margin_x, y - (len(nombre_lines) * 3.8 * mm), codigo)

        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(width - margin_x - 62 * mm, y, f"{cantidad:g}")
        c.drawRightString(width - margin_x - 39 * mm, y, _money(precio))
        c.drawRightString(width - margin_x, y, _money(subtotal))
        y -= row_h

    y -= 2 * mm
    c.setStrokeColorRGB(*ORANGE)
    c.line(width - margin_x - 65 * mm, y, width - margin_x, y)
    y -= 7 * mm
    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - margin_x - 32 * mm, y, "Total estimado")
    c.setFillColorRGB(*ORANGE)
    c.drawRightString(width - margin_x, y, _money(pedido.get("total_estimado")))
    y -= 8 * mm
    _draw_resumen_pago(c, pedido, y, width, margin_x)

    c.setFillColorRGB(0.38, 0.45, 0.56)
    c.setFont("Helvetica", 8)
    c.drawString(margin_x, 14 * mm, "Pedido sujeto a disponibilidad y confirmacion al momento de la venta.")
    c.save()

    pdf = buffer.getvalue()
    buffer.close()
    return pdf
