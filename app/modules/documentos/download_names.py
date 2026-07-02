from datetime import date, datetime
import re
import unicodedata


def _date_value(value=None) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value:
        raw = str(value).strip()
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            pass
    return date.today()


def compact_date(value=None) -> str:
    return _date_value(value).strftime("%Y%m%d")


def dashed_date(value=None) -> str:
    return _date_value(value).strftime("%Y-%m-%d")


def numeric_code(value, width=6) -> str:
    digits = "".join(re.findall(r"\d+", str(value or "")))
    if not digits:
        return str(value or "0").upper()
    return digits.zfill(width)


def safe_slug(value, fallback="ARCHIVO", max_length=64) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii").upper()
    text = re.sub(r"[^A-Z0-9]+", "-", text).strip("-")
    return (text or fallback)[:max_length].rstrip("-")


def dated_document_name(prefix, identifier, extension="pdf", value=None) -> str:
    code = numeric_code(identifier)
    return f"{prefix}-{code}-{compact_date(value)}.{extension}"


def catalog_name(kind, value=None) -> str:
    return f"Catalogo-{safe_slug(kind).title()}-{dashed_date(value)}.pdf"


def item_download_code(data: dict, fallback: str) -> str:
    item = data.get("item") or {}
    value = (
        item.get("sku")
        or item.get("codigo_barras")
        or item.get("codigo_proveedor")
        or item.get("numero_cuadro")
        or fallback
    )
    return safe_slug(value, fallback=fallback)
