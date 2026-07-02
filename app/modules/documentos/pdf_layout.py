import re

from reportlab.pdfbase.pdfmetrics import stringWidth


def normalize_inline_text(value) -> str:
    return " ".join(str(value or "").split())


def collapse_repeated_words(value) -> str:
    words = normalize_inline_text(value).split()
    result = []

    for word in words:
        normalized = re.sub(r"^\W+|\W+$", "", word).casefold()
        previous = (
            re.sub(r"^\W+|\W+$", "", result[-1]).casefold()
            if result
            else None
        )
        if normalized and normalized == previous:
            continue
        result.append(word)

    return " ".join(result)


def strip_leading_label(value, label: str) -> str:
    text = collapse_repeated_words(value)
    pattern = re.compile(rf"^(?:{re.escape(label)}\s*)+", re.IGNORECASE)
    return pattern.sub("", text).strip(" :-")


def _split_word(word: str, max_width, font_name: str, font_size: float):
    chunks = []
    current = ""

    for char in word:
        candidate = current + char
        if current and stringWidth(candidate, font_name, font_size) > max_width:
            chunks.append(current)
            current = char
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks or [word]


def wrap_text(
    value,
    max_width,
    font_name: str = "Helvetica",
    font_size: float = 9,
) -> list[str]:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = text.split("\n")
    lines: list[str] = []

    for paragraph in paragraphs:
        words = normalize_inline_text(paragraph).split()
        if not words:
            lines.append("")
            continue

        current = ""
        for word in words:
            pieces = (
                _split_word(word, max_width, font_name, font_size)
                if stringWidth(word, font_name, font_size) > max_width
                else [word]
            )
            for piece in pieces:
                candidate = f"{current} {piece}".strip()
                if (
                    current
                    and stringWidth(candidate, font_name, font_size) > max_width
                ):
                    lines.append(current)
                    current = piece
                else:
                    current = candidate

        if current:
            lines.append(current)

    return lines or [""]


def draw_wrapped_text(
    canvas,
    value,
    *,
    x,
    y,
    max_width,
    font_name: str = "Helvetica",
    font_size: float = 9,
    leading: float = 12,
) -> float:
    lines = wrap_text(value, max_width, font_name, font_size)
    canvas.setFont(font_name, font_size)
    baseline = y

    for line in lines:
        canvas.drawString(x, baseline, line)
        baseline -= leading

    return baseline
