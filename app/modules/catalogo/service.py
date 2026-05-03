from app.db.connection import get_connection
from fastapi import HTTPException
from .repository import (
    get_categorias,
    get_productos,
    get_variantes,
    crear_imagen_catalogo,
    listar_imagenes_producto,
    listar_imagenes_variante,
    obtener_imagen_catalogo,
    actualizar_imagen_catalogo,
    desactivar_imagen_catalogo,
    get_catalogo_pos,
)


def listar_categorias():
    conn = get_connection()

    try:
        return get_categorias(conn)

    finally:
        conn.close()


def listar_productos():
    conn = get_connection()

    try:
        return get_productos(conn)

    finally:
        conn.close()


def listar_variantes():
    conn = get_connection()

    try:
        return get_variantes(conn)

    finally:
        conn.close()

def _validar_destino_imagen(data: dict):
    id_producto = data.get("id_producto")
    id_variante = data.get("id_variante")

    if id_producto is None and id_variante is None:
        raise HTTPException(
            status_code=400,
            detail="La imagen debe pertenecer a un producto o a una variante",
        )

    if id_producto is not None and id_variante is not None:
        raise HTTPException(
            status_code=400,
            detail="La imagen no puede pertenecer a producto y variante al mismo tiempo",
        )


def _quitar_principal_anterior(conn, imagen: dict):
    if not imagen.get("es_principal"):
        return

    with conn.cursor() as cur:
        if imagen.get("id_producto") is not None:
            cur.execute("""
                UPDATE catalogo_imagenes
                SET es_principal = FALSE
                WHERE id_producto = %s
                  AND activo = TRUE
            """, (imagen["id_producto"],))

        if imagen.get("id_variante") is not None:
            cur.execute("""
                UPDATE catalogo_imagenes
                SET es_principal = FALSE
                WHERE id_variante = %s
                  AND activo = TRUE
            """, (imagen["id_variante"],))


def crear_imagen(data):
    payload = data.model_dump()
    _validar_destino_imagen(payload)

    conn = get_connection()
    try:
        with conn.transaction():
            if payload.get("es_principal"):
                _quitar_principal_anterior(conn, payload)

            return crear_imagen_catalogo(conn, payload)
    finally:
        conn.close()


def obtener_imagenes_producto(id_producto: int):
    conn = get_connection()
    try:
        return listar_imagenes_producto(conn, id_producto)
    finally:
        conn.close()


def obtener_imagenes_variante(id_variante: int):
    conn = get_connection()
    try:
        return listar_imagenes_variante(conn, id_variante)
    finally:
        conn.close()


def editar_imagen(imagen_id: int, data):
    payload = data.model_dump(exclude_unset=True)

    conn = get_connection()
    try:
        with conn.transaction():
            imagen_actual = obtener_imagen_catalogo(conn, imagen_id)

            if imagen_actual is None:
                raise HTTPException(status_code=404, detail="Imagen no encontrada")

            if payload.get("es_principal") is True:
                _quitar_principal_anterior(conn, imagen_actual)

            return actualizar_imagen_catalogo(conn, imagen_id, payload)
    finally:
        conn.close()


def eliminar_imagen(imagen_id: int):
    conn = get_connection()
    try:
        with conn.transaction():
            imagen = desactivar_imagen_catalogo(conn, imagen_id)

            if imagen is None:
                raise HTTPException(status_code=404, detail="Imagen no encontrada")

            return imagen
    finally:
        conn.close()

def listar_catalogo_pos(
    id_sucursal: int,
    query: str | None = None,
    categoria_id: int | None = None,
    limit: int = 50,
):
    if limit < 1:
        raise HTTPException(status_code=400, detail="El límite debe ser mayor a 0")

    if limit > 100:
        raise HTTPException(status_code=400, detail="El límite máximo permitido es 100")

    conn = get_connection()
    try:
        return get_catalogo_pos(
            conn,
            id_sucursal=id_sucursal,
            query=query,
            categoria_id=categoria_id,
            limit=limit,
        )
    finally:
        conn.close()