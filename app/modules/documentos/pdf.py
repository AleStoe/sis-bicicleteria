from datetime import datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


BASE_DIR = Path(__file__).resolve().parents[3]
UPLOADS_DIR = BASE_DIR / "uploads"

LOGO_HORIZONTAL = UPLOADS_DIR / "logos" / "logo-horizontal.png"
LOGO_ICONO = UPLOADS_DIR / "logos" / "logo-icono.png"


def _money(value) -> str:
    value = Decimal(str(value or 0))
    return f"$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


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


def _draw_cliente(c, venta, y, margin_x):
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Cliente:")

    c.setFont("Helvetica", 10)
    c.drawString(margin_x + 22 * mm, y, _text(venta.get("cliente_nombre")))

    y -= 6 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Sucursal:")

    c.setFont("Helvetica", 10)
    c.drawString(margin_x + 22 * mm, y, _text(venta.get("sucursal_nombre")))

    return y - 12 * mm


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


def generar_comprobante_x_pdf(data: dict) -> bytes:
    venta = data["venta"]
    items = data["items"]
    pagos = data.get("pagos", [])

    buffer = BytesIO()

    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    if LOGO_ICONO.exists():
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
    y = _draw_cliente(c, venta, y, margin_x)
    y = _draw_table_header(c, y, width, margin_x)

    row_h = 20 * mm
    img_size = 15 * mm

    for item in items:
        if y < 45 * mm:
            c.showPage()
            y = height - 18 * mm
            y = _draw_table_header(c, y, width, margin_x)

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
        else:
            c.setFont("Helvetica", 6)
            c.drawCentredString(
                margin_x + img_size / 2,
                y - 7 * mm,
                "Sin imagen",
            )

        descripcion = _text(item.get("descripcion_snapshot"))
        if len(descripcion) > 45:
            descripcion = descripcion[:42] + "..."

        precio_unitario = _precio_unitario_visible(item)
        bonificacion_item = _bonificacion_item(item)

        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin_x + 24 * mm, row_top - 4 * mm, descripcion)

        if item.get("bonificado") and item.get("motivo_bonificacion"):
            c.setFont("Helvetica", 6.5)
            c.drawString(
                margin_x + 24 * mm,
                row_top - 8 * mm,
                f"Bonificado: {_text(item.get('motivo_bonificacion'))[:38]}",
            )

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
            if y < 35 * mm:
                c.showPage()
                y = height - 18 * mm

            medio = _text(pago.get("medio_pago")).capitalize()
            monto_cobrado = pago.get("monto_total_cobrado")

            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin_x, y, medio)

            c.drawRightString(
                width - margin_x,
                y,
                _money(monto_cobrado),
            )

            y -= 5 * mm
            c.setFont("Helvetica", 8)

            detalle = _detalle_pago_financiero(pago)

            c.drawString(margin_x + 4 * mm, y, detalle[:105])

            y -= 7 * mm

    if venta.get("observaciones"):
        y -= 12 * mm
        c.setFont("Helvetica-Bold", 9)
        c.drawString(margin_x, y, "Observaciones:")
        y -= 5 * mm
        c.setFont("Helvetica", 9)
        c.drawString(margin_x, y, _text(venta.get("observaciones"))[:110])

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
