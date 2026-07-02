from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.modules.configuracion_negocio.service import obtener_configuracion_negocio
from app.modules.configuracion_negocio.template import lineas_configurables

from .pdf import (
    LOGO_HORIZONTAL,
    LOGO_ICONO,
    _draw_image_fit,
    _draw_service_placeholder,
    _es_item_servicio,
    _fecha,
    _money,
    _resolver_imagen_local,
    _text,
)
from .pdf_layout import (
    collapse_repeated_words,
    draw_wrapped_text,
    normalize_inline_text,
    strip_leading_label,
    wrap_text,
)


ESTADOS_HUMANOS = {
    "ingresada": "Ingresada",
    "presupuestada": "Presupuestada",
    "esperando_aprobacion": "Esperando aprobacion",
    "esperando_repuestos": "Esperando repuestos",
    "en_reparacion": "En reparacion",
    "terminada": "Terminada",
    "facturada": "Facturada",
    "lista_para_retirar": "Lista para retirar",
    "retirada": "Retirada",
    "cancelada": "Cancelada",
}

BOTTOM_MARGIN = 18 * mm
TEXT_LEADING = 4.2 * mm


def _estado_humano(estado: str | None) -> str:
    if not estado:
        return "-"
    return ESTADOS_HUMANOS.get(
        estado,
        str(estado).replace("_", " ").capitalize(),
    )


def _draw_watermark(c, width, height):
    if not LOGO_ICONO.exists():
        return

    c.saveState()
    try:
        c.setFillAlpha(0.04)
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


def _line(c, y, width, margin_x):
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    return y - 6 * mm


def _continuation_page(c, width, height, margin_x):
    c.showPage()
    _draw_watermark(c, width, height)
    y = height - 16 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "PRESUPUESTO TALLER")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin_x, y, "Continuacion")
    y -= 4 * mm
    c.setLineWidth(0.35)
    c.line(margin_x, y, width - margin_x, y)
    return y - 7 * mm


def _ensure_space(c, y, needed, width, height, margin_x):
    if y - needed >= BOTTOM_MARGIN:
        return y
    return _continuation_page(c, width, height, margin_x)


def _draw_field_pair(c, y, width, margin_x, left, right):
    gap = 8 * mm
    column_width = (width - (2 * margin_x) - gap) / 2
    left_x = margin_x
    right_x = margin_x + column_width + gap

    left_lines = wrap_text(left[1], column_width, "Helvetica", 9)
    right_lines = wrap_text(right[1], column_width, "Helvetica", 9)
    lines_count = max(len(left_lines), len(right_lines))
    needed = 4 * mm + lines_count * TEXT_LEADING + 2 * mm

    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColorRGB(0.32, 0.36, 0.43)
    c.drawString(left_x, y, left[0].upper())
    c.drawString(right_x, y, right[0].upper())
    c.setFillColorRGB(0, 0, 0)

    value_y = y - 4.3 * mm
    c.setFont("Helvetica", 9)
    for index, line in enumerate(left_lines):
        c.drawString(left_x, value_y - index * TEXT_LEADING, line)
    for index, line in enumerate(right_lines):
        c.drawString(right_x, value_y - index * TEXT_LEADING, line)

    return y - needed


def _draw_labeled_block(
    c,
    *,
    y,
    width,
    height,
    margin_x,
    label,
    value,
    font_name="Helvetica",
    font_size=9,
):
    max_width = width - 2 * margin_x - 4 * mm
    lines = wrap_text(value, max_width, font_name, font_size)
    needed = 5 * mm + len(lines) * TEXT_LEADING + 2 * mm
    y = _ensure_space(c, y, needed, width, height, margin_x)

    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(0.32, 0.36, 0.43)
    c.drawString(margin_x, y, label.upper())
    c.setFillColorRGB(0, 0, 0)
    y -= 4.7 * mm
    y = draw_wrapped_text(
        c,
        value,
        x=margin_x + 3 * mm,
        y=y,
        max_width=max_width,
        font_name=font_name,
        font_size=font_size,
        leading=TEXT_LEADING,
    )
    return y - 1.5 * mm


def _bicicleta_textos(orden):
    principal = collapse_repeated_words(
        " ".join(
            filter(
                None,
                [
                    normalize_inline_text(orden.get("bicicleta_marca")),
                    normalize_inline_text(orden.get("bicicleta_modelo")),
                ],
            )
        )
    )
    principal = strip_leading_label(principal, "bicicleta")
    if not principal:
        principal = strip_leading_label(
            orden.get("bicicleta_descripcion"),
            "bicicleta",
        )

    detalles = []
    if orden.get("bicicleta_rodado"):
        detalles.append(f"Rodado {normalize_inline_text(orden['bicicleta_rodado'])}")
    if orden.get("bicicleta_color"):
        detalles.append(normalize_inline_text(orden["bicicleta_color"]))

    return principal or "-", " - ".join(detalles)


