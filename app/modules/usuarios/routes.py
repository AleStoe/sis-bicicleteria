from fastapi import APIRouter, Query

from .schema import (
    UsuarioCreateInput,
    UsuarioUpdateInput,
    UsuarioPasswordResetInput,
    UsuarioPasswordCambioPropioInput,
)
from .service import (
    listar_usuarios_service,
    obtener_usuario_service,
    obtener_duplicados_usuarios_service,
    crear_usuario_service,
    actualizar_usuario_service,
    activar_usuario_service,
    desactivar_usuario_service,
    resetear_password_usuario_service,
    cambiar_password_propia_service,
    
)

router = APIRouter()


@router.get("/")
def listar_usuarios(
    q: str | None = Query(default=None),
    solo_activos: bool = Query(default=False),
):
    return listar_usuarios_service(q=q, solo_activos=solo_activos)


@router.get("/duplicados/resumen")
def obtener_duplicados_usuarios():
    return obtener_duplicados_usuarios_service()


@router.get("/{usuario_id}")
def obtener_usuario(usuario_id: int):
    return obtener_usuario_service(usuario_id)


@router.post("/", status_code=201)
def crear_usuario(data: UsuarioCreateInput):
    return crear_usuario_service(data)


@router.put("/{usuario_id}")
def actualizar_usuario(usuario_id: int, data: UsuarioUpdateInput):
    return actualizar_usuario_service(usuario_id, data)


@router.patch("/{usuario_id}/activar")
def activar_usuario(usuario_id: int):
    return activar_usuario_service(usuario_id)


@router.patch("/{usuario_id}/desactivar")
def desactivar_usuario(usuario_id: int):
    return desactivar_usuario_service(usuario_id)

@router.patch("/{usuario_id}/password")
def resetear_password_usuario(usuario_id: int, data: UsuarioPasswordResetInput):
    return resetear_password_usuario_service(usuario_id, data)

@router.patch("/{usuario_id}/password-propia")
def cambiar_password_propia(usuario_id: int, data: UsuarioPasswordCambioPropioInput):
    return cambiar_password_propia_service(usuario_id, data)
