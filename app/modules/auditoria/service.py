from fastapi import HTTPException
from app.db.connection import get_connection
from .repository import (
    insert_auditoria_evento,
    get_auditoria_eventos,
    get_auditoria_evento_by_id,
)

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

def listar_eventos(limit: int = 100):
    if limit <= 0 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="El limit debe estar entre 1 y 500",
        )

    conn = get_connection()
    try:
        return get_auditoria_eventos(conn, limit)
    finally:
        conn.close()


def obtener_evento(evento_id: int):
    conn = get_connection()
    try:
        evento = get_auditoria_evento_by_id(conn, evento_id)

        if evento is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el evento de auditoría {evento_id}",
            )

        return evento
    finally:
        conn.close()