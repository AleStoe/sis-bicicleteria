from datetime import datetime
from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.modules.documentos import imagen_historia
from app.modules.documentos.pdf import _draw_image_fit, _money, _text
from app.modules.documentos.pdf_catalogo_bicicletas import (
    generar_catalogo_bicicletas_pdf,
)
from app.modules.documentos.pdf_catalogo_mayorista import (
    generar_catalogo_mayorista_pdf as generar_catalogo_mayorista_productivo,
)
from app.modules.documentos.pdf_etiquetas import _build_opciones_pago
from app.modules.documentos.pdf_etiquetas import generar_cartel_precio_a4_pdf


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "prototypes"
OUTPUT.mkdir(parents=True, exist_ok=True)

ORANGE = (1.0, 0.39, 0.0)
ORANGE_DARK = (0.78, 0.25, 0.0)
ORANGE_SOFT = (1.0, 0.95, 0.91)
BROWN = (0.14, 0.065, 0.035)
INK = (0.08, 0.07, 0.06)
MUTED = (0.39, 0.35, 0.32)
BORDER = (0.86, 0.82, 0.79)
PAPER = (0.98, 0.97, 0.96)


BIKE_IMAGE = (
    ROOT
    / "uploads"
    / "catalogo"
    / "[1010973] BICICLETA MTB TOPMEGA SUNSHINE ALUMINIO R29_ 21VEL SHIMANO TOURNEY VERDE TALLE L.png"
)
AXLE_IMAGE = ROOT / "uploads" / "catalogo" / "[1001473] EJE TRASERO HUECO P-CIERRE AX01.jpg"
CASSETTE_IMAGE = ROOT / "uploads" / "catalogo" / "MF-TZ500-7.webp"


PAYMENT_OPTIONS = {
    "contado": [
        {
            "medio_pago": "efectivo",
            "label": "Efectivo",
            "porcentaje_descuento": 10,
        },
        {
            "medio_pago": "transferencia",
            "label": "Transferencia",
            "porcentaje_descuento": 10,
        },
    ],
    "tarjeta": [
        {"label": "Tarjeta 3 cuotas", "cuotas": 3, "porcentaje_recargo": 15},
        {"label": "Tarjeta 6 cuotas", "cuotas": 6, "porcentaje_recargo": 35},
    ],
}


def generar_story():
    # Mismo layout productivo; sólo se sustituye la paleta para validar identidad.
    imagen_historia.NAVY = "#24110A"
    imagen_historia.GREEN = "#FF6400"
    imagen_historia.GREEN_SOFT = "#FFF0E6"
    imagen_historia.INK = "#17110E"
    imagen_historia.MUTED = "#655A54"
    imagen_historia.BORDER = "#DED2CA"
    imagen_historia.BACKGROUND = "#F8F5F2"

    data = {
        "item": {
            "producto_nombre": "BICICLETA MTB TOPMEGA SUNSHINE ALUMINIO R29 21V",
            "marca_nombre": "TOPMEGA",
            "nombre_variante": "TALLE L - VERDE/NEGRO",
            "rodado": "29",
            "talle": "L",
            "color": "VERDE/NEGRO",
            "precio_minorista": 274444,
            "imagen_principal": str(BIKE_IMAGE),
        },
        "opciones_pago": PAYMENT_OPTIONS,
    }
    output = OUTPUT / "Sprint2-Prototipo-Story-Identidad.png"
    output.write_bytes(imagen_historia.generar_historia_precio_png(data))
    return output


def _clip(value, max_len):
    text = _text(value).strip()
    return text if len(text) <= max_len else text[: max_len - 3].rstrip() + "..."


def _variant_title(item):
    return " - ".join(
        _text(part)
        for part in [item.get("producto_nombre"), item.get("nombre_variante")]
        if part
    )


def _draw_header(c, page_number):
    width, height = A4
    margin = 14 * mm
    c.setFillColorRGB(*BROWN)
    c.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, height - 11.5 * mm, "Catálogo Mayorista - Emprendimiento Agus")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin, height - 11.5 * mm, f"Pág. {page_number}")
    c.setFillColorRGB(*ORANGE)
    c.rect(0, height - 18.8 * mm, width, 0.8 * mm, fill=1, stroke=0)


