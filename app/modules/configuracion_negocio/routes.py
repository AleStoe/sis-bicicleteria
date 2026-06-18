from fastapi import APIRouter

from .schemas import ConfiguracionNegocioOutput, ConfiguracionNegocioUpdate
from .service import actualizar_configuracion_negocio, obtener_configuracion_negocio

router = APIRouter()


@router.get("", response_model=ConfiguracionNegocioOutput)
def obtener_configuracion():
    return obtener_configuracion_negocio()


@router.put("", response_model=ConfiguracionNegocioOutput)
def actualizar_configuracion(payload: ConfiguracionNegocioUpdate):
    return actualizar_configuracion_negocio(payload)
