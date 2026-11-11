from io import BytesIO

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _money(value):
    if value is None:
        return "-"
    amount = float(value)
    text = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {text}"


def _short(text, length=46):
    value = str(text or "-")
    return value if len(value) <= length else f"{value[:length - 3]}..."


def generar_informe_lista_precios_pdf(detail: dict) -> bytes:
    buffer = BytesIO()
    page = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=page)
    width, height = page
    selected = [item for item in detail.get("items", []) if item.get("seleccionado_aplicar")]

    def header():
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(14 * mm, height - 16 * mm, "INFORME DE ACTUALIZACION DE PRECIOS")
        pdf.setFont("Helvetica", 9)
        pdf.drawString(14 * mm, height - 23 * mm, f"Lote #{detail['id']} · {detail.get('proveedor_nombre') or detail.get('proveedor_nombre_snapshot')}")
        pdf.drawRightString(width - 14 * mm, height - 23 * mm, f"Estado: {str(detail.get('estado')).upper()}")
        pdf.drawString(14 * mm, height - 29 * mm, f"Archivo: {detail.get('nombre_archivo')} · Versión de cálculo: {detail.get('preview_version_aplicada') or detail.get('preview_version')}")
        if detail.get("aplicado_at"):
            pdf.drawString(14 * mm, height - 35 * mm, f"Aplicado: {detail['aplicado_at']} · Productos: {len(selected)}")
        if detail.get("revertido_at"):
            pdf.drawString(120 * mm, height - 35 * mm, f"Revertido: {detail['revertido_at']} · Motivo: {_short(detail.get('motivo_reversion'), 55)}")
        y = height - 45 * mm
        pdf.setFillColorRGB(0.95, 0.96, 0.98)
        pdf.rect(12 * mm, y - 5 * mm, width - 24 * mm, 8 * mm, fill=1, stroke=0)
        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont("Helvetica-Bold", 8)
        columns = [(14, "Producto"), (95, "Costo anterior"), (122, "Costo nuevo"), (149, "Minorista anterior"), (181, "Minorista nuevo"), (213, "Mayorista anterior"), (245, "Mayorista nuevo")]
        for x, label in columns:
            pdf.drawString(x * mm, y - 1 * mm, label)
        return y - 10 * mm

    y = header()
    pdf.setFont("Helvetica", 7.5)
    for item in selected:
        if y < 17 * mm:
            pdf.showPage()
            y = header()
            pdf.setFont("Helvetica", 7.5)
        product = f"{item.get('variante_producto_nombre') or item.get('descripcion_original')} {item.get('variante_nombre') or ''}"
        values = [
            _short(product),
            _money(item.get("costo_reposicion_anterior_snapshot")),
            _money(item.get("costo_reposicion_nuevo")),
            _money(item.get("precio_minorista_anterior_snapshot")),
            _money(item.get("precio_minorista_propuesto")),
            _money(item.get("precio_mayorista_anterior_snapshot")),
            _money(item.get("precio_mayorista_propuesto")),
        ]
        for (x, _), value in zip([(14, ""), (95, ""), (122, ""), (149, ""), (181, ""), (213, ""), (245, "")], values):
            pdf.drawString(x * mm, y, value)
        pdf.setStrokeColorRGB(0.88, 0.9, 0.93)
        pdf.line(12 * mm, y - 2.5 * mm, width - 12 * mm, y - 2.5 * mm)
        y -= 7 * mm

    pdf.setFont("Helvetica", 7)
    pdf.drawString(14 * mm, 9 * mm, "Documento interno de auditoría. Los valores corresponden al lote aplicado y a sus movimientos de precio asociados.")
    pdf.save()
    return buffer.getvalue()