def _draw_footer(c):
    width, _ = A4
    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(
        width / 2,
        9 * mm,
        "Disponibilidad sujeta a confirmación al momento de la compra.",
    )


def _draw_card(c, item, x, y, w, h):
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(*BORDER)
    c.roundRect(x, y, w, h, 4 * mm, fill=1, stroke=1)

    image_h = 27 * mm
    image_path = item.get("imagen_principal")
    if image_path:
        _draw_image_fit(
            c,
            image_path,
            x + 4 * mm,
            y + h - image_h - 3.5 * mm,
            w - 8 * mm,
            image_h,
        )

    text_y = y + h - image_h - 8 * mm
    c.setFillColorRGB(*INK)
    c.setFont("Helvetica-Bold", 8.2)
    c.drawString(x + 4 * mm, text_y, _clip(_variant_title(item), 37))

    text_y -= 3.8 * mm
    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 6.8)
    meta = " | ".join(
        _text(value)
        for value in [item.get("marca_nombre"), item.get("categoria_nombre")]
        if value
    )
    c.drawString(x + 4 * mm, text_y, _clip(meta, 43))

    text_y -= 3.4 * mm
    c.drawString(x + 4 * mm, text_y, f"Cod. {item.get('sku')}")
    c.setFillColorRGB(*ORANGE_DARK)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawRightString(x + w - 4 * mm, text_y, "Disponible")

    block_y = y + 3.5 * mm
    block_h = 21.5 * mm
    c.setFillColorRGB(*ORANGE_SOFT)
    c.roundRect(
        x + 3 * mm,
        block_y,
        w - 6 * mm,
        block_h,
        2.5 * mm,
        fill=1,
        stroke=0,
    )

    price = item.get("precio_mayorista")
    lines = _build_opciones_pago(price, PAYMENT_OPTIONS)
    cash = next((line for line in lines if line["tipo"] == "efectivo"), None)
    cards = [line for line in lines if line["tipo"] == "tarjeta"]

    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica-Bold", 5.8)
    c.drawString(x + 5 * mm, block_y + 17.2 * mm, "PRECIO MAYORISTA")
    c.setFillColorRGB(*ORANGE_DARK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + 5 * mm, block_y + 11.8 * mm, _money(price))

    c.setStrokeColorRGB(*BORDER)
    c.line(
        x + 5 * mm,
        block_y + 9.3 * mm,
        x + w - 5 * mm,
        block_y + 9.3 * mm,
    )
    c.setFillColorRGB(*INK)
    c.setFont("Helvetica-Bold", 6.2)
    if cash:
        c.drawString(
            x + 5 * mm,
            block_y + 6.3 * mm,
            f"EFECTIVO / TRANSFERENCIA  {cash['badge']}",
        )
        c.drawRightString(x + w - 5 * mm, block_y + 6.3 * mm, cash["monto"])

    c.setFont("Helvetica", 5.7)
    if cards:
        c.drawString(x + 5 * mm, block_y + 3.2 * mm, cards[0]["label"])
        c.drawRightString(x + w - 5 * mm, block_y + 3.2 * mm, cards[0]["monto"])
    if len(cards) > 1:
        c.drawString(x + 5 * mm, block_y + 0.7 * mm, cards[1]["label"])
        c.drawRightString(x + w - 5 * mm, block_y + 0.7 * mm, cards[1]["monto"])


