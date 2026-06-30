from fastapi import APIRouter, Depends

from app.core.security import CurrentUser
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_CONFIGURACION_COMERCIAL

from .schemas import ConfiguracionNegocioOutput, ConfiguracionNegocioUpdate
from .service import actualizar_configuracion_negocio, obtener_configuracion_negocio

router = APIRouter()
puede_configurar = requerir_permiso(PERMISO_CONFIGURACION_COMERCIAL)


@router.get("", response_model=ConfiguracionNegocioOutput)
def obtener_configuracion():
    return obtener_configuracion_negocio()


@router.put("", response_model=ConfiguracionNegocioOutput)
def actualizar_configuracion(
    payload: ConfiguracionNegocioUpdate,
    _usuario: CurrentUser = Depends(puede_configurar),
):
    return actualizar_configuracion_negocio(payload)
