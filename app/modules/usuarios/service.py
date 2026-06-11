from fastapi import HTTPException
import bcrypt

from app.db.connection import get_connection
from .repository import (
    get_usuarios,
    get_usuario_by_id,
    get_usuario_by_username,
    get_usuario_by_email,
    get_rol_by_nombre,
    insert_usuario,
    update_usuario,
    set_rol_usuario,
    activar_usuario,
    desactivar_usuario,
    update_usuario_password,
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )

def _limpiar_texto(valor):
    if valor is None:
        return None

    valor = str(valor).strip()
    return valor if valor else None


def _normalizar_usuario(data):
    data.nombre = _limpiar_texto(data.nombre)
    data.username = _limpiar_texto(data.username)
    data.email = _limpiar_texto(data.email)

    if data.username:
        data.username = data.username.lower()

    return data


def _validar_campos_usuario(data):
    if not data.nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    if not data.username:
        raise HTTPException(status_code=400, detail="El usuario es obligatorio")

    if " " in data.username:
        raise HTTPException(
            status_code=400,
            detail="El nombre de usuario no puede contener espacios",
        )


def _obtener_usuario_o_404(conn, usuario_id: int):
    usuario = get_usuario_by_id(conn, usuario_id)

    if usuario is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe el usuario {usuario_id}",
        )

    return usuario


def _obtener_rol_o_400(conn, rol: str):
    rol_db = get_rol_by_nombre(conn, rol)

    if rol_db is None:
        raise HTTPException(
            status_code=400,
            detail=f"Rol inválido o inexistente: {rol}",
        )

    return rol_db


def _validar_username_unico(conn, username: str, usuario_id_actual: int | None = None):
    existente = get_usuario_by_username(conn, username)

    if existente and existente["id"] != usuario_id_actual:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario con username '{username}'",
        )


def _validar_email_unico(conn, email: str | None, usuario_id_actual: int | None = None):
    if not email:
        return

    existente = get_usuario_by_email(conn, email)

    if existente and existente["id"] != usuario_id_actual:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario con email '{email}'",
        )


def listar_usuarios_service(q=None, solo_activos=False):
    conn = get_connection()

    try:
        return get_usuarios(conn, q=q, solo_activos=solo_activos)
    finally:
        conn.close()


def obtener_usuario_service(usuario_id: int):
    conn = get_connection()

    try:
        return _obtener_usuario_o_404(conn, usuario_id)
    finally:
        conn.close()


def crear_usuario_service(data):
    conn = get_connection()

    try:
        with conn.transaction():
            data = _normalizar_usuario(data)
            _validar_campos_usuario(data)
            rol = _obtener_rol_o_400(conn, data.rol)

            _validar_username_unico(conn, data.username)
            _validar_email_unico(conn, data.email)

            password_hash = hash_password(data.password)

            usuario_id = insert_usuario(conn, data, password_hash)
            set_rol_usuario(conn, usuario_id, rol["id"])

        return {
            "ok": True,
            "usuario_id": usuario_id,
        }
    finally:
        conn.close()


def actualizar_usuario_service(usuario_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_usuario_o_404(conn, usuario_id)

            data = _normalizar_usuario(data)
            _validar_campos_usuario(data)
            rol = _obtener_rol_o_400(conn, data.rol)

            _validar_username_unico(conn, data.username, usuario_id_actual=usuario_id)
            _validar_email_unico(conn, data.email, usuario_id_actual=usuario_id)

            update_usuario(conn, usuario_id, data)
            set_rol_usuario(conn, usuario_id, rol["id"])

        return {
            "ok": True,
            "usuario_id": usuario_id,
        }
    finally:
        conn.close()


def activar_usuario_service(usuario_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            usuario = _obtener_usuario_o_404(conn, usuario_id)

            if usuario["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El usuario {usuario_id} ya está activo",
                )

            activar_usuario(conn, usuario_id)

        return {
            "ok": True,
            "usuario_id": usuario_id,
            "activo": True,
        }
    finally:
        conn.close()


def desactivar_usuario_service(usuario_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            usuario = _obtener_usuario_o_404(conn, usuario_id)

            if not usuario["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El usuario {usuario_id} ya está inactivo",
                )

            desactivar_usuario(conn, usuario_id)

        return {
            "ok": True,
            "usuario_id": usuario_id,
            "activo": False,
        }
    finally:
        conn.close()

def resetear_password_usuario_service(usuario_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_usuario_o_404(conn, usuario_id)

            password_hash = hash_password(data.password)

            update_usuario_password(conn, usuario_id, password_hash)

        return {
            "ok": True,
            "usuario_id": usuario_id,
        }
    finally:
        conn.close()