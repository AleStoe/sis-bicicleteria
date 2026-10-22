import csv
import io
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import load_workbook
from PIL import Image
from pypdf import PdfReader
import pypdfium2 as pdfium
from rapidocr import RapidOCR


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
TEXT_EXTENSIONS = {".csv", ".txt"}
ALLOWED_EXTENSIONS = {".pdf", ".xlsx", *IMAGE_EXTENSIONS, *TEXT_EXTENSIONS}
_OCR_ENGINE = None


@dataclass
class DocumentExtraction:
    estado: str
    extractor: str
    texto: str = ""
    filas: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    error: str | None = None


def _decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    text = str(value).strip().replace("$", "").replace("\u00a0", "").replace(" ", "")
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _normalizar_header(value) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[^a-z0-9]", "", text.translate(str.maketrans("áéíóúñ", "aeioun")))


def _buscar_columna(headers: list[str], aliases: set[str]) -> int | None:
    for index, header in enumerate(headers):
        if header in aliases:
            return index
    return None


def _extraer_xlsx(content: bytes) -> DocumentExtraction:
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return DocumentExtraction("requiere_revision", "openpyxl", error="El Excel está vacío.")

    aliases = {
        "codigo": {"codigo", "cod", "sku", "codigoproducto", "codigoprov", "codigoproveedor"},
        "descripcion": {"producto", "descripcion", "nombre", "detalle", "articulo"},
        "cantidad": {"cantidad", "cant", "unidades", "unidad"},
        "costo": {"costo", "costounitario", "precio", "preciounitario", "costofinalporunidad"},
        "descuento": {"descuento", "descuento%", "desc", "desc%", "porcentajedescuento"},
    }
    header_index = None
    columns = {}
    for index, row in enumerate(rows[:20]):
        headers = [_normalizar_header(value) for value in row]
        candidate = {key: _buscar_columna(headers, values) for key, values in aliases.items()}
        if all(candidate[key] is not None for key in ("codigo", "descripcion", "cantidad", "costo")):
            header_index = index
            columns = candidate
            break
    if header_index is None:
        return DocumentExtraction(
            "requiere_revision",
            "openpyxl",
            error="No encontré columnas de código, producto, cantidad y costo.",
        )

    filas = []
    for row_number, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
        codigo = row[columns["codigo"]] if columns["codigo"] < len(row) else None
        descripcion = row[columns["descripcion"]] if columns["descripcion"] < len(row) else None
        cantidad = row[columns["cantidad"]] if columns["cantidad"] < len(row) else None
        costo = row[columns["costo"]] if columns["costo"] < len(row) else None
        if all(value in (None, "") for value in (codigo, descripcion, cantidad, costo)):
            continue
        descuento = None
        if columns.get("descuento") is not None and columns["descuento"] < len(row):
            descuento = _decimal(row[columns["descuento"]])
        filas.append(
            {
                "numero_linea": row_number,
                "codigo": str(codigo or "").strip(),
                "descripcion": str(descripcion or "").strip(),
                "cantidad": cantidad,
                "costo_unitario": costo,
                "descuento_linea_pct": descuento or Decimal("0"),
                "confianza_campos": {"codigo": 1, "descripcion": 1, "cantidad": 1, "costo": 1},
            }
        )

    return DocumentExtraction(
        "extraido" if filas else "requiere_revision",
        "openpyxl",
        filas=filas,
        metadata={"hoja": sheet.title, "fila_encabezado": header_index + 1, "filas_detectadas": len(filas)},
        error=None if filas else "No encontré productos debajo del encabezado.",
    )


