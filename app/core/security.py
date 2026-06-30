from dataclasses import dataclass

from fastapi import HTTPException, Request

from app.core.config import settings
from app.db.connection import get_connection
from app.modules.authz.repository import get_contexto_usuario


@dataclass(frozen=True)
class CurrentUser:
    id: int
    username: str
    nombre: str
    roles: frozenset[str]
    permisos: frozenset[str]
    auth_disabled: bool = False


def cargar_usuario_actual(payload: dict) -> CurrentUser:
    conn = get_connection()
    try:
        usuario = get_contexto_usuario(conn, int(payload["sub"]))
    finally:
        conn.close()

    if usuario is None:
        raise HTTPException(status_code=401, detail="La sesión ya no es válida")

    if not usuario["activo"]:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    return CurrentUser(
        id=usuario["id"],
        username=usuario["username"],
        nombre=usuario["nombre"],
        roles=frozenset(usuario["roles"] or []),
        permisos=frozenset(usuario["permisos"] or []),
    )


def obtener_usuario_actual(request: Request) -> CurrentUser:
    if settings.auth_disabled:
        return CurrentUser(
            id=0,
            username="auth_disabled",
            nombre="AUTH DISABLED",
            roles=frozenset({"administrador"}),
            permisos=frozenset({"*"}),
            auth_disabled=True,
        )

    usuario = getattr(request.state, "current_user", None)
    if usuario is None:
        raise HTTPException(status_code=401, detail="Sesión requerida")

    return usuario


def aplicar_actor_actual(data, usuario: CurrentUser, campo: str = "id_usuario"):
    if usuario.auth_disabled:
        return data

    if isinstance(data, dict):
        data[campo] = usuario.id
    else:
        setattr(data, campo, usuario.id)

    return data
