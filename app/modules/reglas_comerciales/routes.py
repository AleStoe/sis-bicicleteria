from fastapi import APIRouter, Depends
from typing import List

from app.core.security import CurrentUser, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import (
    PERMISO_CONFIGURACION_COMERCIAL,
    PERMISO_VER_RENTABILIDAD,
)
from .schema import (
    ReglaComercialOutput,
    ReglaComercialCreateInput,
    SimularReglasInput,
    SimularReglasOutput,
    ReglaComercialUpdateInput,
    TarjetaPlanOutput,
    TarjetaPlanCreateInput,
    TarjetaPlanUpdateInput,
)
from .service import (
    listar_reglas_comerciales,
    crear_regla_comercial,
    simular_reglas_comerciales,
    editar_regla_comercial,
    listar_tarjeta_planes,
    crear_tarjeta_plan,
    editar_tarjeta_plan,
)

router = APIRouter()
puede_configurar = requerir_permiso(PERMISO_CONFIGURACION_COMERCIAL)


def _puede_ver_costo_financiero(usuario: CurrentUser) -> bool:
    return (
        usuario.auth_disabled
        or "*" in usuario.permisos
        or PERMISO_CONFIGURACION_COMERCIAL in usuario.permisos
        or PERMISO_VER_RENTABILIDAD in usuario.permisos
    )


@router.get("", response_model=List[ReglaComercialOutput])
def reglas_comerciales_route(solo_activas: bool = True):
    return listar_reglas_comerciales(solo_activas=solo_activas)


@router.post("", response_model=ReglaComercialOutput)
def crear_regla_comercial_route(
    data: ReglaComercialCreateInput,
    _usuario: CurrentUser = Depends(puede_configurar),
):
    return crear_regla_comercial(data)


@router.post("/simular", response_model=SimularReglasOutput)
def simular_reglas_comerciales_route(data: SimularReglasInput):
    return simular_reglas_comerciales(data)

@router.patch("/{regla_id}", response_model=ReglaComercialOutput)
def editar_regla_comercial_route(
    regla_id: int,
    data: ReglaComercialUpdateInput,
    _usuario: CurrentUser = Depends(puede_configurar),
):
    return editar_regla_comercial(regla_id, data)


@router.get("/tarjeta-planes", response_model=List[TarjetaPlanOutput])
def tarjeta_planes_route(
    solo_activos: bool = False,
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    planes = listar_tarjeta_planes(solo_activos=solo_activos)
    if _puede_ver_costo_financiero(usuario):
        return planes

    return [
        {**dict(plan), "porcentaje_costo_financiero": None}
        for plan in planes
    ]


@router.post("/tarjeta-planes", response_model=TarjetaPlanOutput)
def crear_tarjeta_plan_route(
    data: TarjetaPlanCreateInput,
    _usuario: CurrentUser = Depends(puede_configurar),
):
    return crear_tarjeta_plan(data)


@router.patch("/tarjeta-planes/{plan_id}", response_model=TarjetaPlanOutput)
def editar_tarjeta_plan_route(
    plan_id: int,
    data: TarjetaPlanUpdateInput,
    _usuario: CurrentUser = Depends(puede_configurar),
):
    return editar_tarjeta_plan(plan_id, data)
