from decimal import Decimal
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
    _resolver_imagen_local,
)


def _total(rows, key):
    total = Decimal("0")
    for row in rows:
        total += Decimal(str(row.get(key) or 0))
    return total


def _draw_watermark(c, width, height):
    if not LOGO_ICONO.exists():
        return

    c.saveState()

    try:
        c.setFillAlpha(0.035)
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


def _draw_header(c, venta, width, height, margin_x):
    y = height - 18 * mm

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
    c.drawRightString(width - margin_x, y, "RESUMEN DE COBROS")

    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "NO FISCAL")

    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, f"Venta #{venta['id']}")

    y -= 12 * mm
    c.setLineWidth(0.4)
    c.line(margin_x, y, width - margin_x, y)

    return y - 9 * mm


def _draw_datos_venta(c, venta, y, width, margin_x):
    left_x = margin_x
    right_x = width / 2 + 5 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Datos de la venta")

    y -= 8 * mm

    rows = [
        ("Fecha", _fecha(venta.get("fecha")), "Estado", _text(venta.get("estado"))),
        ("Cliente", _text(venta.get("cliente_nombre")), "Sucursal", _text(venta.get("sucursal_nombre"))),
        ("Total venta", _money(venta.get("total_final")), "Saldo", _money(venta.get("saldo_pendiente"))),
    ]

    for l1, v1, l2, v2 in rows:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left_x, y, f"{l1}:")
        c.setFont("Helvetica", 9)
        c.drawString(left_x + 26 * mm, y, str(v1)[:45])

        c.setFont("Helvetica-Bold", 9)
        c.drawString(right_x, y, f"{l2}:")
        c.setFont("Helvetica", 9)
        c.drawString(right_x + 25 * mm, y, str(v2)[:38])

        y -= 6 * mm

    return y - 6 * mm


def _draw_items_preview(c, items, y, width, margin_x):
    if not items:
        return y

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Venta asociada")

    y -= 8 * mm

    box_h = 23 * mm
    x = margin_x

    for item in items:
        if y < 45 * mm:
            c.showPage()
            y = A4[1] - 18 * mm

        c.setStrokeColorRGB(0.88, 0.90, 0.94)
        c.roundRect(x, y - box_h + 4 * mm, width - margin_x * 2, box_h, 6, stroke=1, fill=0)

        img_path = _resolver_imagen_local(item.get("imagen_principal"))

        if img_path:
            _draw_image_fit(
                c,
                img_path,
                x + 4 * mm,
                y - 16 * mm,
                14 * mm,
                14 * mm,
            )

        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 9)
        desc = _text(item.get("descripcion_snapshot"))
        if len(desc) > 72:
            desc = desc[:69] + "..."

        c.drawString(x + 23 * mm, y - 5 * mm, desc)

        c.setFont("Helvetica", 8)
        c.drawString(
            x + 23 * mm,
            y - 11 * mm,
            f"Cantidad: {_text(item.get('cantidad'))}",
        )

        y -= box_h + 3 * mm

    return y - 3 * mm


def _draw_pagos_table(c, pagos, y, width, margin_x):
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Pagos registrados")

    y -= 8 * mm

    headers = [
        ("Fecha", margin_x),
        ("Medio", margin_x + 31 * mm),
        ("Plan", margin_x + 58 * mm),
        ("Base", width - margin_x - 72 * mm),
        ("Desc.", width - margin_x - 48 * mm),
        ("Rec.", width - margin_x - 24 * mm),
        ("Cobrado", width - margin_x),
    ]

    c.setFont("Helvetica-Bold", 8)

    for label, x in headers:
        if label in {"Base", "Desc.", "Rec.", "Cobrado"}:
            c.drawRightString(x, y, label)
        else:
            c.drawString(x, y, label)

    y -= 3 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 5 * mm

    c.setFont("Helvetica", 8)

    for pago in pagos:
        if y < 32 * mm:
            c.showPage()
            y = A4[1] - 18 * mm

        medio = _text(pago.get("medio_pago")).capitalize()

        plan = "-"
        if pago.get("tarjeta_plan_nombre"):
            plan = _text(pago.get("tarjeta_plan_nombre"))
        elif pago.get("cuotas"):
            plan = f"{pago.get('cuotas')} cuota(s)"

        if len(plan) > 18:
            plan = plan[:15] + "..."

        c.drawString(margin_x, y, _fecha(pago.get("fecha"))[:10])
        c.drawString(margin_x + 31 * mm, y, medio[:14])
        c.drawString(margin_x + 58 * mm, y, plan)

        c.drawRightString(
            width - margin_x - 72 * mm,
            y,
            _money(pago.get("monto_base_aplicado")),
        )

        c.drawRightString(
            width - margin_x - 48 * mm,
            y,
            f"- {_money(pago.get('monto_descuento_aplicado'))}",
        )

        c.drawRightString(
            width - margin_x - 24 * mm,
            y,
            f"+ {_money(pago.get('monto_recargo_aplicado'))}",
        )

        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(
            width - margin_x,
            y,
            _money(pago.get("monto_total_cobrado")),
        )
        c.setFont("Helvetica", 8)

        y -= 6 * mm

    return y - 5 * mm


def _draw_totales(c, venta, pagos, y, width, margin_x):
    total_base = _total(pagos, "monto_base_aplicado")
    total_descuento = _total(pagos, "monto_descuento_aplicado")
    total_recargo = _total(pagos, "monto_recargo_aplicado")
    total_cobrado = _total(pagos, "monto_total_cobrado")

    c.line(width - margin_x - 70 * mm, y, width - margin_x, y)
    y -= 7 * mm

    rows = [
        ("Base comercial aplicada", _money(total_base)),
        ("Total descuentos", f"- {_money(total_descuento)}"),
        ("Total recargos", f"+ {_money(total_recargo)}"),
        ("Total cobrado", _money(total_cobrado)),
        ("Total venta", _money(venta.get("total_final"))),
        ("Saldo restante", _money(venta.get("saldo_pendiente"))),
    ]

    for label, value in rows:
        is_strong = label in {"Total cobrado", "Saldo restante"}

        c.setFont("Helvetica-Bold" if is_strong else "Helvetica", 9)
        c.drawRightString(width - margin_x - 35 * mm, y, label)

        c.setFont("Helvetica-Bold" if is_strong else "Helvetica", 9)
        c.drawRightString(width - margin_x, y, value)

        y -= 6 * mm

    return y


def generar_resumen_cobros_pdf(data: dict) -> bytes:
    venta = data["venta"]
    pagos = data.get("pagos", [])
    items_preview = data.get("items_preview", [])

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    margin_x = 15 * mm

    _draw_watermark(c, width, height)

    y = _draw_header(c, venta, width, height, margin_x)
    y = _draw_datos_venta(c, venta, y, width, margin_x)
    y = _draw_items_preview(c, items_preview, y, width, margin_x)
    y = _draw_pagos_table(c, pagos, y, width, margin_x)
    y = _draw_totales(c, venta, pagos, y, width, margin_x)

    y -= 4 * mm

    c.setFont("Helvetica", 7)
    c.drawRightString(
        width - margin_x,
        y,
        (
            "Nota: la base comercial puede diferir del "
            "cobrado real por descuentos o recargos aplicados."
        ),
    )

    c.setFont("Helvetica", 8)
    c.drawCentredString(
        width / 2,
        12 * mm,
        "Resumen interno de cobros no fiscal. No válido como factura.",
    )

    c.save()

    pdf = buffer.getvalue()
    buffer.close()

    return pdf