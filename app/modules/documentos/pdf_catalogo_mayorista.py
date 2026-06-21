from datetime import datetime
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .pdf import _draw_image_fit, _money, _resolver_imagen_local, _text


def _clip(value, max_len):
    text = _text(value).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _variant_title(item):
    parts = [item.get("producto_nombre"), item.get("nombre_variante")]
    return " - ".join(_text(part) for part in parts if part)


def _codigo(item):
    return item.get("sku") or item.get("codigo_proveedor")


def _draw_cover(c, fecha_actualizacion: datetime):
    width, height = A4
    margin = 22 * mm

    c.setFillColorRGB(0.05, 0.08, 0.16)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(margin, height - 72 * mm, "Catálogo Mayorista")

    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, height - 86 * mm, "Emprendimiento Agus")

    c.setFont("Helvetica", 11)
    c.drawString(
        margin,
        height - 104 * mm,
        f"Actualizado al {fecha_actualizacion.strftime('%d/%m/%Y')}",
    )

    c.setStrokeColorRGB(0.25, 0.75, 0.55)
    c.setLineWidth(1.5)
    c.line(margin, height - 116 * mm, width - margin, height - 116 * mm)

    c.setFont("Helvetica", 10)
    c.drawString(
        margin,
        height - 130 * mm,
        "Precios sujetos a disponibilidad y modificacion sin previo aviso.",
    )

    c.setFont("Helvetica", 8.5)
    c.drawString(margin, 24 * mm, "Catálogo para envío mayorista por WhatsApp.")


def _draw_header(c, page_number):
    width, height = A4
    margin = 14 * mm

    c.setFillColorRGB(0.05, 0.08, 0.16)
    c.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, height - 11.5 * mm, "Catálogo Mayorista - Emprendimiento Agus")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, height - 11.5 * mm, f"Pag. {page_number}")


def _draw_footer(c):
    width, _height = A4
    margin = 14 * mm
    c.setFillColorRGB(0.35, 0.39, 0.47)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(
        width / 2,
        9 * mm,
        "No incluye stock numerico. Consultar disponibilidad al momento de la compra.",
    )


def _draw_product_card(c, item, x, y, w, h):
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(0.84, 0.87, 0.91)
    c.roundRect(x, y, w, h, 4 * mm, fill=1, stroke=1)

    image_box_h = 34 * mm
    image_path = _resolver_imagen_local(item.get("imagen_principal"))
    if image_path:
        _draw_image_fit(c, image_path, x + 4 * mm, y + h - image_box_h - 4 * mm, w - 8 * mm, image_box_h)
    else:
        c.setFillColorRGB(0.96, 0.97, 0.98)
        c.roundRect(x + 4 * mm, y + h - image_box_h - 4 * mm, w - 8 * mm, image_box_h, 3 * mm, fill=1, stroke=0)
        c.setFillColorRGB(0.48, 0.54, 0.62)
        c.setFont("Helvetica", 8)
        c.drawCentredString(x + w / 2, y + h - 23 * mm, "Sin imagen")

    text_y = y + h - image_box_h - 10 * mm
    c.setFillColorRGB(0.05, 0.08, 0.16)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x + 4 * mm, text_y, _clip(_variant_title(item), 36))

    text_y -= 4.2 * mm
    c.setFont("Helvetica", 7.2)
    c.setFillColorRGB(0.35, 0.39, 0.47)
    meta = " | ".join(
        _text(value)
        for value in [item.get("marca_nombre"), item.get("categoria_nombre")]
        if value
    )
    c.drawString(x + 4 * mm, text_y, _clip(meta or "Sin marca", 42))

    codigo = _codigo(item)
    if codigo:
        text_y -= 3.8 * mm
        c.setFont("Helvetica", 6.8)
        c.drawString(x + 4 * mm, text_y, _clip(f"Cod. {codigo}", 42))

    c.setFillColorRGB(0.0, 0.45, 0.28)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + 4 * mm, y + 8 * mm, _money(item.get("precio_mayorista")))

    c.setFillColorRGB(0.08, 0.47, 0.31)
    c.setFont("Helvetica-Bold", 7)
    c.drawRightString(x + w - 4 * mm, y + 8.5 * mm, "Disponible")


def generar_catalogo_mayorista_pdf(data: dict) -> bytes:
    items = data.get("items") or []
    fecha_actualizacion = data.get("fecha_actualizacion") or datetime.now()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    _draw_cover(c, fecha_actualizacion)
    c.showPage()

    margin_x = 14 * mm
    gap_x = 6 * mm
    gap_y = 7 * mm
    card_w = (width - margin_x * 2 - gap_x) / 2
    card_h = 72 * mm
    start_y = height - 24 * mm - card_h

    page_number = 1
    _draw_header(c, page_number)

    if not items:
        c.setFillColorRGB(0.05, 0.08, 0.16)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width / 2, height / 2, "No hay productos mayoristas disponibles.")
        _draw_footer(c)
    else:
        for index, item in enumerate(items):
            position = index % 6

            if index and position == 0:
                _draw_footer(c)
                c.showPage()
                page_number += 1
                _draw_header(c, page_number)

            row = position // 2
            col = position % 2
            x = margin_x + col * (card_w + gap_x)
            y = start_y - row * (card_h + gap_y)
            _draw_product_card(c, item, x, y, card_w, card_h)

        _draw_footer(c)

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
