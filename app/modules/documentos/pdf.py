from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _money(value) -> str:
    value = Decimal(str(value or 0))
    return f"$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _text(value) -> str:
    return "" if value is None else str(value)


def generar_comprobante_x_pdf(data: dict) -> bytes:
    venta = data["venta"]
    items = data["items"]

    buffer = BytesIO()

    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    margin_x = 18 * mm
    y = height - 18 * mm

    # Encabezado
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin_x, y, "Emprendimiento Agus")

    c.setFont("Helvetica", 9)
    y -= 6 * mm
    c.drawString(margin_x, y, "Bicicleteria - Repuestos - Taller")

    y -= 6 * mm
    c.drawString(margin_x, y, "COMPROBANTE X - NO FISCAL")

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, height - 18 * mm, f"Venta #{venta['id']}")

    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, height - 24 * mm, f"Fecha: {_text(venta['fecha'])}")

    # Leyenda no fiscal
    y -= 10 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "DOCUMENTO NO VALIDO COMO FACTURA")

    # Datos cliente
    y -= 10 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Cliente:")

    c.setFont("Helvetica", 10)
    c.drawString(margin_x + 22 * mm, y, _text(venta.get("cliente_nombre")))

    y -= 6 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Sucursal:")

    c.setFont("Helvetica", 10)
    c.drawString(margin_x + 22 * mm, y, _text(venta.get("sucursal_nombre")))

    # Tabla
    y -= 12 * mm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin_x, y, "Cant.")
    c.drawString(margin_x + 22 * mm, y, "Descripcion")
    c.drawRightString(width - margin_x - 30 * mm, y, "Unitario")
    c.drawRightString(width - margin_x, y, "Subtotal")

    y -= 3 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 6 * mm

    c.setFont("Helvetica", 9)

    for item in items:
        if y < 35 * mm:
            c.showPage()
            y = height - 18 * mm
            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin_x, y, "Cant.")
            c.drawString(margin_x + 22 * mm, y, "Descripcion")
            c.drawRightString(width - margin_x - 30 * mm, y, "Unitario")
            c.drawRightString(width - margin_x, y, "Subtotal")
            y -= 8 * mm
            c.setFont("Helvetica", 9)

        descripcion = _text(item.get("descripcion_snapshot"))
        if len(descripcion) > 62:
            descripcion = descripcion[:59] + "..."

        c.drawString(margin_x, y, _text(item.get("cantidad")))
        c.drawString(margin_x + 22 * mm, y, descripcion)
        c.drawRightString(width - margin_x - 30 * mm, y, _money(item.get("precio_final")))
        c.drawRightString(width - margin_x, y, _money(item.get("subtotal")))

        y -= 6 * mm

    # Totales
    y -= 4 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x - 35 * mm, y, "Total:")
    c.drawRightString(width - margin_x, y, _money(venta.get("total_final")))

    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x - 35 * mm, y, "Saldo pendiente:")
    c.drawRightString(width - margin_x, y, _money(venta.get("saldo_pendiente")))

    # Observaciones
    if venta.get("observaciones"):
        y -= 12 * mm
        c.setFont("Helvetica-Bold", 9)
        c.drawString(margin_x, y, "Observaciones:")
        y -= 5 * mm
        c.setFont("Helvetica", 9)
        c.drawString(margin_x, y, _text(venta.get("observaciones"))[:100])

    # Pie
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