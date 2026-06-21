from fastapi import APIRouter
from typing import List

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


@router.get("", response_model=List[ReglaComercialOutput])
def reglas_comerciales_route(solo_activas: bool = True):
    return listar_reglas_comerciales(solo_activas=solo_activas)


@router.post("", response_model=ReglaComercialOutput)
def crear_regla_comercial_route(data: ReglaComercialCreateInput):
    return crear_regla_comercial(data)


@router.post("/simular", response_model=SimularReglasOutput)
def simular_reglas_comerciales_route(data: SimularReglasInput):
    return simular_reglas_comerciales(data)

@router.patch("/{regla_id}", response_model=ReglaComercialOutput)
def editar_regla_comercial_route(
    regla_id: int,
    data: ReglaComercialUpdateInput,
):
    return editar_regla_comercial(regla_id, data)


@router.get("/tarjeta-planes", response_model=List[TarjetaPlanOutput])
def tarjeta_planes_route(solo_activos: bool = False):
    return listar_tarjeta_planes(solo_activos=solo_activos)


@router.post("/tarjeta-planes", response_model=TarjetaPlanOutput)
def crear_tarjeta_plan_route(data: TarjetaPlanCreateInput):
    return crear_tarjeta_plan(data)


@router.patch("/tarjeta-planes/{plan_id}", response_model=TarjetaPlanOutput)
def editar_tarjeta_plan_route(
    plan_id: int,
    data: TarjetaPlanUpdateInput,
):
    return editar_tarjeta_plan(plan_id, data)
