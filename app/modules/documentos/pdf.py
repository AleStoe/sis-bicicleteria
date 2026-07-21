from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .brand import INK, ORANGE_DARK, ORANGE_SOFT
from .pdf_layout import collapse_repeated_words, draw_wrapped_text, wrap_text
from .pdf_metadata import set_pdf_metadata

BASE_DIR = Path(__file__).resolve().parents[3]
UPLOADS_DIR = BASE_DIR / "uploads"

LOGO_HORIZONTAL = UPLOADS_DIR / "logos" / "logo-horizontal.png"
LOGO_ICONO = UPLOADS_DIR / "logos" / "logo-icono.png"


def _money(value) -> str:
    value = Decimal(str(value or 0)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return f"$ {value:,.0f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _text(value) -> str:
    return "" if value is None else str(value)


def _fecha(value) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")

    raw = str(value)

    try:
        return datetime.fromisoformat(raw).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return raw[:16]


def _decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _detalle_pago_financiero(pago: dict) -> str:
    medio = _text(pago.get("medio_pago")).lower()

    monto = _money(pago.get("monto_total_cobrado"))

    if medio == "efectivo":
        descuento = _decimal(pago.get("monto_descuento_aplicado"))

        if descuento > 0:
            return (
                f"Monto abonado: {monto} - "
                f"Bonificación aplicada: {_money(descuento)}"
            )

        return f"Monto abonado: {monto}"

    if medio == "tarjeta":
        cuotas = pago.get("cuotas") or 1
        return f"Plan: {cuotas} cuota(s) - Monto abonado: {monto}"

    if medio == "transferencia":
        return f"Monto abonado: {monto}"

    return f"Monto abonado: {monto}"


def _resolver_imagen_local(url: str | None) -> Path | None:
    if not url:
        return None

    url = unquote(str(url).strip())

    marker = "/uploads/"
    if marker in url:
        relative = url.split(marker, 1)[1]
        path = UPLOADS_DIR / relative
    elif url.startswith("uploads/"):
        path = BASE_DIR / url
    elif url.startswith("/uploads/"):
        path = BASE_DIR / url.lstrip("/")
    else:
        path = UPLOADS_DIR / url.lstrip("/")

    if path.exists() and path.is_file():
        return path

    return None


def _draw_image_fit(c, path: Path, x, y, max_w, max_h):
    try:
        img = ImageReader(str(path))
        iw, ih = img.getSize()

        ratio = min(max_w / iw, max_h / ih)
        w = iw * ratio
        h = ih * ratio

        c.drawImage(
            img,
            x + (max_w - w) / 2,
            y + (max_h - h) / 2,
            width=w,
            height=h,
            preserveAspectRatio=True,
            mask="auto",
        )
        return True
    except Exception:
        return False


def _es_item_servicio(item: dict) -> bool:
    tipo = str(item.get("tipo_item") or "").strip().lower()
    producto_tipo = str(item.get("producto_tipo_item") or "").strip().lower()
    return bool(item.get("id_servicio_taller")) or tipo in {
        "servicio",
        "servicio_taller",
    } or producto_tipo in {
        "servicio",
        "servicio_taller",
    }


def _draw_service_placeholder(c, x, y, width, height):
    c.saveState()
    try:
        c.setFillColorRGB(*ORANGE_SOFT)
        c.setStrokeColorRGB(*ORANGE_DARK)
        c.setLineWidth(0.45)
        c.roundRect(x, y, width, height, 2.4 * mm, fill=1, stroke=1)

        center_x = x + width / 2
        scale = min(width, height) / (15 * mm)
        icon_y = y + 8.1 * mm * scale
        wrench_bottom_x = center_x - 2.8 * mm * scale
        wrench_bottom_y = icon_y - 2.8 * mm * scale
        wrench_top_x = center_x + 2.8 * mm * scale
        wrench_top_y = icon_y + 2.8 * mm * scale

        c.setStrokeColorRGB(*INK)
        c.setFillColorRGB(*INK)
        c.setLineCap(1)
        c.setLineWidth(1.25 * mm * scale)
        c.line(
            wrench_bottom_x,
            wrench_bottom_y,
            wrench_top_x,
            wrench_top_y,
        )

        ring_radius = 1.25 * mm * scale
        c.circle(
            wrench_bottom_x,
            wrench_bottom_y,
            ring_radius,
            fill=1,
            stroke=0,
        )
        c.setFillColorRGB(*ORANGE_SOFT)
        c.circle(
            wrench_bottom_x,
            wrench_bottom_y,
            0.52 * mm * scale,
            fill=1,
            stroke=0,
        )

        jaw_radius = 1.5 * mm * scale
        c.setFillColorRGB(*INK)
        c.circle(wrench_top_x, wrench_top_y, jaw_radius, fill=1, stroke=0)
        c.setFillColorRGB(*ORANGE_SOFT)
        jaw_cut = c.beginPath()
        jaw_cut.moveTo(
            wrench_top_x + 1.75 * mm * scale,
            wrench_top_y + 1.75 * mm * scale,
        )
        jaw_cut.lineTo(
            wrench_top_x - 0.15 * mm * scale,
            wrench_top_y + 0.62 * mm * scale,
        )
        jaw_cut.lineTo(
            wrench_top_x + 0.62 * mm * scale,
            wrench_top_y - 0.15 * mm * scale,
        )
        jaw_cut.close()
        c.drawPath(jaw_cut, fill=1, stroke=0)

        second_bottom_x = center_x + 2.8 * mm * scale
        second_bottom_y = icon_y - 2.8 * mm * scale
        second_top_x = center_x - 2.8 * mm * scale
        second_top_y = icon_y + 2.8 * mm * scale

        c.setStrokeColorRGB(*INK)
        c.setFillColorRGB(*INK)
        c.setLineWidth(1.25 * mm * scale)
        c.line(
            second_bottom_x,
            second_bottom_y,
            second_top_x,
            second_top_y,
        )
        c.circle(
            second_bottom_x,
            second_bottom_y,
            ring_radius,
            fill=1,
            stroke=0,
        )
        c.setFillColorRGB(*ORANGE_SOFT)
        c.circle(
            second_bottom_x,
            second_bottom_y,
            0.52 * mm * scale,
            fill=1,
            stroke=0,
        )

        c.setFillColorRGB(*INK)
        c.circle(second_top_x, second_top_y, jaw_radius, fill=1, stroke=0)
        c.setFillColorRGB(*ORANGE_SOFT)
        second_jaw_cut = c.beginPath()
        second_jaw_cut.moveTo(
            second_top_x - 1.75 * mm * scale,
            second_top_y + 1.75 * mm * scale,
        )
        second_jaw_cut.lineTo(
            second_top_x + 0.15 * mm * scale,
            second_top_y + 0.62 * mm * scale,
        )
        second_jaw_cut.lineTo(
            second_top_x - 0.62 * mm * scale,
            second_top_y - 0.15 * mm * scale,
        )
        second_jaw_cut.close()
        c.drawPath(second_jaw_cut, fill=1, stroke=0)

        label_size = max(4.2, min(6.2, width / mm * 0.32))
        c.setFillColorRGB(*ORANGE_DARK)
        c.setFont("Helvetica-Bold", label_size)
        c.drawCentredString(center_x, y + 1.45 * mm, "SERVICIO")
    finally:
        c.restoreState()


def _draw_header(c, venta, width, height, margin_x):
    y = height - 18 * mm

    if LOGO_HORIZONTAL.exists():
        _draw_image_fit(
            c,
            LOGO_HORIZONTAL,
            margin_x,
            y - 18 * mm,
            68 * mm,
            18 * mm,
        )
    else:
        c.setFont("Helvetica-Bold", 16)
        c.drawString(margin_x, y, "Emprendimiento Agus")

    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - margin_x, y, "COMPROBANTE X")

    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "NO FISCAL")

    y -= 7 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, f"Venta #{venta['id']}")

    y -= 5 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, f"Fecha: {_fecha(venta.get('fecha'))}")

    y = height - 43 * mm
    c.setFont("Helvetica", 9)
    c.drawString(margin_x, y, "Bicicletería - Repuestos - Taller")

    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "DOCUMENTO NO VÁLIDO COMO FACTURA")

    return y - 12 * mm