def generar_catalogo():
    samples = [
        {
            "producto_nombre": "BICICLETA MTB TOPMEGA SUNSHINE R29",
            "nombre_variante": "TALLE L - VERDE/NEGRO",
            "marca_nombre": "TOPMEGA",
            "categoria_nombre": "BICICLETAS",
            "sku": "BIC-TOP-SUN29",
            "precio_mayorista": 274444,
            "imagen_principal": str(BIKE_IMAGE),
        },
        {
            "producto_nombre": "EJE TRASERO HUECO PARA CIERRE",
            "nombre_variante": "ÚNICA",
            "marca_nombre": "TOPMEGA",
            "categoria_nombre": "TRANSMISIÓN",
            "sku": "VAR-0000042",
            "precio_mayorista": 18500,
            "imagen_principal": str(AXLE_IMAGE),
        },
        {
            "producto_nombre": "PIÑÓN SHIMANO MF-TZ500 7V",
            "nombre_variante": "14-28T",
            "marca_nombre": "SHIMANO",
            "categoria_nombre": "TRANSMISIÓN",
            "sku": "VAR-0000061",
            "precio_mayorista": 42000,
            "imagen_principal": str(CASSETTE_IMAGE),
        },
    ] * 2

    output = OUTPUT / "Sprint2-Prototipo-Catalogo-Mayorista.pdf"
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFillColorRGB(*PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    margin = 22 * mm
    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(margin, height - 72 * mm, "Catálogo Mayorista")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, height - 86 * mm, "Emprendimiento Agus")
    c.setFillColorRGB(*ORANGE)
    c.rect(margin, height - 101 * mm, width - margin * 2, 1.2 * mm, fill=1, stroke=0)
    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 10)
    c.drawString(margin, height - 112 * mm, "Actualizado al 30/06/2026")
    c.drawString(
        margin,
        height - 124 * mm,
        "Precios sujetos a disponibilidad y modificación sin previo aviso.",
    )
    c.showPage()

    margin_x = 14 * mm
    gap_x = 6 * mm
    gap_y = 7 * mm
    card_w = (width - margin_x * 2 - gap_x) / 2
    card_h = 72 * mm
    start_y = height - 24 * mm - card_h
    _draw_header(c, 1)
    for index, item in enumerate(samples):
        row = index // 2
        col = index % 2
        x = margin_x + col * (card_w + gap_x)
        y = start_y - row * (card_h + gap_y)
        _draw_card(c, item, x, y, card_w, card_h)
    _draw_footer(c)
    c.save()
    output.write_bytes(buffer.getvalue())
    return output


def generar_renders_productivos():
    item = {
        "producto_nombre": "BICICLETA MTB TOPMEGA SUNSHINE R29",
        "nombre_variante": "TALLE L - VERDE/NEGRO",
        "marca_nombre": "TOPMEGA",
        "categoria_nombre": "BICICLETAS",
        "sku": "BIC-TOP-SUN29",
        "codigo_proveedor": "1010973",
        "precio_minorista": 274444,
        "precio_mayorista": 247000,
        "imagen_principal": str(BIKE_IMAGE),
        "rodado": "29",
        "talle": "L",
        "color": "VERDE/NEGRO",
        "tipo_bicicleta": "MTB",
        "material_cuadro": "ALUMINIO",
    }
    items = [
        item,
        {
            **item,
            "producto_nombre": "EJE TRASERO HUECO PARA CIERRE",
            "nombre_variante": "ÚNICA",
            "categoria_nombre": "TRANSMISIÓN",
            "sku": "VAR-0000042",
            "precio_minorista": 22222,
            "precio_mayorista": 18500,
            "imagen_principal": str(AXLE_IMAGE),
        },
        {
            **item,
            "producto_nombre": "PIÑÓN SHIMANO MF-TZ500 7V",
            "nombre_variante": "14-28T",
            "marca_nombre": "SHIMANO",
            "categoria_nombre": "TRANSMISIÓN",
            "sku": "VAR-0000061",
            "precio_minorista": 48000,
            "precio_mayorista": 42000,
            "imagen_principal": str(CASSETTE_IMAGE),
        },
    ] * 2

    mayorista = OUTPUT / "Sprint2-Final-Catalogo-Mayorista.pdf"
    mayorista.write_bytes(
        generar_catalogo_mayorista_productivo(
            {"items": items, "opciones_pago": PAYMENT_OPTIONS}
        )
    )

    bicicletas = OUTPUT / "Sprint2-Final-Catalogo-Bicicletas.pdf"
    bicicletas.write_bytes(
        generar_catalogo_bicicletas_pdf(
            {"items": [item] * 4, "opciones_pago": PAYMENT_OPTIONS}
        )
    )

    cartel = OUTPUT / "Sprint2-Final-Precio-A4.pdf"
    cartel.write_bytes(
        generar_cartel_precio_a4_pdf(
            {
                "tipo": "variante",
                "item": item,
                "opciones_pago": PAYMENT_OPTIONS,
            }
        )
    )
    return mayorista, bicicletas, cartel


if __name__ == "__main__":
    print(generar_story())
    print(generar_catalogo())
    print(generar_renders_productivos())
