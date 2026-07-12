from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .pdf import _draw_image_fit, _money, _resolver_imagen_local, _text
from .pdf_layout import wrap_text
from .brand import (
    BORDER,
    BROWN,
    INK,
    MUTED,
    ORANGE,
    ORANGE_DARK,
    ORANGE_SOFT,
    PAPER,
)


CENTAVOS = Decimal("0.01")
PESOS = Decimal("1")


def _clip(value, max_len):
    text = _text(value).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _titulo_bicicleta(item):
    marca = _text(item.get("marca_nombre")).strip()
    producto = _text(item.get("producto_nombre")).strip()
    variante = item.get("nombre_variante")
    base = producto
    if marca and marca.lower() not in producto.lower():
        base = f"{marca} {producto}".strip()
    return " - ".join(_text(part) for part in [base, variante] if part)


def _detalles_bicicleta(item):
    parts = [
        f"Rodado {item.get('rodado')}" if item.get("rodado") else None,
        f"Talle {item.get('talle')}" if item.get("talle") else None,
        item.get("color"),
        item.get("tipo_bicicleta"),
        item.get("material_cuadro"),
    ]
    return " | ".join(_text(part) for part in parts if part)


def _dec(value):
    return Decimal(str(value or 0))


def _round_money(value):
    return _dec(value).quantize(CENTAVOS, rounding=ROUND_HALF_UP)


def _money_entero(value):
    value = _dec(value).quantize(PESOS, rounding=ROUND_HALF_UP)
    return f"$ {value:,.0f}".replace(",", ".")


def _format_percent(value):
    numero = _dec(value).normalize()
    texto = format(numero, "f")
    if "." in texto:
        texto = texto.rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def _monto_con_descuento(precio, porcentaje_descuento):
    return _round_money(_dec(precio) * (Decimal("1") - (_dec(porcentaje_descuento) / Decimal("100"))))


def _monto_con_recargo(precio, porcentaje_recargo):
    return _round_money(_dec(precio) * (Decimal("1") + (_dec(porcentaje_recargo) / Decimal("100"))))


def _draw_opciones_pago(c, item, opciones_pago, x, y, w):
    precio = _dec(item.get("precio_minorista"))
    contado = (opciones_pago or {}).get("contado") or []
    tarjeta = (opciones_pago or {}).get("tarjeta") or []

    if precio <= 0 or (not contado and not tarjeta):
        return

    c.setFillColorRGB(*ORANGE_SOFT)
    c.roundRect(x, y, w, 24 * mm, 3 * mm, fill=1, stroke=0)

    text_y = y + 18.5 * mm
    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawString(x + 3 * mm, text_y, "Opciones de pago")

    text_y -= 4 * mm
    c.setFont("Helvetica", 6.5)
    c.setFillColorRGB(*INK)

    contado_por_descuento = {}
    for opcion in contado:
        descuento = _dec(opcion.get("porcentaje_descuento"))
        contado_por_descuento.setdefault(descuento, []).append(opcion.get("label"))

    lineas = []
    for descuento, labels in contado_por_descuento.items():
        labels_set = {label.lower() for label in labels}
        if {"efectivo", "transferencia"}.issubset(labels_set):
            label = "Efectivo/Transferencia"
        else:
            label = " / ".join(labels)
        descuento_texto = f"{_format_percent(descuento)}% OFF" if descuento > 0 else ""
        lineas.append({
            "label": label,
            "badge": descuento_texto,
            "monto": _money_entero(_monto_con_descuento(precio, descuento)),
        })

    for plan in sorted(tarjeta, key=lambda p: (p.get("cuotas") or 1, p.get("label") or ""))[:4]:
        cuotas = int(plan.get("cuotas") or 1)
        total = _monto_con_recargo(precio, plan.get("porcentaje_recargo"))
        if cuotas > 1:
            cuota = _round_money(total / Decimal(cuotas))
            lineas.append({
                "label": f"{cuotas} cuotas",
                "badge": "",
                "monto": f"{cuotas} x {_money_entero(cuota)}",
            })
        else:
            lineas.append({
                "label": plan.get("label") or "Tarjeta 1 cuota",
                "badge": "",
                "monto": _money_entero(total),
            })

    for linea in lineas[:4]:
        c.drawString(x + 3 * mm, text_y, _clip(linea["label"], 24))
        if linea.get("badge"):
            c.setFillColorRGB(*ORANGE_DARK)
            c.setFont("Helvetica-Bold", 6.4)
            c.drawRightString(x + w - 25 * mm, text_y, linea["badge"])
            c.setFillColorRGB(*INK)
            c.setFont("Helvetica", 6.5)
        c.drawRightString(x + w - 3 * mm, text_y, linea["monto"])
        text_y -= 3.4 * mm


def _draw_cover(c, fecha_actualizacion: datetime):
    width, height = A4
    margin = 22 * mm

    c.setFillColorRGB(*PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(margin, height - 72 * mm, "Catálogo de Bicicletas")

    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, height - 86 * mm, "Emprendimiento Agus")

    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 11)
    c.drawString(
        margin,
        height - 104 * mm,
        f"Actualizado al {fecha_actualizacion.strftime('%d/%m/%Y')}",
    )

    c.setStrokeColorRGB(*ORANGE)
    c.setLineWidth(1.5)
    c.line(margin, height - 116 * mm, width - margin, height - 116 * mm)

    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 10)
    c.drawString(
        margin,
        height - 130 * mm,
        "Precios sujetos a disponibilidad y modificación sin previo aviso.",
    )

    c.setFont("Helvetica", 8.5)
    c.drawString(margin, 24 * mm, "Catálogo para compartir con clientes por WhatsApp.")


