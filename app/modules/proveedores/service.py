from fastapi import HTTPException
from psycopg.errors import UniqueViolation

from app.db.connection import get_connection
from app.core.text_normalization import clean_text, normalize_text_upper

from .repository import (
    get_proveedores,
    get_proveedor_by_id,
    insert_proveedor,
)


def listar_proveedores(solo_activos: bool = True):
    conn = get_connection()

    try:
        return get_proveedores(conn, solo_activos=solo_activos)
    finally:
        conn.close()


def obtener_proveedor(proveedor_id: int):
    conn = get_connection()

    try:
        proveedor = get_proveedor_by_id(conn, proveedor_id)

        if proveedor is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el proveedor {proveedor_id}",
            )

        return proveedor

    finally:
        conn.close()


def crear_proveedor(data):
    conn = get_connection()

    try:
        with conn.transaction():
            try:
                proveedor = insert_proveedor(
                    conn,
                    {
                        "nombre": normalize_text_upper(data.nombre),
                        "telefono": clean_text(data.telefono),
                        "email": clean_text(data.email),
                        "notas": clean_text(data.notas),
                    },
                )
            except UniqueViolation:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe un proveedor con ese nombre",
                )

            return proveedor

    finally:
        conn.close()
