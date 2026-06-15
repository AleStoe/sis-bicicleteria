from fastapi import HTTPException
import bcrypt
from app.modules.auditoria import service as auditoria_service
from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.shared.constants import AUDITORIA_ACCION_LOGIN_EXITOSO
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
        evento_id = auditoria_service.registrar_evento(
            conn,
            id_usuario=usuario["id"],
            id_sucursal=None,
            entidad="usuario",
            entidad_id=usuario["id"],
            accion=AUDITORIA_ACCION_LOGIN_EXITOSO,
            detalle=f"Inicio de sesión de {usuario['username']}",
            metadata={
                "username": usuario["username"],
                "rol": usuario["rol"],
            },
        )

        conn.commit()

        return {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "username": usuario["username"],
            "rol": usuario["rol"],
            "token": crear_token_usuario(usuario),
            "token_type": "bearer",
            "expires_in": settings.auth_token_minutes * 60,
        }
    finally:
        conn.close()