def _extraer_factura_corchetes(text: str) -> list[dict]:
    pattern = re.compile(
        r"\[(?P<codigo>[^\]]+)\]\s+(?P<descripcion>.+?)\n"
        r"(?P<cantidad>\d+(?:[.,]\d+)?)\n"
        r"(?P<costo>[\d.]+,\d+)\n"
        r"(?P<descuento>[\d.]+(?:,\d+)?)\n"
        r"(?:IVA\s+)?\d+%\s*\n\$\s*\n?(?P<importe>[\d.]+,\d+)",
        re.IGNORECASE | re.DOTALL,
    )
    filas = []
    for index, match in enumerate(pattern.finditer(text), start=1):
        filas.append(
            {
                "numero_linea": index,
                "codigo": match.group("codigo").strip(),
                "descripcion": " ".join(match.group("descripcion").split()),
                "cantidad": match.group("cantidad"),
                "costo_unitario": match.group("costo"),
                "descuento_linea_pct": _decimal(match.group("descuento")) or Decimal("0"),
            }
        )
    return filas


def _extraer_pedido_columnas(text: str) -> list[dict]:
    pattern = re.compile(
        r"^\S+\s+\d+\s+\S+\s+(?P<codigo>\d{6,})\s+"
        r"(?P<descripcion>.+?)\s+(?P<cantidad>\d+(?:,\d+)?)\s+"
        r"(?P<costo>[\d.]+,\d+)\s+[\d.]+,\d+\s+\d+\s*$"
    )
    filas = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        match = pattern.match(line.strip())
        if match:
            filas.append(
                {
                    "numero_linea": line_number,
                    "codigo": match.group("codigo"),
                    "descripcion": " ".join(match.group("descripcion").split()),
                    "cantidad": match.group("cantidad"),
                    "costo_unitario": match.group("costo"),
                    "descuento_linea_pct": Decimal("0"),
                }
            )
    return filas


def _extraer_factura_pg_bike(text: str) -> list[dict]:
    if not re.search(
        r"CODIGO\s+DESCRIPCION\s+CANT\.\s+P\.\s+UNITARIO\s+TOTAL",
        text,
        re.IGNORECASE,
    ):
        return []

    pattern = re.compile(
        r"^(?P<codigo>\d{9})\s+(?P<descripcion>.+?)\s+"
        r"(?P<cantidad>\d+(?:,\d+)?)\s+"
        r"(?P<costo>[\d.]+,\d{2})\s+"
        r"(?P<total>[\d.]+,\d{2})\s*$"
    )
    filas = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        match = pattern.match(" ".join(line.split()))
        if not match:
            continue
        cantidad = _decimal(match.group("cantidad"))
        costo = _decimal(match.group("costo"))
        total = _decimal(match.group("total"))
        if cantidad is None or costo is None or total is None:
            continue
        if abs((cantidad * costo) - total) > Decimal("0.10"):
            continue
        filas.append(
            {
                "numero_linea": line_number,
                "codigo": match.group("codigo"),
                "descripcion": " ".join(match.group("descripcion").split()),
                "cantidad": match.group("cantidad"),
                "costo_unitario": match.group("costo"),
                "descuento_linea_pct": Decimal("0"),
                "total_linea_documental": str(total),
                "confianza_campos": {
                    "codigo": 1,
                    "descripcion": 1,
                    "cantidad": 1,
                    "costo": 1,
                },
            }
        )
    return filas


_IMPORTE_PERETTI = r"\d{1,3}(?:\.\d{3})*,\d{2}"


def _es_continuacion_descripcion_peretti(linea: str) -> bool:
    texto = " ".join(str(linea or "").split())
    if not texto or ":" in texto or "ARS" in texto.upper():
        return False
    bloqueados = (
        "BICI PERETTI",
        "CODIGO",
        "ORIGINAL - PAG",
        "CONDICION DE VENTA",
        "RESPONSABLE INSCRIPTO",
        "CUIT",
        "C.U.I.T",
    )
    normalizado = _normalizar_header(texto)
    return bool(re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", texto)) and not any(
        _normalizar_header(valor) in normalizado for valor in bloqueados
    )