def _draw_cliente(c, venta, y, margin_x, width):
    value_x = margin_x + 22 * mm
    value_width = width - margin_x - value_x

    rows = [
        ("Cliente:", collapse_repeated_words(venta.get("cliente_nombre"))),
        ("Telefono:", venta.get("cliente_telefono")),
        ("DNI:", venta.get("cliente_dni")),
        ("CUIT:", venta.get("cliente_cuit")),
        ("IVA:", _format_condicion_iva(venta.get("cliente_condicion_iva"))),
        ("Sucursal:", collapse_repeated_words(venta.get("sucursal_nombre"))),
    ]

    for label, value in rows:
        if not value:
            continue

        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, label)
        y = draw_wrapped_text(
            c,
            _text(value),
            x=value_x,
            y=y,
            max_width=value_width,
            font_name="Helvetica",
            font_size=10,
            leading=5 * mm,
        )
        y -= 1 * mm

    return y - 7 * mm


def _format_condicion_iva(value) -> str:
    labels = {
        "consumidor_final": "Consumidor final",
        "responsable_inscripto": "Responsable inscripto",
        "monotributo": "Monotributo",
        "exento": "Exento",
    }
    return labels.get(_text(value), _text(value))


def _draw_table_header(c, y, width, margin_x):
    c.setFont("Helvetica-Bold", 8)

    c.drawString(margin_x, y, "Producto")
    c.drawString(margin_x + 24 * mm, y, "Descripción")
    c.drawRightString(width - margin_x - 62 * mm, y, "Cant.")
    c.drawRightString(width - margin_x - 42 * mm, y, "Unitario")
    c.drawRightString(width - margin_x - 20 * mm, y, "Bonif.")
    c.drawRightString(width - margin_x, y, "Subtotal")

    y -= 3 * mm
    c.line(margin_x, y, width - margin_x, y)

    return y - 5 * mm


