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
        return

    usable_width = width - margin * 2
    col_width = usable_width / 4
    row_y = 46 * mm

    for index, (label, value) in enumerate(info[:8]):
        col = index % 4
        row = index // 4
        x = margin + col * col_width
        y = row_y - row * 12 * mm
        value_width = col_width - 4 * mm

        c.setFont("Helvetica-Bold", 6.8)
        c.drawString(x, y, f"{label.upper()}")
        value_size = _fit_font_size(
            c,
            value,
            "Helvetica",
            value_width,
            8.6,
            6.4,
        )
        _draw_wrapped_text(
            c,
            value,
            x,
            y - 3.8 * mm,
            value_width,
            "Helvetica",
            value_size,
            3.2 * mm,
            max_lines=2,
        )

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
                "tipo": "efectivo",
                "label": "Precio efectivo / transferencia",
                "badge": f"{_format_percent(descuento_contado)}% OFF",
                "monto": _money_entero(_monto_con_descuento(precio, descuento_contado)),
            }
        )

    lineas.append(
        {
            "tipo": "lista",
            "label": "Precio de lista",
            "badge": "",
            "monto": _money_entero(precio),
        }
    )

    planes_visibles = [
        plan for plan in tarjeta
        if int(plan.get("cuotas") or 1) in {3, 6}
    ]
    for plan in sorted(
        planes_visibles,
        key=lambda p: (p.get("cuotas") or 1, p.get("label") or ""),
    ):
        cuotas = int(plan.get("cuotas") or 1)
        total = _monto_con_recargo(precio, plan.get("porcentaje_recargo"))
        cuota = _round_money(total / Decimal(cuotas))
        monto = f"{cuotas} x {_money_entero(cuota)}"

        lineas.append(
            {
                "tipo": "tarjeta",
                "label": f"Tarjeta {cuotas} cuotas",
                "badge": "",
                "monto": monto,
            }
        )

    return lineas


def _draw_opciones_pago_a4(c, item, opciones_pago, x, y, w):
    lineas = _build_opciones_pago(item.get("precio_minorista"), opciones_pago)
    if not lineas:
        return

    c.setFillColorRGB(0.15, 0.19, 0.23)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x, y + 43 * mm, "OPCIONES DE PAGO")

    efectivo = next(
        (linea for linea in lineas if linea["tipo"] == "efectivo"),
        None,
    )
    otras = [linea for linea in lineas if linea["tipo"] != "efectivo"]

    panel_h = 39 * mm
    c.setStrokeColorRGB(0.82, 0.85, 0.88)
    c.setLineWidth(0.5)
    c.roundRect(x, y, w, panel_h, 3 * mm, fill=0, stroke=1)

    row_top = y + panel_h
    if efectivo:
        promo_h = 18 * mm
        c.setFillColorRGB(0.91, 0.98, 0.94)
        c.roundRect(x, row_top - promo_h, w, promo_h, 3 * mm, fill=1, stroke=0)

        c.setFillColorRGB(0.0, 0.43, 0.25)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 5 * mm, row_top - 6 * mm, efectivo["badge"])
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x + 5 * mm, row_top - 12 * mm, "PRECIO EFECTIVO")

        efectivo_size = _fit_font_size(
            c,
            efectivo["monto"],
            "Helvetica-Bold",
            w * 0.48,
            25,
            18,
        )
        c.setFont("Helvetica-Bold", efectivo_size)
        c.drawRightString(x + w - 5 * mm, row_top - 12 * mm, efectivo["monto"])
        row_top -= promo_h

    available_h = row_top - y
    row_h = available_h / max(len(otras), 1)
    for index, linea in enumerate(otras):
        row_y = row_top - row_h * index
        if index:
            c.setStrokeColorRGB(0.89, 0.91, 0.93)
            c.line(x + 4 * mm, row_y, x + w - 4 * mm, row_y)

        baseline = row_y - row_h * 0.68
        c.setFillColorRGB(0.16, 0.19, 0.23)
        c.setFont("Helvetica-Bold", 8.4)
        c.drawString(x + 5 * mm, baseline, linea["label"])
        c.setFont("Helvetica-Bold", 9.2)
        c.drawRightString(x + w - 5 * mm, baseline, linea["monto"])

    c.setFillColorRGB(0, 0, 0)
    c.setStrokeColorRGB(0, 0, 0)


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
    title_bottom = _draw_wrapped_text(
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
    content_bottom = title_bottom
    if variante:
        content_bottom = _draw_wrapped_text(
            c,
            variante,
            margin,
            title_bottom - 1 * mm,
            usable_width,
            "Helvetica",
            13,
            6 * mm,
            max_lines=2,
        )

    image_path = _resolver_imagen_local(item.get("imagen_principal"))
    image_box_top = min(height - 48 * mm, content_bottom - 3 * mm)
    image_box_h = 108 * mm
    image_box_y = image_box_top - image_box_h
    if image_path:
        _draw_image_fit(
            c,
            image_path,
            margin,
            image_box_y,
            usable_width,
            image_box_h,
        )
    else:
        c.setStrokeColorRGB(0.82, 0.86, 0.91)
        c.roundRect(margin, image_box_y, usable_width, image_box_h, 8, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(width / 2, image_box_y + 53 * mm, "IMAGEN NO DISPONIBLE")
        c.setStrokeColorRGB(0, 0, 0)

    price_text = _money(item.get("precio_minorista"))
    price_size = _fit_font_size(c, price_text, "Helvetica-Bold", usable_width, 54, 40)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin, 130 * mm, "PRECIO DE LISTA")
    c.setFont("Helvetica-Bold", price_size)
    c.drawString(margin, 107 * mm, price_text)

    _draw_opciones_pago_a4(c, item, opciones_pago, margin, 54 * mm, usable_width)
    _draw_info_grid(c, item, tipo, margin, width)

    value = _text(_barcode_value(tipo, item)).strip()
    barcode_max_width = 72 * mm
    bar_width = max(
        0.22 * mm,
        min(0.42 * mm, barcode_max_width / max(len(value or "0") * 11, 1)),
    )
    barcode = Code128(value, barHeight=12 * mm, barWidth=bar_width)
    barcode_x = width - margin - barcode.width
    barcode.drawOn(c, barcode_x, 7 * mm)

    code_size = _fit_font_size(
        c,
        value,
        "Helvetica-Bold",
        barcode.width,
        7.2,
        5.5,
    )
    c.setFont("Helvetica-Bold", code_size)
    c.drawCentredString(barcode_x + barcode.width / 2, 3.5 * mm, value)

    c.setFont("Helvetica", 7.2)
    c.drawString(margin, 9 * mm, "Precio sujeto a modificaciones.")
    c.drawString(margin, 5.5 * mm, "Documento interno no fiscal.")

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