def _separar_descripcion_cantidad_peretti(
    prefijo: str,
    total: Decimal,
    costo: Decimal,
) -> tuple[str, str] | None:
    candidatos = []
    for posicion, caracter in enumerate(prefijo):
        if not caracter.isdigit():
            continue
        cantidad_texto = prefijo[posicion:]
        if not re.fullmatch(r"\d+(?:,\d{2})", cantidad_texto):
            continue
        cantidad = _decimal(cantidad_texto)
        descripcion = prefijo[:posicion].strip()
        if cantidad is None or cantidad <= 0 or not descripcion:
            continue
        diferencia = abs((cantidad * costo) - total)
        tolerancia = max(Decimal("0.10"), cantidad * Decimal("0.01"))
        if diferencia <= tolerancia:
            candidatos.append((diferencia, -len(descripcion), descripcion, cantidad_texto))

    if not candidatos:
        return None
    _, _, descripcion, cantidad_texto = min(candidatos)
    return descripcion, cantidad_texto


def _extraer_factura_bici_peretti(text: str) -> list[dict]:
    if "BICI PERETTI" not in text.upper():
        return []

    patron = re.compile(
        rf"^(?P<prefijo>.+?)\s+"
        rf"(?P<total>{_IMPORTE_PERETTI})"
        rf"(?P<precio_lista>{_IMPORTE_PERETTI})\s+"
        rf"ARS\s*(?P<costo>{_IMPORTE_PERETTI})\s+"
        r"(?P<codigo>\d{7}(?:-[A-Z0-9]+)?)\s*$",
        re.IGNORECASE,
    )
    lineas = text.splitlines()
    filas = []
    for indice, original in enumerate(lineas):
        linea = " ".join(original.split())
        match = patron.match(linea)
        if not match:
            continue

        total = _decimal(match.group("total"))
        costo = _decimal(match.group("costo"))
        if total is None or costo is None:
            continue
        partes = _separar_descripcion_cantidad_peretti(
            match.group("prefijo"),
            total,
            costo,
        )
        if partes is None:
            continue
        descripcion, cantidad = partes

        if indice > 0 and _es_continuacion_descripcion_peretti(lineas[indice - 1]):
            descripcion = f"{' '.join(lineas[indice - 1].split())} {descripcion}"

        filas.append(
            {
                "numero_linea": indice + 1,
                "codigo": match.group("codigo"),
                "descripcion": " ".join(descripcion.split()),
                "cantidad": cantidad,
                "costo_unitario": match.group("costo"),
                "descuento_linea_pct": Decimal("0"),
                "total_linea_documental": str(total),
                "confianza_campos": {
                    "codigo": 1,
                    "descripcion": 1,
                    "cantidad": 1,
                    "costo": 1,
                },
            }
        )
    return filas


def _extraer_filas_genericas(text: str) -> list[dict]:
    pattern = re.compile(
        r"^(?P<codigo>\S*\d\S*)\s+(?P<descripcion>.+?)\s+"
        r"(?P<cantidad>\d+(?:[.,]\d+)?)\s+\$?\s*"
        r"(?P<costo>\d+(?:[.]\d{3})*(?:,\d+)?|\d+(?:[.]\d+)?)\s*$"
    )
    filas = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        match = pattern.match(" ".join(line.split()))
        if not match:
            continue
        filas.append(
            {
                "numero_linea": line_number,
                "codigo": match.group("codigo"),
                "descripcion": match.group("descripcion"),
                "cantidad": match.group("cantidad"),
                "costo_unitario": match.group("costo"),
                "descuento_linea_pct": Decimal("0"),
            }
        )
    return filas


def _filas_desde_texto(text: str) -> list[dict]:
    return (
        _extraer_factura_corchetes(text)
        or _extraer_factura_pg_bike(text)
        or _extraer_factura_bici_peretti(text)
        or _extraer_pedido_columnas(text)
        or _extraer_filas_genericas(text)
    )


def _get_ocr_engine():
    global _OCR_ENGINE
    if _OCR_ENGINE is None:
        _OCR_ENGINE = RapidOCR(params={"Global.text_score": 0.45})
    return _OCR_ENGINE