def _precio_unitario_visible(item: dict) -> Decimal:
    return _decimal(
        item.get("precio_lista")
        or item.get("precio_unitario_original")
        or item.get("precio_final")
    )


def _bonificacion_item(item: dict) -> Decimal:
    if not item.get("bonificado"):
        return Decimal("0")

    cantidad = _decimal(item.get("cantidad") or 1)
    subtotal_lista = _precio_unitario_visible(item) * cantidad
    subtotal_final = _decimal(item.get("subtotal"))

    bonificacion = subtotal_lista - subtotal_final
    return bonificacion if bonificacion > 0 else Decimal("0")


def _comprobante_continuation_page(c, width, height, margin_x, venta):
    c.showPage()
    y = height - 16 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "COMPROBANTE X")
    c.setFont("Helvetica", 8)
    c.drawRightString(
        width - margin_x,
        y,
        f"Venta #{venta['id']} - Continuacion",
    )
    y -= 4 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    return y - 7 * mm


def _ensure_comprobante_space(
    c,
    y,
    needed,
    *,
    width,
    height,
    margin_x,
    venta,
    table_header=False,
):
    if y - needed >= 24 * mm:
        return y

    y = _comprobante_continuation_page(c, width, height, margin_x, venta)
    if table_header:
        y = _draw_table_header(c, y, width, margin_x)
    return y


