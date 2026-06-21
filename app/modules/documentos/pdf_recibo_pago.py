from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .pdf import (
    LOGO_HORIZONTAL,
    LOGO_ICONO,
    _draw_image_fit,
    _fecha,
    _money,
    _text,
)


def _draw_watermark(c, width, height):
    if not LOGO_ICONO.exists():
        return

    c.saveState()

    try:
        c.setFillAlpha(0.045)
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


def _row(c, y, width, margin_x, label, value, bold=False):
    c.setFont("Helvetica", 9)
    c.drawString(margin_x, y, label)

    c.setFont("Helvetica-Bold" if bold else "Helvetica", 9)
    c.drawRightString(width - margin_x, y, value)

    return y - 6 * mm


def _box_title(c, x, y, title):
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, title)
    return y - 8 * mm


def generar_recibo_pago_pdf(data: dict) -> bytes:
    pago = data["pago"]

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    margin_x = 16 * mm

    _draw_watermark(c, width, height)

    y = height - 18 * mm

    # =====================================================
    # HEADER
    # =====================================================

    if LOGO_HORIZONTAL.exists():
        _draw_image_fit(
            c,
            LOGO_HORIZONTAL,
            margin_x,
            y - 17 * mm,
            68 * mm,
            17 * mm,
        )
    else:
        c.setFont("Helvetica-Bold", 15)
        c.drawString(margin_x, y, "EMPRENDIMIENTO AGUS")

    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - margin_x, y, "RECIBO DE PAGO")

    y -= 6 * mm

    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "NO FISCAL")

    y -= 8 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, "DOCUMENTO INTERNO DE COBRO")

    y -= 14 * mm

    # =====================================================
    # IDENTIFICACIÓN
    # =====================================================

    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, f"Pago #{pago['id']}")

    numero_pago = pago.get("numero_pago")
    cantidad_pagos = pago.get("cantidad_pagos")

    if numero_pago and cantidad_pagos:
        c.setFont("Helvetica", 9)
        c.drawString(
            margin_x,
            y - 5 * mm,
            f"Pago {numero_pago} de {cantidad_pagos} registrado para esta venta",
        )

    c.setFont("Helvetica", 10)
    c.drawRightString(width - margin_x, y, _fecha(pago.get("fecha")))

    y -= 17 * mm

    c.setLineWidth(0.4)
    c.line(margin_x, y, width - margin_x, y)

    y -= 9 * mm

    # =====================================================
    # DATOS GENERALES
    # =====================================================

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Datos del cobro")

    y -= 8 * mm

    left_x = margin_x
    right_x = width / 2 + 5 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "Venta:")
    c.setFont("Helvetica", 9)
    c.drawString(left_x + 26 * mm, y, f"#{pago['venta_id']}")

    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x, y, "Estado:")
    c.setFont("Helvetica", 9)
    c.drawString(right_x + 28 * mm, y, _text(pago.get("estado")).capitalize())

    y -= 6 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "Cliente:")
    c.setFont("Helvetica", 9)
    c.drawString(left_x + 26 * mm, y, _text(pago.get("cliente_nombre"))[:45])

    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x, y, "Sucursal:")
    c.setFont("Helvetica", 9)
    c.drawString(right_x + 28 * mm, y, _text(pago.get("sucursal_nombre"))[:35])

    y -= 6 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, y, "Medio:")
    c.setFont("Helvetica", 9)
    c.drawString(left_x + 26 * mm, y, _text(pago.get("medio_pago")).capitalize())

    if pago.get("tarjeta_plan_nombre"):
        c.setFont("Helvetica-Bold", 9)
        c.drawString(right_x, y, "Plan:")
        c.setFont("Helvetica", 9)
        c.drawString(right_x + 28 * mm, y, _text(pago.get("tarjeta_plan_nombre"))[:35])

    y -= 12 * mm

    # =====================================================
    # DETALLE FINANCIERO
    # =====================================================

    y = _box_title(c, margin_x, y, "Detalle financiero")

    monto_base = pago.get("monto_base_aplicado")
    descuento = pago.get("monto_descuento_aplicado")
    recargo = pago.get("monto_recargo_aplicado")

    y = _row(c, y, width, margin_x, "Importe cubierto", _money(monto_base))
    y = _row(c, y, width, margin_x, "Descuento aplicado", f"- {_money(descuento)}")
    y = _row(c, y, width, margin_x, "Recargo aplicado", f"+ {_money(recargo)}")

    if pago.get("cuotas"):
        y = _row(c, y, width, margin_x, "Cuotas tarjeta", f"{pago.get('cuotas')} cuota(s)")

    if pago.get("entidad"):
        y = _row(c, y, width, margin_x, "Entidad", _text(pago.get("entidad")))

    y -= 2 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 7 * mm

    y = _row(
        c,
        y,
        width,
        margin_x,
        "Importe abonado",
        _money(pago.get("monto_total_cobrado")),
        bold=True,
    )

    y -= 8 * mm

    # =====================================================
    # ESTADO DE LA VENTA
    # =====================================================

    y = _box_title(c, margin_x, y, "Estado de la venta")

    y = _row(c, y, width, margin_x, "Total operación", _money(pago.get("total_final")))
    y = _row(c, y, width, margin_x, "Pagado acumulado", _money(pago.get("pagado_acumulado")))
    y = _row(c, y, width, margin_x, "Saldo restante", _money(pago.get("saldo_pendiente")), bold=True)

    if pago.get("nota"):
        y -= 7 * mm
        y = _box_title(c, margin_x, y, "Observaciones")

        c.setFont("Helvetica", 9)
        c.drawString(margin_x, y, _text(pago.get("nota"))[:115])

    # =====================================================
    # FOOTER
    # =====================================================

    c.setFont("Helvetica", 8)
    c.drawCentredString(
        width / 2,
        14 * mm,
        "Recibo interno no fiscal. No válido como factura.",
    )

    c.save()

    pdf = buffer.getvalue()
    buffer.close()

    return pdf