def _box_serializable(box) -> list[list[float]]:
    return [[round(float(point[0]), 2), round(float(point[1]), 2)] for point in box]


def _ejecutar_ocr_imagen(image) -> tuple[str, dict]:
    result = _get_ocr_engine()(image)
    if result.txts is None or result.scores is None or result.boxes is None:
        return "", {"ocr_fragmentos": [], "confianza_promedio": None, "confianza_minima": None}

    fragmentos = [
        {
            "texto": str(texto),
            "confianza": round(float(score), 4),
            "caja": _box_serializable(box),
        }
        for texto, score, box in zip(result.txts, result.scores, result.boxes)
    ]
    fragmentos.sort(
        key=lambda item: (
            min(point[1] for point in item["caja"]),
            min(point[0] for point in item["caja"]),
        )
    )
    scores = [item["confianza"] for item in fragmentos]
    return "\n".join(item["texto"] for item in fragmentos), {
        "ocr_fragmentos": fragmentos,
        "confianza_promedio": round(sum(scores) / len(scores), 4) if scores else None,
        "confianza_minima": min(scores) if scores else None,
    }


def _extraer_imagen_ocr(content: bytes) -> DocumentExtraction:
    image = Image.open(io.BytesIO(content)).convert("RGB")
    image.thumbnail((3000, 3000))
    text, metadata = _ejecutar_ocr_imagen(image)
    filas = _filas_desde_texto(text) if text else []
    confianza = metadata.get("confianza_promedio")
    for fila in filas:
        fila["confianza_campos"] = {
            "codigo": confianza,
            "descripcion": confianza,
            "cantidad": confianza,
            "costo": confianza,
        }
    if not text:
        return DocumentExtraction(
            "requiere_revision",
            "rapidocr_onnx",
            metadata=metadata,
            error="No pude reconocer texto en la imagen. Revisá que esté derecha, enfocada y bien iluminada.",
        )
    return DocumentExtraction(
        "extraido" if filas else "requiere_revision",
        "rapidocr_onnx",
        texto=text,
        filas=filas,
        metadata={**metadata, "filas_detectadas": len(filas)},
        error=None if filas else "Leí el texto, pero no pude separar productos automáticamente.",
    )


def _extraer_pdf_ocr(content: bytes) -> DocumentExtraction:
    document = pdfium.PdfDocument(content)
    textos = []
    paginas_metadata = []
    for page_number in range(min(len(document), 12)):
        page = document[page_number]
        width, height = page.get_size()
        scale = min(2.0, 2400 / max(width, height))
        bitmap = page.render(scale=scale)
        text, metadata = _ejecutar_ocr_imagen(bitmap.to_pil())
        if text:
            textos.append(text)
        paginas_metadata.append({"pagina": page_number + 1, **metadata})
    text = "\n".join(textos)
    filas = _filas_desde_texto(text) if text else []
    scores = [
        fragmento["confianza"]
        for pagina in paginas_metadata
        for fragmento in pagina.get("ocr_fragmentos", [])
    ]
    metadata = {
        "paginas": len(document),
        "paginas_procesadas": len(paginas_metadata),
        "filas_detectadas": len(filas),
        "confianza_promedio": round(sum(scores) / len(scores), 4) if scores else None,
        "confianza_minima": min(scores) if scores else None,
        "ocr_paginas": paginas_metadata,
    }
    for fila in filas:
        fila["confianza_campos"] = {
            "codigo": metadata["confianza_promedio"],
            "descripcion": metadata["confianza_promedio"],
            "cantidad": metadata["confianza_promedio"],
            "costo": metadata["confianza_promedio"],
        }
    return DocumentExtraction(
        "extraido" if filas else "requiere_revision",
        "rapidocr_onnx_pdf",
        texto=text,
        filas=filas,
        metadata=metadata,
        error=None if filas else "El PDF fue leído con OCR, pero sus productos requieren revisión manual.",
    )


