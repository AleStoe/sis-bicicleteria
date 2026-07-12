from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.modules.documentos.brand import (
    BORDER_HEX,
    BROWN_HEX,
    INK_HEX,
    MUTED_HEX,
    ORANGE_HEX,
    ORANGE_SOFT_HEX,
    PAPER_HEX,
)


def _dec(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _money(value) -> str:
    amount = _dec(value).quantize(Decimal("0.01"))
    sign = "-" if amount < 0 else ""
    amount = abs(amount)
    integer, decimals = f"{amount:.2f}".split(".")
    groups = []
    while integer:
        groups.insert(0, integer[-3:])
        integer = integer[:-3]
    return f"{sign}$ {'.'.join(groups)},{decimals}"


def _percent(value) -> str:
    amount = _dec(value).quantize(Decimal("0.1"))
    return f"{amount}%"


def _ratio(numerator, denominator) -> Decimal:
    den = _dec(denominator)
    if den <= 0:
        return Decimal("0")
    return (_dec(numerator) / den * Decimal("100")).quantize(Decimal("0.1"))


def _fecha(value) -> str:
    if isinstance(value, (date, datetime)):
        return value.strftime("%d/%m/%Y")
    return str(value or "-")


def _periodo(data: dict) -> str:
    return f"{_fecha(data.get('fecha_desde'))} al {_fecha(data.get('fecha_hasta'))}"


def _p(text, style):
    return Paragraph(str(text or ""), style)


def _metric_card(label, value, styles, *, highlight=False):
    color = ORANGE_HEX if highlight else INK_HEX
    return [
        _p(label, styles["metric_label"]),
        _p(value, ParagraphStyle("MetricValueCustom", parent=styles["metric_value"], textColor=color)),
    ]


def _kpis(data: dict) -> list[tuple[str, str]]:
    venta = _dec(data.get("venta_comercial") or data.get("ventas_netas"))
    cmv = _dec(data.get("cmv_comercial") or data.get("cmv_neto"))
    margen = _dec(data.get("margen_esperado") or data.get("margen_bruto"))
    cobrado = _dec(data.get("cobrado_comercial_reconocido"))
    utilidad = _dec(data.get("utilidad_liberada"))
    resultado = _dec(data.get("resultado_distribuible"))

    return [
        ("% capital recuperado", _percent(_ratio(data.get("capital_recuperado"), cmv))),
        ("% utilidad liberada", _percent(_ratio(utilidad, margen))),
        ("% cobranza sobre ventas", _percent(_ratio(cobrado, venta))),
        ("Margen comercial", _percent(_ratio(margen, venta))),
        ("Rentabilidad efectiva", _percent(_ratio(resultado, venta))),
    ]


def _observaciones(data: dict, anterior: dict | None = None) -> list[str]:
    venta = _dec(data.get("venta_comercial") or data.get("ventas_netas"))
    margen = _dec(data.get("margen_esperado") or data.get("margen_bruto"))
    cobrado = _dec(data.get("cobrado_comercial_reconocido"))
    pendiente = _dec(data.get("saldo_pendiente_por_cobrar"))
    devoluciones = _dec(data.get("devoluciones_total"))
    resultado_financiero = _dec(data.get("resultado_financiero"))
    gastos = _dec(data.get("gastos_operativos"))
    utilidad = _dec(data.get("utilidad_liberada"))
    distribuible = _dec(data.get("resultado_distribuible"))
    capital_recuperado = _dec(data.get("capital_recuperado"))
    cmv = _dec(data.get("cmv_comercial") or data.get("cmv_neto"))

    obs = [
        f"Se recupero el {_percent(_ratio(capital_recuperado, cmv))} del capital vendido.",
    ]
    if pendiente > 0:
        obs.append(f"Existen ventas pendientes de cobro por {_money(pendiente)}.")
    else:
        obs.append("No quedan saldos pendientes de cobro en el periodo analizado.")

    if devoluciones > 0:
        obs.append(
            f"Las devoluciones representan el {_percent(_ratio(devoluciones, venta))} de las ventas comerciales."
        )

    if resultado_financiero > 0:
        obs.append(f"El resultado financiero fue positivo: {_money(resultado_financiero)}.")
    elif resultado_financiero < 0:
        obs.append(f"El resultado financiero fue negativo: {_money(resultado_financiero)}.")
    else:
        obs.append("El resultado financiero del periodo fue neutro.")

    if venta > 0:
        obs.append(f"Los gastos operativos representaron el {_percent(_ratio(gastos, venta))} de las ventas.")
    if utilidad > 0:
        obs.append(f"La utilidad liberada por caja fue {_money(utilidad)}.")
    if distribuible > 0:
        obs.append(
            f"El resultado distribuible fue positivo y permite distribuir {_money(distribuible)} sin comprometer capital de trabajo registrado."
        )
    else:
        obs.append("El resultado distribuible no arroja saldo positivo para distribuir en este periodo.")

    if anterior:
        venta_anterior = _dec(anterior.get("venta_comercial") or anterior.get("ventas_netas"))
        if venta_anterior > 0:
            variacion = ((venta - venta_anterior) / venta_anterior * Decimal("100")).quantize(Decimal("0.1"))
            verbo = "crecieron" if variacion >= 0 else "bajaron"
            obs.insert(0, f"Las ventas {verbo} {abs(variacion)}% respecto del periodo anterior.")

    if margen <= 0 and venta > 0:
        obs.append("El margen comercial esperado quedo en cero o negativo; conviene revisar costos y bonificaciones.")

    return obs


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor(ORANGE_HEX))
    canvas.setLineWidth(1)
    canvas.line(doc.leftMargin, A4[1] - 16 * mm, A4[0] - doc.rightMargin, A4[1] - 16 * mm)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(colors.HexColor(BROWN_HEX))
    canvas.drawString(doc.leftMargin, A4[1] - 12 * mm, "Emprendimiento Agus")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor(MUTED_HEX))
    canvas.drawRightString(A4[0] - doc.rightMargin, 12 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def generar_resultado_distribuible_pdf(
    data: dict,
    *,
    periodo_anterior: dict | None = None,
    detalle_diario: list[dict] | None = None,
    sucursal_label: str | None = None,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="Informe Resultado Distribuible",
    )

    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "EAReportTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=30,
            textColor=colors.HexColor(BROWN_HEX),
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "EAReportSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=colors.HexColor(MUTED_HEX),
            spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "EASection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=colors.HexColor(INK_HEX),
            spaceBefore=10,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "EABody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor(INK_HEX),
        ),
        "small": ParagraphStyle(
            "EASmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor(MUTED_HEX),
        ),
        "metric_label": ParagraphStyle(
            "EAMetricLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.6,
            leading=9,
            textColor=colors.HexColor(MUTED_HEX),
            uppercase=True,
        ),
        "metric_value": ParagraphStyle(
            "EAMetricValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=16,
            textColor=colors.HexColor(INK_HEX),
        ),
        "result_value": ParagraphStyle(
            "EAResultValue",
            parent=base["Normal"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=28,
            leading=32,
            textColor=colors.HexColor(ORANGE_HEX),
        ),
        "result_label": ParagraphStyle(
            "EAResultLabel",
            parent=base["Normal"],
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor(BROWN_HEX),
        ),
        "table_header": ParagraphStyle(
            "EATableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor(MUTED_HEX),
        ),
        "table_cell": ParagraphStyle(
            "EATableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor(INK_HEX),
        ),
        "table_money": ParagraphStyle(
            "EATableMoney",
            parent=base["Normal"],
            alignment=TA_RIGHT,
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor(INK_HEX),
        ),
    }

    story = []
    sucursal = sucursal_label or ("Todas las sucursales" if not data.get("id_sucursal") else f"Sucursal #{data.get('id_sucursal')}")
    generado = datetime.now().strftime("%d/%m/%Y %H:%M")

    story.append(Spacer(1, 28 * mm))
    story.append(_p("Informe ejecutivo", styles["subtitle"]))
    story.append(_p("Resultado Distribuible", styles["title"]))
    story.append(_p("Emprendimiento Agus", styles["section"]))
    story.append(_p(f"Periodo analizado: {_periodo(data)}", styles["body"]))
    story.append(_p(f"Fecha de emision: {generado}", styles["body"]))
    story.append(_p(f"Sucursal: {sucursal}", styles["body"]))
    story.append(Spacer(1, 18 * mm))

    result_box = Table(
        [[
            _p("RESULTADO DISTRIBUIBLE FINAL", styles["result_label"]),
            _p(_money(data.get("resultado_distribuible")), styles["result_value"]),
        ]],
        colWidths=[70 * mm, 86 * mm],
    )
    result_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(ORANGE_SOFT_HEX)),
                ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor(ORANGE_HEX)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 16),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
            ]
        )
    )
    story.append(result_box)
    story.append(Spacer(1, 18 * mm))
    story.append(_p(
        "Este informe separa rentabilidad comercial, recuperacion de capital, resultado financiero y capacidad real de distribucion.",
        styles["subtitle"],
    ))
    story.append(PageBreak())

    def metric_grid(items, columns=3):
        rows = []
        row = []
        for label, value, highlight in items:
            row.append(_metric_card(label, value, styles, highlight=highlight))
            if len(row) == columns:
                rows.append(row)
                row = []
        if row:
            while len(row) < columns:
                row.append("")
            rows.append(row)
        table = Table(rows, colWidths=[(A4[0] - doc.leftMargin - doc.rightMargin) / columns] * columns)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(BORDER_HEX)),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor(BORDER_HEX)),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        return table

    story.append(_p("1. Resumen Comercial", styles["section"]))
    story.append(metric_grid([
        ("Total vendido", _money(data.get("venta_comercial") or data.get("ventas_netas")), False),
        ("Cantidad de ventas", str(data.get("cantidad_ventas") or "-"), False),
        ("Ticket promedio", _money(_dec(data.get("venta_comercial") or data.get("ventas_netas")) / _dec(data.get("cantidad_ventas") or 1)), False),
        ("CMV", _money(data.get("cmv_comercial") or data.get("cmv_neto")), False),
        ("Margen esperado", _money(data.get("margen_esperado") or data.get("margen_bruto")), True),
        ("Devoluciones", _money(data.get("devoluciones_total")), False),
    ]))
    if _dec(data.get("devoluciones_total")) > 0:
        story.append(Spacer(1, 6))
        story.append(_p("Nota: las devoluciones reducen ventas y CMV del periodo segun la informacion registrada.", styles["small"]))

    story.append(_p("2. Cobranza", styles["section"]))
    story.append(metric_grid([
        ("Total efectivamente cobrado", _money(data.get("ingreso_real_neto") or data.get("cobrado_comercial_reconocido")), False),
        ("Cobros pendientes", _money(data.get("saldo_pendiente_por_cobrar")), False),
        ("Capital recuperado", _money(data.get("capital_recuperado")), True),
        ("Capital inmovilizado", _money(data.get("capital_inmovilizado")), False),
    ], columns=2))

    story.append(_p("3. Resultado Economico", styles["section"]))
    resultado = Table(
        [
            [_p("Utilidad liberada", styles["table_cell"]), _p(_money(data.get("utilidad_liberada")), styles["table_money"])],
            [_p("Resultado financiero", styles["table_cell"]), _p(_money(data.get("resultado_financiero")), styles["table_money"])],
            [_p("Gastos operativos", styles["table_cell"]), _p(f"- {_money(data.get('gastos_operativos'))}", styles["table_money"])],
            [_p("Resultado distribuible final", styles["metric_value"]), _p(_money(data.get("resultado_distribuible")), styles["result_value"])],
        ],
        colWidths=[95 * mm, 61 * mm],
    )
    resultado.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -2), colors.HexColor(PAPER_HEX)),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor(ORANGE_SOFT_HEX)),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor(ORANGE_HEX)),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor(BORDER_HEX)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(resultado)

    story.append(_p("4. Indicadores", styles["section"]))
    kpi_rows = [[_p(k, styles["table_cell"]), _p(v, styles["table_money"])] for k, v in _kpis(data)]
    kpi_table = Table(kpi_rows, colWidths=[105 * mm, 51 * mm])
    kpi_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(BORDER_HEX)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(BORDER_HEX)),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(kpi_table)

    story.append(_p("5. Observaciones automaticas", styles["section"]))
    obs_rows = [[_p(f"- {text}", styles["body"])] for text in _observaciones(data, periodo_anterior)]
    obs_table = Table(obs_rows, colWidths=[156 * mm])
    obs_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PAPER_HEX)),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(BORDER_HEX)),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(obs_table)

    distribuciones = data.get("distribuciones_sugeridas") or []
    if distribuciones:
        story.append(_p("Distribucion sugerida", styles["section"]))
        rows = [[_p("Destino", styles["table_header"]), _p("%", styles["table_header"]), _p("Monto", styles["table_header"])]]
        for item in distribuciones:
            rows.append([
                _p(item.get("participante_nombre"), styles["table_cell"]),
                _p(_percent(item.get("porcentaje")), styles["table_money"]),
                _p(_money(item.get("monto")), styles["table_money"]),
            ])
        dist_table = Table(rows, colWidths=[80 * mm, 26 * mm, 50 * mm])
        dist_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(ORANGE_SOFT_HEX)),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(BORDER_HEX)),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(BORDER_HEX)),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(dist_table)

    if detalle_diario:
        story.append(PageBreak())
        story.append(_p("6. Anexo - detalle diario", styles["section"]))
        story.append(_p("Resumen por dia con ventas, cobranza, capital y utilidad liberada.", styles["subtitle"]))
        rows = [[
            _p("Fecha", styles["table_header"]),
            _p("Ventas", styles["table_header"]),
            _p("Vendido", styles["table_header"]),
            _p("Cobrado", styles["table_header"]),
            _p("Capital inmov.", styles["table_header"]),
            _p("Utilidad", styles["table_header"]),
        ]]
        for item in detalle_diario:
            if not item.get("cantidad_ventas") and _dec(item.get("venta_comercial")) <= 0:
                continue
            rows.append([
                _p(_fecha(item.get("fecha")), styles["table_cell"]),
                _p(str(item.get("cantidad_ventas") or 0), styles["table_money"]),
                _p(_money(item.get("venta_comercial") or item.get("ventas_netas")), styles["table_money"]),
                _p(_money(item.get("cobrado_comercial_reconocido")), styles["table_money"]),
                _p(_money(item.get("capital_inmovilizado")), styles["table_money"]),
                _p(_money(item.get("utilidad_liberada")), styles["table_money"]),
            ])
        if len(rows) == 1:
            rows.append([_p("Sin movimientos diarios para mostrar.", styles["table_cell"]), "", "", "", "", ""])
        daily_table = Table(rows, colWidths=[25 * mm, 18 * mm, 31 * mm, 31 * mm, 31 * mm, 20 * mm], repeatRows=1)
        daily_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(ORANGE_SOFT_HEX)),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(BORDER_HEX)),
                    ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor(BORDER_HEX)),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(daily_table)

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()
