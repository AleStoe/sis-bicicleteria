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
) -> int:
    return insert_auditoria_evento(
        conn,
        {
            "id_usuario": id_usuario,
            "id_sucursal": id_sucursal,
            "entidad": entidad,
            "entidad_id": entidad_id,
            "accion": accion,
            "detalle": detalle,
        },
    )