def generar_comprobante_x_pdf(data: dict, incluir_marca_agua: bool = True) -> bytes:
    venta = data["venta"]
    items = data["items"]
    pagos = data.get("pagos", [])

    buffer = BytesIO()

    c = canvas.Canvas(buffer, pagesize=A4)
    set_pdf_metadata(c, f"Comprobante X - Venta #{venta.get('id')}")
    width, height = A4
    if incluir_marca_agua and LOGO_ICONO.exists():
        c.saveState()
        try:
            c.setFillAlpha(0.06)
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

    margin_x = 15 * mm
    y = _draw_header(c, venta, width, height, margin_x)
    y = _draw_cliente(c, venta, y, margin_x, width)
    y = _draw_table_header(c, y, width, margin_x)

    img_size = 15 * mm
    description_x = margin_x + 24 * mm
    description_right = width - margin_x - 74 * mm
    description_width = description_right - description_x
    description_leading = 4.2 * mm

    for item in items:
        descripcion = collapse_repeated_words(item.get("descripcion_snapshot"))
        if item.get("numero_cuadro"):
            descripcion = (
                f"{descripcion} - N° CUADRO {_text(item.get('numero_cuadro'))}"
            )
        description_lines = wrap_text(
            descripcion,
            description_width,
            "Helvetica-Bold",
            8,
        )
        bonification_lines = []
        offer_lines = []
        if item.get("id_oferta"):
            precio_anterior = _decimal(item.get("precio_catalogo_original"))
            precio_oferta = _precio_unitario_visible(item)
            texto_oferta = (
                f"Oferta: {_text(item.get('oferta_nombre_snapshot') or 'precio promocional')} "
                f"- Antes {_money(precio_anterior)} - Ahora {_money(precio_oferta)}"
            )
            offer_lines = wrap_text(
                texto_oferta,
                description_width,
                "Helvetica",
                6.5,
            )
        if item.get("bonificado") and item.get("motivo_bonificacion"):
            bonification_lines = wrap_text(
                "Bonificacion: "
                + collapse_repeated_words(item.get("motivo_bonificacion")),
                description_width,
                "Helvetica",
                6.5,
            )

        text_height = (
            len(description_lines) * description_leading
            + len(offer_lines) * 3.7 * mm
            + len(bonification_lines) * 3.7 * mm
        )
        row_h = max(20 * mm, 4 * mm + text_height + 4 * mm)
        y = _ensure_comprobante_space(
            c,
            y,
            row_h + 4 * mm,
            width=width,
            height=height,
            margin_x=margin_x,
            venta=venta,
            table_header=True,
        )

        row_top = y
        row_bottom = y - row_h + 3 * mm

        c.setLineWidth(0.25)
        c.line(margin_x, row_bottom, width - margin_x, row_bottom)

        img_path = _resolver_imagen_local(item.get("imagen_principal"))

        if img_path:
            _draw_image_fit(
                c,
                img_path,
                margin_x,
                y - img_size + 1 * mm,
                img_size,
                img_size,
            )
        elif _es_item_servicio(item):
            _draw_service_placeholder(
                c,
                margin_x,
                y - img_size + 1 * mm,
                img_size,
                img_size,
            )
        else:
            c.setFont("Helvetica", 6)
            c.drawCentredString(
                margin_x + img_size / 2,
                y - 7 * mm,
                "Sin imagen",
            )

        precio_unitario = _precio_unitario_visible(item)
        bonificacion_item = _bonificacion_item(item)

        text_y = row_top - 4 * mm
        c.setFont("Helvetica-Bold", 8)
        for line in description_lines:
            c.drawString(description_x, text_y, line)
            text_y -= description_leading

        c.setFont("Helvetica", 6.5)
        if offer_lines:
            c.setFillColorRGB(0.82, 0.24, 0.02)
        for line in offer_lines:
            c.drawString(description_x, text_y, line)
            text_y -= 3.7 * mm

        c.setFillColorRGB(0, 0, 0)
        for line in bonification_lines:
            c.drawString(description_x, text_y, line)
            text_y -= 3.7 * mm

        c.setFont("Helvetica", 7.5)
        c.drawRightString(
            width - margin_x - 62 * mm,
            row_top - 8 * mm,
            _text(item.get("cantidad")),
        )
        c.drawRightString(
            width - margin_x - 42 * mm,
            row_top - 8 * mm,
            _money(precio_unitario),
        )
        if bonificacion_item > 0:
            texto_bonif = _money(bonificacion_item)
        else:
            texto_bonif = "-"

        c.drawRightString(
            width - margin_x - 20 * mm,
            row_top - 8 * mm,
            texto_bonif,
        )
        c.drawRightString(
            width - margin_x,
            row_top - 8 * mm,
            _money(item.get("subtotal")),
        )

        y -= row_h

    y = _ensure_comprobante_space(
        c,
        y,
        46 * mm,
        width=width,
        height=height,
        margin_x=margin_x,
        venta=venta,
    )
    y -= 4 * mm

    c.setFont("Helvetica", 9)

    c.drawRightString(width - margin_x - 35 * mm, y, "Subtotal base")
    c.drawRightString(width - margin_x, y, _money(venta.get("subtotal_base")))

    y -= 6 * mm
    c.drawRightString(width - margin_x - 35 * mm, y, "Bonificación global")
    c.drawRightString(width - margin_x, y, f"- {_money(venta.get('descuento_total'))}")

    y -= 6 * mm
    if _decimal(venta.get("recargo_total")) > 0:
        c.drawRightString(
            width - margin_x - 35 * mm,
            y,
            "Financiación",
        )
    else:
        c.drawRightString(
            width - margin_x - 35 * mm,
            y,
            "Financiación",
        )
    c.drawRightString(width - margin_x, y, f"+ {_money(venta.get('recargo_total'))}")

    y -= 7 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - margin_x - 35 * mm, y, "TOTAL COBRADO")
    c.drawRightString(width - margin_x, y, _money(venta.get("total_final")))

    y -= 7 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x - 35 * mm, y, "Saldo pendiente")
    c.drawRightString(width - margin_x, y, _money(venta.get("saldo_pendiente")))

    # =========================================================
    # DESGLOSE DE PAGOS
    # =========================================================

    if pagos:
        y -= 12 * mm

        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_x, y, "Pagos")

        y -= 6 * mm

        for pago in pagos:
            medio = _text(pago.get("medio_pago")).capitalize()
            monto_cobrado = pago.get("monto_total_cobrado")
            detalle = _detalle_pago_financiero(pago)
            detalle_lines = wrap_text(
                detalle,
                width - 2 * margin_x - 8 * mm,
                "Helvetica",
                8,
            )
            y = _ensure_comprobante_space(
                c,
                y,
                7 * mm + len(detalle_lines) * 4 * mm,
                width=width,
                height=height,
                margin_x=margin_x,
                venta=venta,
            )

            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin_x, y, medio)

            c.drawRightString(
                width - margin_x,
                y,
                _money(monto_cobrado),
            )

            y -= 5 * mm
            y = draw_wrapped_text(
                c,
                detalle,
                x=margin_x + 4 * mm,
                y=y,
                max_width=width - 2 * margin_x - 8 * mm,
                font_name="Helvetica",
                font_size=8,
                leading=4 * mm,
            )
            y -= 3 * mm

    if venta.get("observaciones"):
        observation_lines = wrap_text(
            venta.get("observaciones"),
            width - 2 * margin_x,
            "Helvetica",
            9,
        )
        y = _ensure_comprobante_space(
            c,
            y,
            20 * mm + len(observation_lines) * 4.5 * mm,
            width=width,
            height=height,
            margin_x=margin_x,
            venta=venta,
        )
        y -= 12 * mm
        c.setFont("Helvetica-Bold", 9)
        c.drawString(margin_x, y, "Observaciones:")
        y -= 5 * mm
        y = draw_wrapped_text(
            c,
            venta.get("observaciones"),
            x=margin_x,
            y=y,
            max_width=width - 2 * margin_x,
            font_name="Helvetica",
            font_size=9,
            leading=4.5 * mm,
        )

    if LOGO_ICONO.exists():
        _draw_image_fit(
            c,
            LOGO_ICONO,
            margin_x,
            8 * mm,
            13 * mm,
            13 * mm,
        )

    c.setFont("Helvetica", 8)
    c.drawCentredString(
        width / 2,
        12 * mm,
        "Comprobante interno sin valor fiscal. Gracias por su compra.",
    )

    c.save()

    pdf = buffer.getvalue()
    buffer.close()

    return pdf