def _metadata_pdf(text: str) -> dict:
    metadata = {}
    for label, key in (("Base imponible", "base_imponible"), ("IVA 21%", "iva_21")):
        matches = re.findall(rf"{re.escape(label)}\s*\n?\$?\s*([\d.]+,\d+)", text, re.IGNORECASE)
        if matches:
            metadata[key] = str(_decimal(matches[-1]))

    descuentos = re.search(r"Descuentos:\s*([\d.,+\s]+).*?Flete:\s*([\d.,]+)%", text, re.IGNORECASE)
    if descuentos:
        porcentajes = [
            valor
            for valor in (_decimal(parte) for parte in descuentos.group(1).split("+"))
            if valor is not None
        ]
        metadata["descuentos_sucesivos_pct"] = [str(valor) for valor in porcentajes]
        metadata["flete_pct"] = str(_decimal(descuentos.group(2)))

    importe = r"[\d.]+(?:,\d{0,2})?"
    resumen = re.search(
        r"Imp\.\s*Flete\s+Subtotal\s+Bonific\.\s+Neto\s+IVA\s+21%\s+Total\s+"
        rf"(?P<flete>{importe})\s+"
        rf"(?P<subtotal>{importe})\s+"
        rf"-?(?P<bonificacion>{importe})\s+"
        rf"(?P<neto>{importe})\s+"
        rf"(?P<iva>{importe})\s+"
        rf"(?P<total>{importe})",
        text,
        re.IGNORECASE,
    )
    if resumen:
        flete = _decimal(resumen.group("flete"))
        total = _decimal(resumen.group("total"))
        iva = _decimal(resumen.group("iva"))
        porcentajes = [Decimal(valor) for valor in metadata.get("descuentos_sucesivos_pct", [])]
        metadata.update(
            flete=str(flete),
            iva_21=str(iva),
            total_documental=str(total),
        )
        # Algunas facturas de este proveedor truncan los centavos impresos. Cuando
        # subtotal y neto están completos usamos el documento; si no, reconstruimos
        # ambos importes desde las líneas y los descuentos sucesivos declarados.
        filas = _extraer_factura_pg_bike(text)
        base_productos = sum(
            (_decimal(fila.get("total_linea_documental")) or Decimal("0") for fila in filas),
            Decimal("0"),
        )
        if filas and flete is not None:
            subtotal_texto = resumen.group("subtotal")
            neto_texto = resumen.group("neto")
            importes_completos = bool(
                re.search(r",\d{2}$", subtotal_texto)
                and re.search(r",\d{2}$", neto_texto)
            )
            if importes_completos:
                subtotal = _decimal(subtotal_texto)
                neto = _decimal(neto_texto)
            else:
                subtotal = base_productos + flete
                factor = Decimal("1")
                for porcentaje in porcentajes:
                    factor *= Decimal("1") - (porcentaje / Decimal("100"))
                neto = subtotal * factor
            metadata.update(
                subtotal_antes_bonificacion=str(subtotal.quantize(Decimal("0.01"))),
                bonificacion=str((subtotal - neto).quantize(Decimal("0.01"))),
                neto=str(neto.quantize(Decimal("0.01"))),
            )
    elif "total_documental" not in metadata:
        # Formatos sin cuadro resumen: sólo aceptamos una línea de total explícita,
        # para no confundir la columna TOTAL de los renglones con el total factura.
        totales = re.findall(
            rf"(?im)^\s*Total(?:\s+(?:final|factura))?\s*:?\s*\$?\s*({importe})\s*$",
            text,
        )
        if totales:
            metadata["total_documental"] = str(_decimal(totales[-1]))
    if "BICI PERETTI" in text.upper():
        filas_peretti = _extraer_factura_bici_peretti(text)
        total_match = re.search(
            rf"(?P<total>{_IMPORTE_PERETTI})\s*\nTipo de cambio",
            text,
            re.IGNORECASE,
        )
        if filas_peretti and total_match:
            subtotal = sum(
                (_decimal(fila.get("total_linea_documental")) or Decimal("0") for fila in filas_peretti),
                Decimal("0"),
            )
            total = _decimal(total_match.group("total"))
            iva = total - subtotal if total is not None else None
            metadata.update(
                subtotal_antes_bonificacion=str(subtotal.quantize(Decimal("0.01"))),
                neto=str(subtotal.quantize(Decimal("0.01"))),
                bonificacion="0.00",
                flete="0.00",
                iva_21=str(iva.quantize(Decimal("0.01"))) if iva is not None else None,
                total_documental=str(total) if total is not None else None,
            )
    return metadata