def _table_header(c, y, width, margin_x):
    c.setFillColorRGB(0.96, 0.97, 0.98)
    c.rect(margin_x, y - 6 * mm, width - 2 * margin_x, 7.5 * mm, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin_x + 1 * mm, y - 3.5 * mm, "Img.")
    c.drawString(margin_x + 20 * mm, y - 3.5 * mm, "Detalle")
    c.drawRightString(width - margin_x - 52 * mm, y - 3.5 * mm, "Cant.")
    c.drawRightString(width - margin_x - 24 * mm, y - 3.5 * mm, "Unitario")
    c.drawRightString(width - margin_x - 1 * mm, y - 3.5 * mm, "Subtotal")
    return y - 10 * mm


def _new_table_page(c, width, height, margin_x):
    y = _continuation_page(c, width, height, margin_x)
    return _table_header(c, y, width, margin_x)


def _draw_row_chunk(
    c,
    *,
    y,
    width,
    margin_x,
    lines,
    cantidad,
    precio,
    subtotal,
    imagen,
    es_servicio,
    first_chunk,
    last_chunk,
):
    line_height = 4.2 * mm
    padding_top = 2 * mm
    padding_bottom = 3 * mm
    img_size = 14 * mm
    min_height = 17 * mm if first_chunk else 8 * mm
    row_height = max(
        min_height,
        padding_top + len(lines) * line_height + padding_bottom,
    )
    text_x = margin_x + 20 * mm
    text_right = width - margin_x - 65 * mm
    text_width = text_right - text_x
    text_y = y - padding_top

    if first_chunk:
        img_path = _resolver_imagen_local(imagen)
        if img_path:
            _draw_image_fit(
                c,
                img_path,
                margin_x + 1 * mm,
                y - img_size,
                img_size,
                img_size,
            )
        elif es_servicio:
            _draw_service_placeholder(
                c,
                margin_x + 1 * mm,
                y - img_size,
                img_size,
                img_size,
            )
        else:
            c.setFont("Helvetica", 6)
            c.drawCentredString(
                margin_x + 8 * mm,
                y - 7 * mm,
                "Sin img.",
            )

    c.setFont("Helvetica", 8)
    for line in lines:
        c.drawString(text_x, text_y, line)
        text_y -= line_height

    if first_chunk:
        value_y = y - padding_top
        c.setFont("Helvetica", 7.5)
        c.drawRightString(
            width - margin_x - 52 * mm,
            value_y,
            f"{cantidad:g}",
        )
        c.drawRightString(
            width - margin_x - 24 * mm,
            value_y,
            _money(precio),
        )
        c.drawRightString(
            width - margin_x - 1 * mm,
            value_y,
            _money(subtotal),
        )

    y -= row_height
    if last_chunk:
        c.setLineWidth(0.2)
        c.line(margin_x, y, width - margin_x, y)
        y -= 3 * mm

    return y, text_width


def _draw_item(
    c,
    *,
    y,
    width,
    height,
    margin_x,
    detalle,
    cantidad,
    precio,
    subtotal,
    imagen,
    es_servicio,
):
    text_x = margin_x + 20 * mm
    text_right = width - margin_x - 65 * mm
    text_width = text_right - text_x
    lines = wrap_text(detalle, text_width, "Helvetica", 8)
    first_chunk = True

    while lines:
        if y < BOTTOM_MARGIN + 17 * mm:
            y = _new_table_page(c, width, height, margin_x)

        available_height = y - BOTTOM_MARGIN - 5 * mm
        max_lines = max(1, int((available_height - 5 * mm) / (4.2 * mm)))
        chunk = lines[:max_lines]
        lines = lines[max_lines:]

        y, _ = _draw_row_chunk(
            c,
            y=y,
            width=width,
            margin_x=margin_x,
            lines=chunk,
            cantidad=cantidad,
            precio=precio,
            subtotal=subtotal,
            imagen=imagen,
            es_servicio=es_servicio,
            first_chunk=first_chunk,
            last_chunk=not lines,
        )
        first_chunk = False

        if lines:
            y = _new_table_page(c, width, height, margin_x)

    return y


