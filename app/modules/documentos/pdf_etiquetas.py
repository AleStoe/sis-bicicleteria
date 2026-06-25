from io import BytesIO
from decimal import Decimal, ROUND_HALF_UP

from reportlab.graphics.barcode.code128 import Code128
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .pdf import _draw_image_fit, _money, _resolver_imagen_local, _text


LABEL_80X40 = (80 * mm, 40 * mm)
CENTAVOS = Decimal("0.01")
PESOS = Decimal("1")


def _clip(value, max_len):
    text = _text(value).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _fit_font_size(c, text, font_name, max_width, start_size, min_size):
    size = start_size
    while size > min_size and c.stringWidth(text, font_name, size) > max_width:
        size -= 0.5
    return max(size, min_size)


def _wrap_text(c, text, font_name, font_size, max_width, max_lines=2):
    words = _text(text).strip().split()
    if not words:
        return []

    lines = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()
        if c.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
            continue

        if current:
            lines.append(current)
            current = word
        else:
            lines.append(word)
            current = ""

        if len(lines) == max_lines:
            break

    if current and len(lines) < max_lines:
        lines.append(current)

    return lines


def _draw_wrapped_text(c, text, x, y, max_width, font_name, font_size, leading, max_lines=2):
    lines = _wrap_text(c, text, font_name, font_size, max_width, max_lines=max_lines)
    c.setFont(font_name, font_size)
    for index, line in enumerate(lines):
        c.drawString(x, y - index * leading, line)
    return y - len(lines) * leading


def _label_title(item):
    marca = item.get("marca_nombre")
    producto = _text(item.get("producto_nombre")).strip()
    if marca and marca.lower() not in producto.lower():
        partes = producto.split()
        if len(partes) >= 2:
            return " ".join([partes[0], _text(marca), *partes[1:]])
        return f"{producto} {marca}".strip()
    return producto


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


def _variant_parts(item):
    nombre_variante = _text(item.get("nombre_variante")).strip()
    base_busqueda = nombre_variante.upper()
    parts = [nombre_variante]

    rodado = _text(item.get("rodado")).strip()
    if rodado and rodado.upper() not in base_busqueda and f"R{rodado}".upper() not in base_busqueda:
        parts.append(f"Rod. {rodado}")

    talle = _text(item.get("talle")).strip()
    if talle and f"TALLE {talle}".upper() not in base_busqueda:
        parts.append(f"Talle {talle}")

    color = _text(item.get("color")).strip()
    if color and color.upper() not in base_busqueda:
        parts.append(color)

    return " - ".join(_text(part) for part in parts if part)


def _barcode_value(tipo: str, item: dict):
    if tipo == "bicicleta":
        return (
            item.get("codigo_barras")
            or item.get("numero_cuadro")
            or f"BICI-{item.get('id_bicicleta')}"
        )

    return (
        item.get("codigo_barras")
        or item.get("sku")
        or item.get("codigo_proveedor")
        or f"VAR-{item.get('id_variante')}"
    )


def _titulo_etiqueta(item):
    return " ".join(
        part
        for part in [_label_title(item), _variant_parts(item)]
        if _text(part).strip()
    ).upper()


def _draw_deposito_page(c, item: dict, tipo: str):
    width, height = LABEL_80X40
    margin = 4 * mm
    content_width = width - margin * 2

    # Etiqueta de deposito: nombre + variante completa + codigo de barras.
    # No se imprime la marca del local para no perder espacio util.
    # _titulo_etiqueta ya incluye datos importantes como talle, color y rodado
    # cuando no vienen dentro del nombre de la variante.
    titulo = _titulo_etiqueta(item)
    font_size = 10.4
    while font_size > 6.4 and len(_wrap_text(c, titulo, "Helvetica-Bold", font_size, content_width, max_lines=3)) > 3:
        font_size -= 0.3

    _draw_wrapped_text(
        c,
        titulo,
        margin,
        height - 6 * mm,
        content_width,
        "Helvetica-Bold",
        font_size,
        4.4 * mm,
        max_lines=3,
    )

    value = _text(_barcode_value(tipo, item)).strip()
    barcode_width = min(content_width, 60 * mm)
    bar_width = max(0.22 * mm, min(0.38 * mm, barcode_width / max(len(value or "0") * 11, 1)))
    barcode = Code128(value, barHeight=9 * mm, barWidth=bar_width)
    barcode.drawOn(c, (width - barcode.width) / 2, 7.5 * mm)

    c.setFont("Helvetica-Bold", 7.4)
    c.drawCentredString(width / 2, 4.4 * mm, value)

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


