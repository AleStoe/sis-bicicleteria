from fastapi import HTTPException
from psycopg.errors import UndefinedTable

from app.db.connection import get_connection

from .defaults import DEFAULT_CONFIGURACION_NEGOCIO
from .repository import get_configuracion_negocio, upsert_configuracion_negocio


def _normalizar_config(row) -> dict:
    config = dict(DEFAULT_CONFIGURACION_NEGOCIO)
    if row:
        config.update(dict(row))
    return config


def obtener_configuracion_negocio() -> dict:
    conn = get_connection()
    try:
        try:
            return _normalizar_config(get_configuracion_negocio(conn))
        except Exception:
            return dict(DEFAULT_CONFIGURACION_NEGOCIO)
    finally:
        conn.close()


def actualizar_configuracion_negocio(data) -> dict:
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                row = upsert_configuracion_negocio(conn, data.model_dump())
            except UndefinedTable as exc:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Falta aplicar la migración de configuración del negocio. "
                        "Aplicá database/migrations/20260618_01_create_configuracion_negocio.sql "
                        "en la base de datos y volvé a guardar."
                    ),
                ) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No se pudo guardar la configuración del negocio. "
                        "Revisá los datos ingresados o el estado de la base."
                    ),
                ) from exc

            return _normalizar_config(row)
    finally:
        conn.close()
