from fastapi import HTTPException

from . import repository


ROL_ADMINISTRADOR = "administrador"


def usuario_tiene_rol(conn, id_usuario: int, rol_nombre: str) -> bool:
    roles = repository.get_roles_usuario(conn, id_usuario)
    nombres = {r["nombre"] for r in roles}
    return rol_nombre in nombres


def exigir_rol_admin(conn, id_usuario: int):
    if not usuario_tiene_rol(conn, id_usuario, ROL_ADMINISTRADOR):
        raise HTTPException(
            status_code=403,
            detail="No tenés permisos para realizar esta acción",
        )