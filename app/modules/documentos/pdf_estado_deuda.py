from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .brand import BORDER, BROWN, INK, MUTED, ORANGE, ORANGE_SOFT
from .pdf import _money, _text
from .pdf_layout import wrap_text
from .pdf_metadata import set_pdf_metadata


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def _format_percent(value):
    numero = _dec(value)
    texto = f"{numero:.4f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def _descuento_efectivo_transferencia(opciones_pago):
    contado = (opciones_pago or {}).get("contado") or []
    descuentos = [
        _dec(opcion.get("porcentaje_descuento"))
        for opcion in contado
        if opcion.get("medio_pago") in {"efectivo", "transferencia"}
    ]
    return max(descuentos) if descuentos else Decimal("0")


def _monto_con_descuento(monto, porcentaje_descuento):
    return _dec(monto) * (Decimal("1") - (_dec(porcentaje_descuento) / Decimal("100")))


def _deudas_abiertas(deudas):
    return [d for d in deudas if d.get("estado") == "abierta" and _dec(d.get("saldo_actual")) > 0]


def _short_date(value):
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    raw = str(value)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return raw[:10]


def _draw_header(c, cliente, width, height, margin_x):
    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin_x, height - margin_x, "EMPRENDIMIENTO AGUS")

    c.setFillColorRGB(*ORANGE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin_x, height - margin_x - 6 * mm, "ESTADO DE DEUDA")

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(width - margin_x, height - margin_x, _text(cliente.get("nombre"))[:42])

    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 8.5)
    c.drawRightString(width - margin_x, height - margin_x - 5 * mm, f"Emitido: {_short_date(datetime.now())}")

    c.setStrokeColorRGB(*ORANGE)
    c.setLineWidth(1.2)
    c.line(margin_x, height - margin_x - 12 * mm, width - margin_x, height - margin_x - 12 * mm)


def _new_page(c, cliente, width, height, margin_x):
    c.showPage()
    _draw_header(c, cliente, width, height, margin_x)
    return height - margin_x - 22 * mm


def _draw_text_lines(c, text, x, y, max_width, *, font="Helvetica", size=8, leading=4 * mm, max_lines=3):
    lines = wrap_text(text, max_width, font, size)[:max_lines]
    c.setFont(font, size)
    for index, line in enumerate(lines):
        c.drawString(x, y - index * leading, line)
    return len(lines) * leading


def _draw_info_box(c, cliente, y, width, margin_x):
    box_h = 26 * mm
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(*BORDER)
    c.roundRect(margin_x, y - box_h, width - 2 * margin_x, box_h, 4 * mm, stroke=1, fill=1)

    datos = [
        ("Cliente", cliente.get("nombre") or "-"),
        ("DNI", cliente.get("dni") or "-"),
        ("Telefono", cliente.get("telefono") or "-"),
        ("CUIT", cliente.get("cuit") or "-"),
        ("IVA", cliente.get("condicion_iva") or "-"),
        ("Tipo", cliente.get("tipo_cliente") or "-"),
    ]
    col_w = (width - 2 * margin_x - 12 * mm) / 3
    for index, (label, value) in enumerate(datos):
        row = index // 3
        col = index % 3
        x = margin_x + 6 * mm + col * col_w
        yy = y - 7 * mm - row * 10 * mm
        c.setFillColorRGB(*MUTED)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x, yy, label.upper())
        c.setFillColorRGB(*INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x, yy - 4 * mm, _text(value)[:30])

    return y - box_h - 7 * mm


