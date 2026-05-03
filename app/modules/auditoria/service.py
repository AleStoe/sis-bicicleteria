from .repository import insert_auditoria_evento


def registrar_evento(
    conn,
    *,
    id_usuario: int,
    id_sucursal: int | None,
    entidad: str,
    entidad_id: int,
    accion: str,
    detalle: str | None = None,
    metadata: dict | None = None,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
) -> int:
    if metadata is not None and not isinstance(metadata, dict):
        raise ValueError("metadata debe ser dict")

    return insert_auditoria_evento(
        conn,
        {
            "id_usuario": id_usuario,
            "id_sucursal": id_sucursal,
            "entidad": entidad,
            "entidad_id": entidad_id,
            "accion": accion,
            "detalle": detalle,
            "metadata": metadata,
            "origen_tipo": origen_tipo,
            "origen_id": origen_id,
        },
    )