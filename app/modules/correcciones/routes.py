from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_CORRECCIONES

from .schema import (
    CorreccionesPendientesOutput,
    CorregirCapitalSinCajaInput,
    CorregirCapitalSinCajaOutput,
)
from .service import corregir_capital_sin_caja, obtener_correcciones_pendientes

router = APIRouter()
puede_gestionar_correcciones = requerir_permiso(PERMISO_GESTIONAR_CORRECCIONES)


@router.get("/pendientes", response_model=CorreccionesPendientesOutput)
def pendientes_route(
    _usuario: CurrentUser = Depends(puede_gestionar_correcciones),
):
    return obtener_correcciones_pendientes()


@router.post(
    "/capital-sin-caja/{movimiento_id}/registrar-egreso",
    response_model=CorregirCapitalSinCajaOutput,
)
def corregir_capital_sin_caja_route(
    movimiento_id: int,
    data: CorregirCapitalSinCajaInput,
    usuario: CurrentUser = Depends(puede_gestionar_correcciones),
):
    aplicar_actor_actual(data, usuario)
    return corregir_capital_sin_caja(movimiento_id, data)
