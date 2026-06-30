from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_USUARIOS
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
gestionar_usuarios = requerir_permiso(PERMISO_GESTIONAR_USUARIOS)


def _actor_id(usuario: CurrentUser) -> int | None:
    return None if usuario.auth_disabled else usuario.id


@router.get("/")
def listar_usuarios(
    q: str | None = Query(default=None),
    solo_activos: bool = Query(default=False),
    _usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return listar_usuarios_service(q=q, solo_activos=solo_activos)


@router.get("/duplicados/resumen")
def obtener_duplicados_usuarios(
    _usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return obtener_duplicados_usuarios_service()


@router.get("/{usuario_id}")
def obtener_usuario(
    usuario_id: int,
    _usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return obtener_usuario_service(usuario_id)


@router.post("/", status_code=201)
def crear_usuario(
    data: UsuarioCreateInput,
    usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return crear_usuario_service(data, id_usuario_actor=_actor_id(usuario))


@router.put("/{usuario_id}")
def actualizar_usuario(
    usuario_id: int,
    data: UsuarioUpdateInput,
    usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return actualizar_usuario_service(
        usuario_id,
        data,
        id_usuario_actor=_actor_id(usuario),
    )


@router.patch("/{usuario_id}/activar")
def activar_usuario(
    usuario_id: int,
    usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return activar_usuario_service(
        usuario_id,
        id_usuario_actor=_actor_id(usuario),
    )


@router.patch("/{usuario_id}/desactivar")
def desactivar_usuario(
    usuario_id: int,
    usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return desactivar_usuario_service(
        usuario_id,
        id_usuario_actor=_actor_id(usuario),
    )

@router.patch("/{usuario_id}/password")
def resetear_password_usuario(
    usuario_id: int,
    data: UsuarioPasswordResetInput,
    usuario: CurrentUser = Depends(gestionar_usuarios),
):
    return resetear_password_usuario_service(
        usuario_id,
        data,
        id_usuario_actor=_actor_id(usuario),
    )

@router.patch("/{usuario_id}/password-propia")
def cambiar_password_propia(
    usuario_id: int,
    data: UsuarioPasswordCambioPropioInput,
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    usuario_objetivo = usuario_id if usuario.auth_disabled else usuario.id
    return cambiar_password_propia_service(
        usuario_objetivo,
        data,
        id_usuario_actor=_actor_id(usuario),
    )