def _draw_summary(c, deudas, opciones_pago, y, width, margin_x):
    abiertas = _deudas_abiertas(deudas)
    cerradas = [d for d in deudas if d.get("estado") == "cerrada"]
    total_pendiente = sum(_dec(d.get("saldo_actual")) for d in abiertas)
    descuento_contado = _descuento_efectivo_transferencia(opciones_pago)
    total_contado = _monto_con_descuento(total_pendiente, descuento_contado)
    ahorro_contado = max(Decimal("0"), total_pendiente - total_contado)

    card_gap = 4 * mm
    card_w = (width - 2 * margin_x - 3 * card_gap) / 4
    cards = [
        ("Saldo de deuda", _money(total_pendiente), ORANGE),
        ("A cobrar efvo/transf", _money(total_contado), ORANGE),
        ("Ahorro contado", _money(ahorro_contado), INK),
        ("Deudas abiertas", str(len(abiertas)), INK),
    ]

    for index, (label, value, color) in enumerate(cards):
        x = margin_x + index * (card_w + card_gap)
        destacado = index in {0, 1}
        c.setFillColorRGB(*(ORANGE_SOFT if destacado else (1, 1, 1)))
        c.setStrokeColorRGB(*(ORANGE if destacado else BORDER))
        c.roundRect(x, y - 22 * mm, card_w, 22 * mm, 4 * mm, stroke=1, fill=1)
        c.setFillColorRGB(*MUTED)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x + 4 * mm, y - 7 * mm, label.upper())
        c.setFillColorRGB(*color)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x + 4 * mm, y - 15 * mm, value)

    if total_pendiente > 0:
        note_y = y - 27 * mm
        c.setFillColorRGB(1, 1, 1)
        c.setStrokeColorRGB(*BORDER)
        c.roundRect(margin_x, note_y - 10 * mm, width - 2 * margin_x, 10 * mm, 3 * mm, stroke=1, fill=1)
        c.setFillColorRGB(*BROWN)
        c.setFont("Helvetica-Bold", 8)
        if descuento_contado > 0:
            mensaje = (
                f"Para cancelar por efectivo o transferencia: el cliente paga {_money(total_contado)} "
                f"y eso cubre {_money(total_pendiente)} de deuda ({_format_percent(descuento_contado)}% OFF contado)."
            )
        else:
            mensaje = f"Para cancelar por efectivo o transferencia: el cliente paga {_money(total_pendiente)}."
        _draw_text_lines(c, mensaje, margin_x + 4 * mm, note_y - 4 * mm, width - 2 * margin_x - 8 * mm, size=7.8, max_lines=1)
        return note_y - 16 * mm

    return y - 28 * mm


def _estado_label(value):
    return _text(value or "-").replace("_", " ").upper()


def _draw_deuda_title(c, deuda, opciones_pago, y, width, margin_x):
    descuento_contado = _descuento_efectivo_transferencia(opciones_pago)
    saldo = _dec(deuda.get("saldo_actual"))
    esta_abierta = deuda.get("estado") == "abierta" and saldo > 0
    monto_contado = _monto_con_descuento(saldo, descuento_contado)
    ahorro = max(Decimal("0"), saldo - monto_contado)
    box_h = 25 * mm if esta_abierta else 20 * mm

    c.setFillColorRGB(*ORANGE_SOFT)
    c.setStrokeColorRGB(*ORANGE)
    c.roundRect(margin_x, y - box_h, width - 2 * margin_x, box_h, 3 * mm, stroke=1, fill=1)

    origen = f"{deuda.get('origen_tipo') or 'origen'} #{deuda.get('origen_id') or '-'}"
    if deuda.get("origen_tipo") == "venta":
        origen = f"Venta #{deuda.get('origen_id')}"

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x + 4 * mm, y - 7 * mm, f"Deuda #{deuda.get('id')} - {_estado_label(deuda.get('estado'))}")
    c.setFont("Helvetica", 8)
    c.drawString(margin_x + 4 * mm, y - 13 * mm, f"Origen: {origen}  |  Fecha venta: {_short_date(deuda.get('venta_fecha'))}")

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x - 4 * mm, y - 7 * mm, f"Saldo: {_money(deuda.get('saldo_actual'))}")
    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 8)
    if deuda.get("venta_total_final") is not None:
        c.drawRightString(width - margin_x - 4 * mm, y - 13 * mm, f"Total venta: {_money(deuda.get('venta_total_final'))}")

    if esta_abierta:
        c.setFillColorRGB(*BROWN)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(width - margin_x - 4 * mm, y - 19 * mm, f"A cobrar efvo/transf: {_money(monto_contado)}")
        if ahorro > 0:
            c.setFillColorRGB(*ORANGE)
            c.drawString(margin_x + 4 * mm, y - 19 * mm, f"Cubre saldo {_money(saldo)} con {_format_percent(descuento_contado)}% OFF - ahorro {_money(ahorro)}")

    return y - box_h - 5 * mm


