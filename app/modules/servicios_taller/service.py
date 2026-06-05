from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    insert_servicio_taller,
    get_servicios_taller,
    get_servicio_taller_by_id,
    update_servicio_taller,
    set_servicio_taller_activo,
)


def crear_servicio_taller(data):
    conn = get_connection()
    try:
        with conn.transaction():
            return insert_servicio_taller(
                conn,
                {
                    "nombre": data.nombre.strip(),
                    "descripcion": data.descripcion.strip() if data.descripcion else None,
                    "precio_sugerido": data.precio_sugerido,
                    "duracion_estimada_min": data.duracion_estimada_min,
                },
            )
    finally:
        conn.close()


def listar_servicios_taller(incluir_inactivos: bool = False):
    conn = get_connection()
    try:
        return get_servicios_taller(conn, incluir_inactivos)
    finally:
        conn.close()


def obtener_servicio_taller(servicio_id: int):
    conn = get_connection()
    try:
        servicio = get_servicio_taller_by_id(conn, servicio_id)
        if servicio is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el servicio de taller {servicio_id}",
            )
        return servicio
    finally:
        conn.close()


def editar_servicio_taller(servicio_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            existente = get_servicio_taller_by_id(conn, servicio_id)
            if existente is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el servicio de taller {servicio_id}",
                )

            actualizado = update_servicio_taller(
                conn,
                servicio_id,
                {
                    "nombre": data.nombre.strip(),
                    "descripcion": data.descripcion.strip() if data.descripcion else None,
                    "precio_sugerido": data.precio_sugerido,
                    "duracion_estimada_min": data.duracion_estimada_min,
                    "activo": data.activo,
                },
            )
            return actualizado
    finally:
        conn.close()


def activar_servicio_taller(servicio_id: int):
    return _set_activo(servicio_id, True)


def desactivar_servicio_taller(servicio_id: int):
    return _set_activo(servicio_id, False)


def _set_activo(servicio_id: int, activo: bool):
    conn = get_connection()
    try:
        with conn.transaction():
            servicio = set_servicio_taller_activo(conn, servicio_id, activo)
            if servicio is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el servicio de taller {servicio_id}",
                )
            return servicio
    finally:
        conn.close()