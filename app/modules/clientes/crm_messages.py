def borrador_apertura_conversacion(
    *,
    nombre: str | None,
    tiene_bicicleta: bool,
    retomar_contacto: bool,
) -> str:
    primer_nombre = str(nombre or "").strip().split(" ")[0].title()
    saludo = (
        f"Hola, {primer_nombre}! Cómo andás? Soy Ale, de Emprendimiento Agus."
        if primer_nombre
        else "Hola! Cómo andás? Soy Ale, de Emprendimiento Agus."
    )
    pregunta_bici = " Cómo viene la bici?" if tiene_bicicleta else ""
    cierre = (
        "Hace un tiempo que no charlamos y quería"
        if retomar_contacto
        else "Quería"
    )
    return f"{saludo}{pregunta_bici} {cierre} saber si viene todo bien 😊"