def generar_presupuesto_taller_pdf(data: dict) -> bytes:
    orden = data["orden"]
    items = data.get("items", [])
    notas = data.get("notas", [])
    config = obtener_configuracion_negocio()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin_x = 16 * mm

    _draw_watermark(c, width, height)
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
        c.drawString(
            margin_x,
            y,
            normalize_inline_text(config.get("nombre_negocio")).upper(),
        )

    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - margin_x, y, "PRESUPUESTO TALLER")
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, "NO FISCAL")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x, y, f"Orden de taller #{orden['id']}")
    y -= 5 * mm
    c.setFont("Helvetica", 9)
    c.drawRightString(width - margin_x, y, f"Fecha: {_fecha(datetime.now())}")
    y -= 12 * mm
    y = _line(c, y, width, margin_x)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Datos del cliente y bicicleta")
    y -= 8 * mm

    y = _draw_field_pair(
        c,
        y,
        width,
        margin_x,
        ("Cliente", collapse_repeated_words(orden.get("cliente_nombre")) or "-"),
        ("Telefono", normalize_inline_text(orden.get("cliente_telefono")) or "-"),
    )
    y = _draw_field_pair(
        c,
        y,
        width,
        margin_x,
        ("DNI", normalize_inline_text(orden.get("cliente_dni")) or "-"),
        ("Estado", _estado_humano(orden.get("estado"))),
    )
    responsable = (
        orden.get("tecnico_nombre")
        or orden.get("usuario_creador_nombre")
        or "-"
    )
    y = _draw_field_pair(
        c,
        y,
        width,
        margin_x,
        ("Responsable", collapse_repeated_words(responsable)),
        (
            "Entrega estimada",
            _fecha(orden.get("fecha_prometida")) or "-",
        ),
    )

    bicicleta_principal, bicicleta_detalle = _bicicleta_textos(orden)
    bicicleta = bicicleta_principal
    if bicicleta_detalle:
        bicicleta += f"\n{bicicleta_detalle}"
    y = _draw_labeled_block(
        c,
        y=y,
        width=width,
        height=height,
        margin_x=margin_x,
        label="Bicicleta",
        value=bicicleta,
        font_name="Helvetica-Bold",
        font_size=9.5,
    )

    if orden.get("bicicleta_numero_cuadro"):
        y = _draw_labeled_block(
            c,
            y=y,
            width=width,
            height=height,
            margin_x=margin_x,
            label="N. de cuadro",
            value=normalize_inline_text(orden.get("bicicleta_numero_cuadro")),
        )

    y = _draw_labeled_block(
        c,
        y=y,
        width=width,
        height=height,
        margin_x=margin_x,
        label="Problema reportado",
        value=collapse_repeated_words(orden.get("problema_reportado")) or "-",
    )

    observaciones = _text(orden.get("observaciones")).strip()
    if observaciones:
        y = _draw_labeled_block(
            c,
            y=y,
            width=width,
            height=height,
            margin_x=margin_x,
            label="Observaciones",
            value=observaciones,
        )

    if notas:
        for nota in notas:
            label = (
                "Recomendacion futura"
                if nota.get("tipo") == "recomendacion_futura"
                else "Nota para cliente"
            )
            y = _draw_labeled_block(
                c,
                y=y,
                width=width,
                height=height,
                margin_x=margin_x,
                label=label,
                value=nota.get("contenido"),
            )

    y = _ensure_space(c, y, 20 * mm, width, height, margin_x)
    y -= 3 * mm
    y = _line(c, y, width, margin_x)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, y, "Detalle presupuestado")
    y -= 6 * mm
    y = _table_header(c, y, width, margin_x)

    total = Decimal("0")
    for item in items:
        cantidad = Decimal(str(item.get("cantidad") or 0))
        precio = Decimal(str(item.get("precio_unitario") or 0))
        cobertura = Decimal(str(item.get("valor_cobertura_unitario") or 0))
        subtotal = Decimal(str(item.get("subtotal") or 0))
        total += subtotal

        detalle = collapse_repeated_words(item.get("descripcion_snapshot"))
        if cobertura > 0:
            detalle += (
                f"\nCobertura {normalize_inline_text(item.get('motivo_cobertura'))}: "
                f"-{_money(cobertura * cantidad)}"
            )
            if item.get("observacion_cobertura"):
                detalle += (
                    f"\n{normalize_inline_text(item.get('observacion_cobertura'))}"
                )

        y = _draw_item(
            c,
            y=y,
            width=width,
            height=height,
            margin_x=margin_x,
            detalle=detalle,
            cantidad=cantidad,
            precio=precio,
            subtotal=subtotal,
            imagen=item.get("imagen_principal"),
            es_servicio=_es_item_servicio(item),
        )

    y = _ensure_space(c, y, 34 * mm, width, height, margin_x)
    y -= 2 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin_x - 34 * mm, y, "TOTAL")
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - margin_x, y, _money(total))
    y -= 12 * mm
    y = _line(c, y, width, margin_x)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, y, "Condiciones")
    y -= 6 * mm
    condiciones = lineas_configurables(
        config.get("condiciones_presupuesto_taller"),
        config,
    )

    for condicion in condiciones:
        lines = wrap_text(
            f"- {condicion}",
            width - 2 * margin_x,
            "Helvetica",
            8,
        )
        for line in lines:
            y = _ensure_space(c, y, 6 * mm, width, height, margin_x)
            c.setFont("Helvetica", 8)
            c.drawString(margin_x, y, line)
            y -= 4.5 * mm

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
