from typing import List
from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_VER_AUDITORIA

from .schema import AuditoriaEventoOutput
from .service import listar_eventos, obtener_evento

router = APIRouter()
puede_ver_auditoria = requerir_permiso(PERMISO_VER_AUDITORIA)


@router.get("/", response_model=List[AuditoriaEventoOutput])
def eventos(
    limit: int = Query(default=100, ge=1, le=500),
    _usuario: CurrentUser = Depends(puede_ver_auditoria),
):
    return listar_eventos(limit)


@router.get("/{evento_id}", response_model=AuditoriaEventoOutput)
def evento_detalle(
    evento_id: int,
    _usuario: CurrentUser = Depends(puede_ver_auditoria),
):
    return obtener_evento(evento_id)
