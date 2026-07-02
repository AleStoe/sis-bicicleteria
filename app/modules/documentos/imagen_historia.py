from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

from .pdf import _resolver_imagen_local, _text
from .pdf_etiquetas import (
    _build_opciones_pago,
    _label_title,
    _variant_parts,
)
from .brand import (
    BORDER_HEX,
    BROWN_HEX,
    INK_HEX,
    MUTED_HEX,
    ORANGE_HEX,
    ORANGE_SOFT_HEX,
    PAPER_HEX,
)


STORY_SIZE = (1080, 1920)
NAVY = BROWN_HEX
GREEN = ORANGE_HEX
GREEN_SOFT = ORANGE_SOFT_HEX
INK = INK_HEX
MUTED = MUTED_HEX
BORDER = BORDER_HEX
BACKGROUND = PAPER_HEX


def _font(size: int, bold: bool = False):
    nombres = (
        ["arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"]
        if bold
        else ["arial.ttf", "Arial.ttf", "DejaVuSans.ttf"]
    )
    carpetas = [
        Path("C:/Windows/Fonts"),
        Path("/usr/share/fonts/truetype/dejavu"),
    ]

    for nombre in nombres:
        for carpeta in carpetas:
            path = carpeta / nombre
            if path.exists():
                return ImageFont.truetype(str(path), size=size)
        try:
            return ImageFont.truetype(nombre, size=size)
        except OSError:
            continue

    return ImageFont.load_default()