def _draw_items(c, items, y, width, margin_x):
    if not items:
        return y

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin_x, y, "Detalle de la venta")
    y -= 5 * mm

    for item in items[:12]:
        row_h = 11 * mm
        if y - row_h < 25 * mm:
            return y
        c.setStrokeColorRGB(0.90, 0.92, 0.95)
        c.line(margin_x, y + 1 * mm, width - margin_x, y + 1 * mm)
        c.setFillColorRGB(*INK)
        used_h = _draw_text_lines(
            c,
            item.get("descripcion_snapshot") or "Item",
            margin_x,
            y - 3 * mm,
            width - 2 * margin_x - 62 * mm,
            font="Helvetica-Bold",
            size=7.6,
            leading=3.2 * mm,
            max_lines=2,
        )
        c.setFont("Helvetica", 8)
        c.drawRightString(width - margin_x - 36 * mm, y - 3 * mm, f"x {item.get('cantidad')}")
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(width - margin_x, y - 3 * mm, _money(item.get("subtotal") or item.get("precio_final")))
        y -= max(row_h, used_h + 4 * mm)

    if len(items) > 12:
        c.setFillColorRGB(*MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(margin_x, y, f"+ {len(items) - 12} item(s) mas")
        y -= 5 * mm

    return y - 3 * mm


def _draw_movimientos(c, movimientos, y, width, margin_x):
    if not movimientos:
        return y

    c.setFillColorRGB(*BROWN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin_x, y, "Movimientos registrados")
    y -= 5 * mm

    for movimiento in movimientos:
        if y < 27 * mm:
            return y
        tipo_raw = _text(movimiento.get("tipo_movimiento") or "Movimiento")
        tipo = tipo_raw.replace("_", " ")
        nota = _text(movimiento.get("nota"))
        es_pago = tipo_raw == "pago"
        monto_cubierto = _dec(movimiento.get("monto"))
        monto_cobrado = _dec(movimiento.get("pago_monto_total_cobrado"))
        c.setStrokeColorRGB(0.90, 0.92, 0.95)
        c.line(margin_x, y + 1 * mm, width - margin_x, y + 1 * mm)
        c.setFillColorRGB(*INK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin_x, y - 3 * mm, ("Pago registrado" if es_pago else tipo)[:42])
        if es_pago:
            c.drawRightString(width - margin_x, y - 3 * mm, f"Cubre deuda: {_money(monto_cubierto)}")
        else:
            c.drawRightString(width - margin_x, y - 3 * mm, _money(movimiento.get("monto")))
        detalle_pago = ""
        if es_pago and monto_cobrado > 0:
            medio = _text(movimiento.get("pago_medio_pago") or "").replace("_", " ").title()
            detalle_pago = f"Pago real del cliente: {_money(monto_cobrado)}"
            if medio:
                detalle_pago += f" - {medio}"
        if nota:
            c.setFillColorRGB(*MUTED)
            _draw_text_lines(
                c,
                nota,
                margin_x,
                y - 7 * mm,
                width - 2 * margin_x - 10 * mm,
                font="Helvetica",
                size=7,
                leading=3 * mm,
                max_lines=2,
            )
            if detalle_pago:
                c.setFillColorRGB(*BROWN)
                c.setFont("Helvetica-Bold", 7)
                c.drawString(margin_x, y - 13 * mm, detalle_pago[:95])
                y -= 16 * mm
            else:
                y -= 12 * mm
        else:
            if detalle_pago:
                c.setFillColorRGB(*BROWN)
                c.setFont("Helvetica-Bold", 7)
                c.drawString(margin_x, y - 7 * mm, detalle_pago[:95])
                y -= 11 * mm
            else:
                y -= 7 * mm

    return y - 4 * mm


def generar_estado_deuda_cliente_pdf(data: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin_x = 16 * mm

    cliente = data.get("cliente") or {}
    deudas = data.get("deudas") or []
    movimientos_por_deuda = data.get("movimientos_por_deuda") or {}
    items_por_deuda = data.get("items_por_deuda") or {}
    opciones_pago = data.get("opciones_pago") or {}

    set_pdf_metadata(c, f"Estado de deuda - {_text(cliente.get('nombre'))}")
    _draw_header(c, cliente, width, height, margin_x)
    y = height - margin_x - 22 * mm
    y = _draw_info_box(c, cliente, y, width, margin_x)
    y = _draw_summary(c, deudas, opciones_pago, y, width, margin_x)

    if not deudas:
        c.setFillColorRGB(*MUTED)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin_x, y, "El cliente no registra deudas en el sistema.")
        c.save()
        pdf = buffer.getvalue()
        buffer.close()
        return pdf

    for deuda in deudas:
        if y < 65 * mm:
            y = _new_page(c, cliente, width, height, margin_x)

        deuda_id = deuda.get("id")
        y = _draw_deuda_title(c, deuda, opciones_pago, y, width, margin_x)
        y = _draw_items(c, items_por_deuda.get(deuda_id) or [], y, width, margin_x)
        y = _draw_movimientos(c, movimientos_por_deuda.get(deuda_id) or [], y, width, margin_x)

        if deuda.get("observacion") and y > 35 * mm:
            c.setFillColorRGB(*MUTED)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(margin_x, y, "OBSERVACION")
            c.setFillColorRGB(*INK)
            _draw_text_lines(
                c,
                deuda.get("observacion"),
                margin_x,
                y - 4 * mm,
                width - 2 * margin_x,
                font="Helvetica",
                size=7.5,
                leading=3.2 * mm,
                max_lines=2,
            )
            y -= 13 * mm

        y -= 3 * mm

    c.setFillColorRGB(*MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(
        margin_x,
        12 * mm,
        "Resumen informativo generado desde el sistema. Los importes reflejan movimientos registrados a la fecha de emision.",
    )

    c.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