def _draw_header(c, page_number):
    width, height = A4
    margin = 14 * mm

    c.setFillColorRGB(*BROWN)
    c.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, height - 11.5 * mm, "Catálogo de Bicicletas - Emprendimiento Agus")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, height - 11.5 * mm, f"Pag. {page_number}")
    c.setFillColorRGB(*ORANGE)
    c.rect(0, height - 18.8 * mm, width, 0.8 * mm, fill=1, stroke=0)


def _draw_footer(c):
    width, _height = A4
    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(
        width / 2,
        9 * mm,
        "Disponibilidad sujeta a confirmación.",
    )


def _draw_card(c, item, opciones_pago, x, y, w, h):
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(*BORDER)
    c.roundRect(x, y, w, h, 4 * mm, fill=1, stroke=1)

    image_box_h = 42 * mm
    image_path = _resolver_imagen_local(item.get("imagen_principal"))
    if image_path:
        _draw_image_fit(c, image_path, x + 4 * mm, y + h - image_box_h - 4 * mm, w - 8 * mm, image_box_h)
    else:
        c.setFillColorRGB(*ORANGE_SOFT)
        c.roundRect(x + 4 * mm, y + h - image_box_h - 4 * mm, w - 8 * mm, image_box_h, 3 * mm, fill=1, stroke=0)
        c.setFillColorRGB(*MUTED)
        c.setFont("Helvetica", 8)
        c.drawCentredString(x + w / 2, y + h - 29 * mm, "Sin imagen")

    text_y = y + h - image_box_h - 9 * mm
    text_width = w - 8 * mm
    c.setFillColorRGB(*INK)
    title_size = 8.8
    title = _titulo_bicicleta(item)
    title_lines = wrap_text(title, text_width, "Helvetica-Bold", title_size)
    while len(title_lines) > 3 and title_size > 7:
        title_size -= 0.3
        title_lines = wrap_text(title, text_width, "Helvetica-Bold", title_size)
    c.setFont("Helvetica-Bold", title_size)
    for line in title_lines:
        c.drawString(x + 4 * mm, text_y, line)
        text_y -= (title_size + 1.4) * 0.3528 * mm

    detalles = _detalles_bicicleta(item)
    if detalles:
        text_y -= 0.8 * mm
        detail_size = 7.1
        detail_lines = wrap_text(detalles, text_width, "Helvetica", detail_size)
        while len(detail_lines) > 2 and detail_size > 6.2:
            detail_size -= 0.25
            detail_lines = wrap_text(detalles, text_width, "Helvetica", detail_size)
        c.setFont("Helvetica", detail_size)
        c.setFillColorRGB(*MUTED)
        for line in detail_lines:
            c.drawString(x + 4 * mm, text_y, line)
            text_y -= (detail_size + 1.3) * 0.3528 * mm

    codigo = item.get("sku") or item.get("codigo_proveedor")
    if codigo:
        text_y -= 0.6 * mm
        c.setFont("Helvetica", 6.8)
        c.drawString(x + 4 * mm, text_y, _clip(f"Cod. {codigo}", 42))

    _draw_opciones_pago(c, item, opciones_pago, x + 4 * mm, y + 13 * mm, w - 8 * mm)

    c.setFillColorRGB(*ORANGE_DARK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x + 4 * mm, y + 7 * mm, _money(item.get("precio_minorista")))

    c.setFillColorRGB(*ORANGE_DARK)
    c.setFont("Helvetica-Bold", 7)
    c.drawRightString(x + w - 4 * mm, y + 7.7 * mm, "Disponible")


def generar_catalogo_bicicletas_pdf(data: dict) -> bytes:
    items = data.get("items") or []
    opciones_pago = data.get("opciones_pago") or {}
    fecha_actualizacion = data.get("fecha_actualizacion") or datetime.now()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    _draw_cover(c, fecha_actualizacion)
    c.showPage()

    margin_x = 14 * mm
    gap_x = 7 * mm
    gap_y = 8 * mm
    card_w = (width - margin_x * 2 - gap_x) / 2
    card_h = 112 * mm
    start_y = height - 24 * mm - card_h

    page_number = 1
    _draw_header(c, page_number)

    if not items:
        c.setFillColorRGB(*INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width / 2, height / 2, "No hay bicicletas disponibles.")
        _draw_footer(c)
    else:
        for index, item in enumerate(items):
            position = index % 4

            if index and position == 0:
                _draw_footer(c)
                c.showPage()
                page_number += 1
                _draw_header(c, page_number)

            row = position // 2
            col = position % 2
            x = margin_x + col * (card_w + gap_x)
            y = start_y - row * (card_h + gap_y)
            _draw_card(c, item, opciones_pago, x, y, card_w, card_h)

        _draw_footer(c)

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
