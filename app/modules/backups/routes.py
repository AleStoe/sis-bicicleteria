from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.core.security import CurrentUser
from app.modules.authz.service import requerir_permiso
from app.shared.constants import (
    PERMISO_GESTIONAR_BACKUPS,
    ROL_ADMINISTRADOR,
)

from .schema import BackupCreateInput, BackupOutput
from .service import generar_backup, listar_backups, preparar_descarga


router = APIRouter()
puede_gestionar_backups = requerir_permiso(PERMISO_GESTIONAR_BACKUPS)


def _solo_administrador(
    usuario: CurrentUser = Depends(puede_gestionar_backups),
) -> CurrentUser:
    if not usuario.auth_disabled and ROL_ADMINISTRADOR not in usuario.roles:
        raise HTTPException(
            status_code=403,
            detail="Sólo un administrador puede gestionar backups.",
        )
    return usuario


@router.get("/", response_model=list[BackupOutput])
def listar(
    _usuario: CurrentUser = Depends(_solo_administrador),
):
    return listar_backups()


@router.post(
    "/",
    response_model=BackupOutput,
    status_code=status.HTTP_201_CREATED,
)
def generar(
    data: BackupCreateInput,
    usuario: CurrentUser = Depends(_solo_administrador),
):
    return generar_backup(
        incluir_uploads=data.incluir_uploads,
        id_usuario=usuario.id,
    )


@router.get("/{nombre}/descargar")
def descargar(
    nombre: str,
    usuario: CurrentUser = Depends(_solo_administrador),
):
    path, _info = preparar_descarga(nombre, id_usuario=usuario.id)
    media_type = (
        "application/zip"
        if path.suffix.lower() == ".zip"
        else "application/octet-stream"
    )
    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type=media_type,
    )