def _text_width(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def _wrap(draw, text, font, max_width):
    words = _text(text).strip().split()
    if not words:
        return []

    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or _text_width(draw, candidate, font) <= max_width:
            current = candidate
            continue
        lines.append(current)
        current = word

    if current:
        lines.append(current)
    return lines


def _fit_lines(draw, text, max_width, max_lines, start_size, min_size, bold=True):
    for size in range(start_size, min_size - 1, -2):
        font = _font(size, bold=bold)
        lines = _wrap(draw, text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines

    font = _font(min_size, bold=bold)
    lines = _wrap(draw, text, font, max_width)
    if len(lines) <= max_lines:
        return font, lines

    visible = lines[:max_lines]
    last = visible[-1]
    while last and _text_width(draw, f"{last}…", font) > max_width:
        last = last[:-1].rstrip()
    visible[-1] = f"{last}…"
    return font, visible


def _draw_lines(draw, lines, xy, font, fill, spacing):
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += spacing
    return y


def _prepare_product_image(path):
    with Image.open(path) as source:
        image = source.convert("RGBA")
        white = Image.new("RGBA", image.size, "white")
        white.alpha_composite(image)
        rgb = white.convert("RGB")

        difference = ImageChops.difference(rgb, Image.new("RGB", rgb.size, "white")).convert("L")
        bbox = difference.point(lambda pixel: 255 if pixel > 12 else 0).getbbox()
        if bbox:
            pad_x = max(8, int((bbox[2] - bbox[0]) * 0.035))
            pad_y = max(8, int((bbox[3] - bbox[1]) * 0.035))
            rgb = rgb.crop(
                (
                    max(0, bbox[0] - pad_x),
                    max(0, bbox[1] - pad_y),
                    min(rgb.width, bbox[2] + pad_x),
                    min(rgb.height, bbox[3] + pad_y),
                )
            )
        return rgb


def _draw_product(draw, canvas, path, box):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=28, fill="white", outline=BORDER, width=2)

    if not path:
        label = "IMAGEN NO DISPONIBLE"
        font = _font(34, bold=True)
        text_box = draw.textbbox((0, 0), label, font=font)
        draw.text(
            (
                (STORY_SIZE[0] - (text_box[2] - text_box[0])) / 2,
                (y1 + y2 - (text_box[3] - text_box[1])) / 2,
            ),
            label,
            font=font,
            fill=MUTED,
        )
        return

    try:
        product = _prepare_product_image(path)
        max_size = (x2 - x1 - 64, y2 - y1 - 64)
        product.thumbnail(max_size, Image.Resampling.LANCZOS)
        paste_x = int(x1 + (x2 - x1 - product.width) / 2)
        paste_y = int(y1 + (y2 - y1 - product.height) / 2)
        canvas.paste(product, (paste_x, paste_y))
    except Exception:
        _draw_product(draw, canvas, None, box)


def _draw_price_row(draw, label, amount, y, *, badge=""):
    draw.text((92, y), label, font=_font(30, bold=True), fill=INK)
    if badge:
        badge_font = _font(24, bold=True)
        badge_width = _text_width(draw, badge, badge_font) + 34
        draw.rounded_rectangle(
            (430, y - 4, 430 + badge_width, y + 39),
            radius=18,
            fill=GREEN_SOFT,
        )
        draw.text((447, y + 2), badge, font=badge_font, fill=GREEN)
    amount_font, amount_lines = _fit_lines(
        draw,
        amount,
        max_width=390,
        max_lines=1,
        start_size=36,
        min_size=27,
    )
    amount_width = _text_width(draw, amount_lines[0], amount_font)
    draw.text((988 - amount_width, y - 5), amount_lines[0], font=amount_font, fill=INK)


def generar_historia_precio_png(data: dict) -> bytes:
    item = data["item"]
    opciones_pago = data.get("opciones_pago") or {}
    canvas = Image.new("RGB", STORY_SIZE, BACKGROUND)
    draw = ImageDraw.Draw(canvas)

    draw.rectangle((0, 0, STORY_SIZE[0], 26), fill=GREEN)
    draw.text((70, 62), "EMPRENDIMIENTO AGUS", font=_font(36, bold=True), fill=NAVY)
    draw.text((70, 111), "PRECIO DEL PRODUCTO", font=_font(22, bold=True), fill=GREEN)

    title = _text(_label_title(item)).upper()
    title_font, title_lines = _fit_lines(
        draw,
        title,
        max_width=940,
        max_lines=3,
        start_size=58,
        min_size=38,
    )
    title_bottom = _draw_lines(
        draw,
        title_lines,
        (70, 155),
        title_font,
        NAVY,
        int(title_font.size * 1.08),
    )

    variante = _variant_parts(item)
    variant_bottom = title_bottom
    if variante:
        variant_font, variant_lines = _fit_lines(
            draw,
            variante,
            max_width=940,
            max_lines=2,
            start_size=30,
            min_size=23,
            bold=False,
        )
        variant_bottom = _draw_lines(
            draw,
            variant_lines,
            (72, title_bottom + 8),
            variant_font,
            MUTED,
            int(variant_font.size * 1.2),
        )

    image_top = max(330, variant_bottom + 24)
    image_bottom = 1105
    image_path = _resolver_imagen_local(item.get("imagen_principal"))
    _draw_product(draw, canvas, image_path, (60, image_top, 1020, image_bottom))

    lineas = _build_opciones_pago(item.get("precio_minorista"), opciones_pago)
    lista = next((linea for linea in lineas if linea["tipo"] == "lista"), None)
    efectivo = next((linea for linea in lineas if linea["tipo"] == "efectivo"), None)
    tarjetas = [linea for linea in lineas if linea["tipo"] == "tarjeta"]

    panel_top = 1145
    draw.rounded_rectangle(
        (60, panel_top, 1020, 1345),
        radius=28,
        fill="white",
        outline=BORDER,
        width=2,
    )
    draw.text((92, panel_top + 28), "PRECIO DE LISTA", font=_font(25, bold=True), fill=MUTED)
    lista_amount = lista["monto"] if lista else "$ 0"
    lista_font, lista_lines = _fit_lines(
        draw,
        lista_amount,
        max_width=850,
        max_lines=1,
        start_size=76,
        min_size=52,
    )
    draw.text((92, panel_top + 72), lista_lines[0], font=lista_font, fill=NAVY)

    next_top = 1375
    if efectivo:
        draw.rounded_rectangle((60, next_top, 1020, 1585), radius=28, fill=GREEN)
        draw.text(
            (92, next_top + 28),
            "EFECTIVO / TRANSFERENCIA",
            font=_font(28, bold=True),
            fill="white",
        )
        draw.text(
            (92, next_top + 75),
            efectivo["badge"],
            font=_font(38, bold=True),
            fill="#FFE1CC",
        )
        efectivo_font, efectivo_lines = _fit_lines(
            draw,
            efectivo["monto"],
            max_width=500,
            max_lines=1,
            start_size=72,
            min_size=48,
        )
        amount_width = _text_width(draw, efectivo_lines[0], efectivo_font)
        draw.text(
            (988 - amount_width, next_top + 73),
            efectivo_lines[0],
            font=efectivo_font,
            fill="white",
        )
        cards_top = 1620
    else:
        cards_top = 1390

    if tarjetas:
        cards_bottom = min(1810, cards_top + 155)
        draw.rounded_rectangle(
            (60, cards_top, 1020, cards_bottom),
            radius=24,
            fill="white",
            outline=BORDER,
            width=2,
        )
        row_y = cards_top + 31
        for linea in tarjetas[:2]:
            _draw_price_row(
                draw,
                linea["label"],
                linea["monto"].replace(" x ", " cuotas de "),
                row_y,
            )
            row_y += 61

    draw.text(
        (60, 1850),
        "Precios sujetos a disponibilidad y modificación.",
        font=_font(22),
        fill=MUTED,
    )

    buffer = BytesIO()
    canvas.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
