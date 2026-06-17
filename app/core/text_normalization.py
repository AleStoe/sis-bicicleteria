import re


def normalize_text_upper(value: str | None) -> str | None:
    if value is None:
        return None

    text = re.sub(r"\s+", " ", str(value).strip())
    if not text:
        return None

    return text.upper()


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None

    text = re.sub(r"\s+", " ", str(value).strip())
    return text if text else None