def _draw_info_grid(c, item, tipo, margin, width):
    datos = [
        ("Categoria", item.get("categoria_nombre")),
        ("Rodado", item.get("rodado")),
        ("Talle", item.get("talle")),
        ("Color", item.get("color")),
        ("Material", item.get("material_cuadro")),
        ("Tipo", item.get("tipo_bicicleta")),
        ("Cuadro", item.get("numero_cuadro") if tipo == "bicicleta" else None),
        ("Codigo", item.get("sku") or item.get("codigo_proveedor") or item.get("codigo_barras")),
    ]
    info = [(label, _text(value)) for label, value in datos if _text(value).strip()]
    if not info:
        return 78 * mm

    # En A4 no alcanza el alto para una grilla de 2 columnas + opciones de pago.
    # La pasamos a 4 columnas y 2 filas para mantener talle/color/rodado sin pisar pagos.
    usable_width = width - margin * 2
    col_width = usable_width / 4
    row_y = 77 * mm
    min_y = row_y

    for index, (label, value) in enumerate(info[:8]):
        col = index % 4
        row = index // 4
        x = margin + col * col_width
        y = row_y - row * 11 * mm
        min_y = min(min_y, y)

        c.setFont("Helvetica-Bold", 7.2)
        c.drawString(x, y, f"{label.upper()}")
        c.setFont("Helvetica", 8.8)
        c.drawString(x, y - 4.2 * mm, _clip(value, 20))

    return min_y - 8 * mm

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
    descuento_contado = max(descuentos) if descuentos else Decimal("0")
    if descuento_contado > 0:
        lineas.append(
            {
                "label": "Efectivo / Transferencia",
                "badge": f"{_format_percent(descuento_contado)}% OFF",
                "monto": _money_entero(_monto_con_descuento(precio, descuento_contado)),
            }
        )

    for plan in sorted(tarjeta, key=lambda p: (p.get("cuotas") or 1, p.get("label") or ""))[:4]:
        cuotas = int(plan.get("cuotas") or 1)
        total = _monto_con_recargo(precio, plan.get("porcentaje_recargo"))
        if cuotas > 1:
            cuota = _round_money(total / Decimal(cuotas))
            monto = f"{cuotas} cuotas de {_money_entero(cuota)}"
        else:
            monto = _money_entero(total)

        lineas.append(
            {
                "label": plan.get("label") or f"Tarjeta {cuotas} cuota",
                "badge": "",
                "monto": monto,
            }
        )

    return lineas


def _draw_opciones_pago_a4(c, item, opciones_pago, x, y, w):
    lineas = _build_opciones_pago(item.get("precio_minorista"), opciones_pago)
    if not lineas:
        return

    h = 30 * mm
    c.setFillColorRGB(0.94, 0.98, 0.96)
    c.roundRect(x, y, w, h, 4 * mm, fill=1, stroke=0)

    c.setFillColorRGB(0.03, 0.21, 0.15)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(x + 4 * mm, y + h - 7 * mm, "Opciones de pago")

    text_y = y + h - 13 * mm
    for linea in lineas[:4]:
        c.setFillColorRGB(0.08, 0.17, 0.14)
        c.setFont("Helvetica-Bold", 8.2)
        c.drawString(x + 4 * mm, text_y, _clip(linea["label"], 24))

        monto_x = x + w - 4 * mm
        if linea.get("badge"):
            c.setFillColorRGB(0.0, 0.45, 0.29)
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(monto_x - 31 * mm, text_y, linea["badge"])

        c.setFillColorRGB(0.02, 0.12, 0.11)
        c.setFont("Helvetica-Bold", 8.4)
        c.drawRightString(monto_x, text_y, linea["monto"])
        text_y -= 5 * mm

    c.setFillColorRGB(0, 0, 0)


def generar_cartel_precio_a4_pdf(data: dict) -> bytes:
    item = data["item"]
    tipo = data["tipo"]
    opciones_pago = data.get("opciones_pago") or {}

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 17 * mm
    usable_width = width - margin * 2

    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, height - 14 * mm, "Precio para mostrador")

    title = _text(_label_title(item)).upper()
    title_size = _fit_font_size(c, title, "Helvetica-Bold", usable_width, 31, 20)
    y = _draw_wrapped_text(
        c,
        title,
        margin,
        height - 22 * mm,
        usable_width,
        "Helvetica-Bold",
        title_size,
        title_size * 0.48 * mm,
        max_lines=2,
    )

    variante = _variant_parts(item)
    if variante:
        _draw_wrapped_text(
            c,
            variante,
            margin,
            y - 1 * mm,
            usable_width,
            "Helvetica",
            13,
            6 * mm,
            max_lines=2,
        )

    image_path = _resolver_imagen_local(item.get("imagen_principal"))
    image_box_y = height - 145 * mm
    if image_path:
        _draw_image_fit(
            c,
            image_path,
            margin + 16 * mm,
            image_box_y,
            usable_width - 32 * mm,
            78 * mm,
        )
    else:
        c.setStrokeColorRGB(0.82, 0.86, 0.91)
        c.roundRect(margin + 16 * mm, image_box_y, usable_width - 32 * mm, 78 * mm, 8, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(width / 2, image_box_y + 40 * mm, "IMAGEN NO DISPONIBLE")
        c.setStrokeColorRGB(0, 0, 0)

    price_text = _money(item.get("precio_minorista"))
    price_size = _fit_font_size(c, price_text, "Helvetica-Bold", usable_width, 54, 40)
    c.setFont("Helvetica-Bold", price_size)
    c.drawString(margin, 93 * mm, price_text)

    c.setLineWidth(0.8)
    c.line(margin, 84 * mm, width - margin, 84 * mm)
    info_bottom_y = _draw_info_grid(c, item, tipo, margin, width)
    opciones_y = min(31 * mm, info_bottom_y - 31 * mm)
    opciones_y = max(27 * mm, opciones_y)
    _draw_opciones_pago_a4(c, item, opciones_pago, margin, opciones_y, usable_width)

    c.setLineWidth(0.4)
    c.line(margin, 24 * mm, width - margin, 24 * mm)
    c.setFont("Helvetica", 8)
    c.drawString(margin, 17 * mm, "Precio sujeto a modificaciones. Documento interno no fiscal.")

    value = _text(_barcode_value(tipo, item)).strip()
    barcode = Code128(value, barHeight=15 * mm, barWidth=0.48 * mm)
    barcode_x = width - margin - min(barcode.width, 78 * mm)
    if barcode.width > 78 * mm:
        barcode = Code128(value, barHeight=17 * mm, barWidth=0.38 * mm)
        barcode_x = width - margin - barcode.width
    barcode.drawOn(c, barcode_x, 5 * mm)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawCentredString(barcode_x + barcode.width / 2, 2 * mm, _clip(value, 42))

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
