import csv
import io
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook


ALLOWED_EXTENSIONS = {".xlsx", ".csv", ".txt"}

FIELD_ALIASES = {
    "codigo": {
        "codigo", "cod", "sku", "codigoarticulo", "codigoproducto",
        "codigoprov", "codigoproveedor", "articulo", "item",
    },
    "descripcion": {
        "descripcion", "producto", "nombre", "detalle", "articulo",
        "descripcionproducto", "denominacion",
    },
    "costo": {
        "costo", "precio", "preciounitario", "costounitario", "costofinal",
        "costofinalporunidad", "preciofinal", "preciolista", "neto",
    },
    "cantidad": {"cantidad", "cant", "unidades", "unidad", "presentacion"},
    "moneda": {"moneda", "currency", "divisa"},
    "descuento": {"descuento", "desc", "descuentopct", "bonificacion", "bonif"},
    "ean": {"ean", "ean13", "codigobarras", "barcode", "gtin"},
}


@dataclass
class ParsedPriceList:
    formato: str
    extractor: str
    hoja: str | None
    fila_encabezado: int
    delimitador: str | None
    codificacion: str | None
    encabezados: list[str]
    mapeo: dict[str, int]
    filas: list[dict]


def _normalize_header(value) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _raw_value(value, number_format: str | None = None) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int):
        if number_format and re.fullmatch(r"0+", number_format):
            return str(value).zfill(len(number_format))
        return str(value)
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return format(value, ".15g")
    return str(value)


def _mapping_for_row(row: list[str]) -> tuple[dict[str, int], int]:
    normalized = [_normalize_header(value) for value in row]
    mapping = {}
    for field, aliases in FIELD_ALIASES.items():
        for index, header in enumerate(normalized):
            if header in aliases:
                mapping[field] = index
                break

    score = len(mapping)
    if "costo" in mapping:
        score += 4
    if "codigo" in mapping:
        score += 3
    if "descripcion" in mapping:
        score += 3
    return mapping, score


def _detect_header(rows: list[list[str]]) -> tuple[int, list[str], dict[str, int]]:
    best: tuple[int, int, list[str], dict[str, int]] | None = None
    for index, row in enumerate(rows[:40]):
        mapping, score = _mapping_for_row(row)
        candidate = (score, -index, row, mapping)
        if best is None or candidate[:2] > best[:2]:
            best = candidate

    if best is None or best[0] < 7 or "costo" not in best[3]:
        raise ValueError(
            "No pude identificar el encabezado. La lista debe incluir costo y código o descripción."
        )
    header_index = -best[1]
    return header_index, [value.strip() for value in best[2]], best[3]


def _build_items(
    rows: list[list[str]],
    header_index: int,
    mapping: dict[str, int],
    *,
    delimiter: str | None,
) -> list[dict]:
    items = []
    for row_index, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
        values = [str(value or "") for value in row]
        if not any(value.strip() for value in values):
            continue

        def mapped(field: str) -> str | None:
            column = mapping.get(field)
            if column is None or column >= len(values):
                return None
            return values[column].strip()

        codigo = mapped("codigo")
        descripcion = mapped("descripcion")
        costo = mapped("costo")
        estado = "leida" if costo and (codigo or descripcion) else "incompleta"
        items.append(
            {
                "numero_fila": row_index,
                "valores_originales": values,
                "linea_original": (delimiter or " | ").join(values),
                "codigo_original": codigo,
                "descripcion_original": descripcion,
                "costo_original": costo,
                "cantidad_original": mapped("cantidad"),
                "moneda_original": mapped("moneda"),
                "estado": estado,
            }
        )
    if not items:
        raise ValueError("No encontré filas de productos debajo del encabezado.")
    return items


def _parse_xlsx(content: bytes) -> ParsedPriceList:
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    candidates = []
    sheet_rows = {}
    for sheet in workbook.worksheets:
        rows = [
            [_raw_value(cell.value, cell.number_format) for cell in row]
            for row in sheet.iter_rows()
        ]
        sheet_rows[sheet.title] = rows
        try:
            header_index, headers, mapping = _detect_header(rows)
        except ValueError:
            continue
        _, score = _mapping_for_row(headers)
        candidates.append((score, -header_index, sheet.title, header_index, headers, mapping))

    if not candidates:
        raise ValueError(
            "No pude identificar una tabla con costo y código o descripción en ninguna hoja."
        )
    _, _, sheet_name, header_index, headers, mapping = max(candidates, key=lambda item: item[:2])
    items = _build_items(sheet_rows[sheet_name], header_index, mapping, delimiter=None)
    return ParsedPriceList(
        formato="xlsx",
        extractor="openpyxl",
        hoja=sheet_name,
        fila_encabezado=header_index + 1,
        delimitador=None,
        codificacion=None,
        encabezados=headers,
        mapeo=mapping,
        filas=items,
    )


def _decode_text(content: bytes) -> tuple[str, str]:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return content.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    raise ValueError("No pude reconocer la codificación del archivo.")


def _detect_delimiter(text: str, extension: str) -> str:
    sample = "\n".join(text.splitlines()[:30])
    try:
        return csv.Sniffer().sniff(sample, delimiters=";,\t|").delimiter
    except csv.Error:
        if "\t" in sample or extension == ".txt":
            return "\t"
        return ";" if sample.count(";") > sample.count(",") else ","


def _parse_text(content: bytes, extension: str) -> ParsedPriceList:
    text, encoding = _decode_text(content)
    delimiter = _detect_delimiter(text, extension)
    rows = [[str(value or "") for value in row] for row in csv.reader(io.StringIO(text), delimiter=delimiter)]
    header_index, headers, mapping = _detect_header(rows)
    items = _build_items(rows, header_index, mapping, delimiter=delimiter)
    return ParsedPriceList(
        formato="txt" if extension == ".txt" else "csv",
        extractor="csv_python",
        hoja=None,
        fila_encabezado=header_index + 1,
        delimitador=delimiter,
        codificacion=encoding,
        encabezados=headers,
        mapeo=mapping,
        filas=items,
    )


def parse_price_list(filename: str, content: bytes) -> ParsedPriceList:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Formato no permitido. Usá XLSX, CSV o TXT tabulado.")
    if extension == ".xlsx":
        return _parse_xlsx(content)
    return _parse_text(content, extension)