def _extraer_pdf(content: bytes) -> DocumentExtraction:
    reader = PdfReader(io.BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if not text:
        return _extraer_pdf_ocr(content)
    filas = _filas_desde_texto(text)
    return DocumentExtraction(
        "extraido" if filas else "requiere_revision",
        "pypdf",
        texto=text,
        filas=filas,
        metadata={"paginas": len(reader.pages), "filas_detectadas": len(filas), **_metadata_pdf(text)},
        error=None if filas else "Pude leer el PDF, pero no reconocer automáticamente sus productos.",
    )


def _extraer_texto(content: bytes, extension: str) -> DocumentExtraction:
    text = content.decode("utf-8-sig", errors="replace").strip()
    return DocumentExtraction(
        "extraido" if text else "requiere_revision",
        "texto_plano" if extension == ".txt" else "csv",
        texto=text,
        error=None if text else "El archivo está vacío.",
    )


def _identificar_documento(nombre: str, texto: str, extension: str) -> dict:
    fuente = f"{nombre}\n{texto[:5000]}".upper()
    if re.search(r"NOTA\s+DE\s+CR[EÉ]DITO|\bNC[-\s]?[A-Z]?[-\s]?\d", fuente):
        tipo = "nota_credito"
    elif re.search(r"\bFACTURA\b|\bCAE\b|\bFA[-\s]?[A-Z][-\s]?\d", fuente):
        tipo = "factura"
    elif re.search(r"\bPED(?:IDO)?\s*#?\s*\d+", fuente):
        tipo = "pedido"
    elif extension in {".xlsx", ".csv", ".txt"}:
        tipo = "lista"
    elif extension in IMAGE_EXTENSIONS:
        tipo = "imagen"
    else:
        tipo = "documento"

    patrones = {
        "nota_credito": (
            r"(?:NOTA\s+DE\s+CR[EÉ]DITO|\bNC)\s*(?:N[°ºO.]*)?\s*[:#-]?\s*([A-Z]?[-\s]?\d{4,5}[-\s]?\d{6,8})",
        ),
        "factura": (
            r"(\d{4}-\d{8})\s*N[°ºO.]?",
            r"(?:FACTURA|\bFA)\s*(?:N[°ºO.]*)?\s*[:#-]?\s*([A-Z]?[-\s]?\d{4,5}[-\s]?\d{6,8})",
            r"\bFA-([A-Z]-\d{4,5}-\d{6,8})",
        ),
        "pedido": (r"\bPED(?:IDO)?\s*[:#-]?\s*(\d{3,})",),
    }
    numero = None
    for patron in patrones.get(tipo, ()):
        match = re.search(patron, fuente, re.IGNORECASE)
        if match:
            numero = re.sub(r"\s+", "", match.group(1)).strip("-")
            break
    return {"tipo_documento": tipo, "numero_documento": numero}


def extraer_documento(nombre: str, content: bytes) -> DocumentExtraction:
    extension = Path(nombre).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Formato no admitido. Usá PDF, Excel, CSV, TXT, JPG, PNG o WEBP.")
    if extension in IMAGE_EXTENSIONS:
        result = _extraer_imagen_ocr(content)
    elif extension == ".pdf":
        result = _extraer_pdf(content)
    elif extension == ".xlsx":
        result = _extraer_xlsx(content)
    else:
        result = _extraer_texto(content, extension)
    result.metadata.update(_identificar_documento(nombre, result.texto, extension))
    return result
