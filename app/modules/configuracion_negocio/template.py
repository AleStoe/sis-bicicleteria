import re


TOKEN_PATTERN = re.compile(r"{([a-zA-Z0-9_]+)}")


def render_template(template: str | None, variables: dict) -> str:
    texto = template or ""

    def reemplazar(match):
        key = match.group(1)
        value = variables.get(key, "")
        return "" if value is None else str(value)

    return TOKEN_PATTERN.sub(reemplazar, texto).strip()


def lineas_configurables(texto: str | None, variables: dict | None = None) -> list[str]:
    variables = variables or {}
    renderizado = render_template(texto or "", variables)
    return [line.strip() for line in renderizado.splitlines() if line.strip()]
