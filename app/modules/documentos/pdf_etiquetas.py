from io import BytesIO

from reportlab.graphics.barcode.code128 import Code128
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .pdf import _draw_image_fit, _money, _resolver_imagen_local, _text


LABEL_80X40 = (80 * mm, 40 * mm)


def _clip(value, max_len):
    text = _text(value).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _label_title(item):
    marca = item.get("marca_nombre")
    producto = item.get("producto_nombre")
    if marca and marca.lower() not in _text(producto).lower():
        return f"{marca} {producto}"
    return producto


def _variant_parts(item):
    parts = [
        item.get("nombre_variante"),
        f"Rod. {item.get('rodado')}" if item.get("rodado") else None,
        f"Talle {item.get('talle')}" if item.get("talle") else None,
        item.get("color"),
    ]
    return " · ".join(_text(part) for part in parts if part)


def _barcode_value(tipo: str, item: dict):
    if tipo == "bicicleta":
        return item.get("numero_cuadro") or f"BICI-{item.get('id_bicicleta')}"

    return (
        item.get("codigo_barras")
        or item.get("sku")
        or item.get("codigo_proveedor")
        or f"VAR-{item.get('id_variante')}"
    )


def _draw_deposito_page(c, item: dict, tipo: str):
    width, height = LABEL_80X40
    margin = 3 * mm
    y = height - margin - 4 * mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin, y, _clip(_label_title(item), 30))

    y -= 4.2 * mm
    c.setFont("Helvetica", 6.7)
    c.drawString(margin, y, _clip(_variant_parts(item), 42))

    y -= 4.2 * mm
    c.setFont("Helvetica-Bold", 6.8)
    if tipo == "bicicleta":
        c.drawString(margin, y, _clip(f"Cuadro: {item.get('numero_cuadro')}", 36))
    else:
        c.drawString(margin, y, _clip(f"SKU: {item.get('sku') or item.get('codigo_proveedor') or '-'}", 36))

    y -= 4 * mm
    c.setFont("Helvetica", 6.6)
    if tipo == "bicicleta":
        ubicacion = item.get("sucursal_nombre") or "-"
        c.drawString(margin, y, _clip(f"{item.get('estado')} · {ubicacion}", 42))
    else:
        disponible = item.get("stock_disponible_total")
        c.drawString(margin, y, f"Stock disp.: {_text(disponible or 0)}")

    value = _barcode_value(tipo, item)
    barcode = Code128(_text(value), barHeight=8 * mm, barWidth=0.36 * mm)
    barcode_x = margin
    barcode_y = 4.5 * mm
    barcode.drawOn(c, barcode_x, barcode_y)

    c.setFont("Helvetica", 6)
    c.drawRightString(width - margin, 3 * mm, _clip(value, 28))


def generar_etiqueta_deposito_pdf(data: dict, copias: int = 1) -> bytes:
    item = data["item"]
    tipo = data["tipo"]
    copias = max(1, min(int(copias or 1), 50))

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=LABEL_80X40)

    for index in range(copias):
        if index:
            c.showPage()
        _draw_deposito_page(c, item, tipo)

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def generar_cartel_precio_a4_pdf(data: dict) -> bytes:
    item = data["item"]
    tipo = data["tipo"]

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 18 * mm

    c.setFont("Helvetica-Bold", 13)
    c.drawString(margin, height - 18 * mm, "Emprendimiento Agus")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, height - 18 * mm, "Precio para mostrador")

    image_path = _resolver_imagen_local(item.get("imagen_principal"))
    if image_path:
        _draw_image_fit(
            c,
            image_path,
            width - margin - 65 * mm,
            height - 92 * mm,
            65 * mm,
            58 * mm,
        )

    y = height - 45 * mm
    c.setFont("Helvetica-Bold", 28)
    c.drawString(margin, y, _clip(_label_title(item), 28))

    y -= 12 * mm
    c.setFont("Helvetica", 16)
    c.drawString(margin, y, _clip(_variant_parts(item), 48))

    if tipo == "bicicleta":
        y -= 10 * mm
        c.setFont("Helvetica-Bold", 13)
        c.drawString(margin, y, _clip(f"Cuadro: {item.get('numero_cuadro')}", 60))

    y = height / 2 - 8 * mm
    c.setFont("Helvetica-Bold", 56)
    c.drawString(margin, y, _money(item.get("precio_minorista")))

    y -= 14 * mm
    c.setFont("Helvetica", 12)
    datos = [
        item.get("categoria_nombre"),
        f"Rodado {item.get('rodado')}" if item.get("rodado") else None,
        item.get("material_cuadro"),
        f"Cod. {item.get('sku') or item.get('codigo_proveedor') or item.get('codigo_barras')}"
        if (item.get("sku") or item.get("codigo_proveedor") or item.get("codigo_barras"))
        else None,
    ]
    c.drawString(margin, y, _clip(" · ".join(_text(d) for d in datos if d), 90))

    c.setLineWidth(0.4)
    c.line(margin, 30 * mm, width - margin, 30 * mm)
    c.setFont("Helvetica", 9)
    c.drawString(margin, 22 * mm, "Precio sujeto a modificaciones. Documento interno no fiscal.")

    value = _barcode_value(tipo, item)
    barcode = Code128(_text(value), barHeight=14 * mm, barWidth=0.42 * mm)
    barcode.drawOn(c, width - margin - 70 * mm, 18 * mm)
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, 12 * mm, _clip(value, 40))

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
