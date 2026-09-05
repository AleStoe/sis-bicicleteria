from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops
from reportlab.lib.utils import ImageReader


def _to_rgb_tuple(pixel):
    if len(pixel) >= 3:
        return tuple(int(value) for value in pixel[:3])
    value = int(pixel[0])
    return (value, value, value)


def _color_distance(a, b):
    return sum(abs(int(x) - int(y)) for x, y in zip(a, b))


def _edge_background_color(img: Image.Image):
    width, height = img.size
    points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]
    samples = [_to_rgb_tuple(img.getpixel(point)) for point in points]
    return tuple(sorted(color[i] for color in samples)[len(samples) // 2] for i in range(3))


def _is_light_neutral(color):
    return min(color) >= 185 and (max(color) - min(color)) <= 42


def _normalize_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")

    if img.getextrema()[3] != (255, 255):
        base = Image.new("RGBA", img.size, (255, 255, 255, 255))
        base.alpha_composite(img)
        img = base

    bg = _edge_background_color(img)
    tolerance = 64 if _is_light_neutral(bg) else 48
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            rgb = _to_rgb_tuple(pixels[x, y])
            if _color_distance(rgb, bg) <= tolerance or _is_light_neutral(rgb):
                pixels[x, y] = (255, 255, 255, 255)

    white = Image.new("RGBA", img.size, (255, 255, 255, 255))
    diff = ImageChops.difference(img, white).convert("L")
    bbox = diff.point(lambda value: 255 if value > 12 else 0).getbbox()
    if bbox:
        padding = max(4, min(width, height) // 28)
        left = max(0, bbox[0] - padding)
        top = max(0, bbox[1] - padding)
        right = min(width, bbox[2] + padding)
        bottom = min(height, bbox[3] + padding)
        img = img.crop((left, top, right, bottom))

    return img.convert("RGB")


def imagen_pdf_liviana_limpia(
    path: Path | None,
    cache: dict,
    *,
    max_px: int,
    quality: int,
):
    if not path:
        return None

    cache_key = f"clean:{path}:{max_px}:{quality}"
    if cache_key in cache:
        return cache[cache_key]

    try:
        buffer = BytesIO()
        img = Image.open(path)
        img.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
        img = _normalize_background(img)
        img.save(buffer, format="JPEG", quality=quality, optimize=True, subsampling=0)
        buffer.seek(0)

        reader = ImageReader(buffer)
        cache[cache_key] = reader
        return reader
    except Exception:
        return path
