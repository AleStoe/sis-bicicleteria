from fastapi import HTTPException
import bcrypt

from app.db.connection import get_connection
from app.modules.usuarios.repository import get_usuario_login


def verificar_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def login_service(data):
    conn = get_connection()

    try:
        usuario = get_usuario_login(conn, data.username)

        if usuario is None:
            raise HTTPException(
                status_code=401,
                detail="Usuario o contraseña inválidos",
            )

        if not usuario["activo"]:
            raise HTTPException(
                status_code=403,
                detail="Usuario inactivo",
            )

        if not verificar_password(data.password, usuario["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail="Usuario o contraseña inválidos",
            )

        return {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "username": usuario["username"],
            "rol": usuario["rol"],
        }
    finally:
        conn.close()