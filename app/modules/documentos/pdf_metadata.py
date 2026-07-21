def set_pdf_metadata(canvas_obj, title: str) -> None:
    clean_title = str(title or "Emprendimiento Agus").strip() or "Emprendimiento Agus"
    canvas_obj.setTitle(clean_title)
    canvas_obj.setAuthor("Emprendimiento Agus")
    canvas_obj.setSubject(clean_title)
