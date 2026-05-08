from fastapi import APIRouter
from typing import List

from .schema import (
    ReglaComercialOutput,
    SimularReglasInput,
    SimularReglasOutput,
)
from .service import (
    listar_reglas_comerciales,
    simular_reglas_comerciales,
)

router = APIRouter()


@router.get("", response_model=List[ReglaComercialOutput])
def reglas_comerciales_route(solo_activas: bool = True):
    return listar_reglas_comerciales(solo_activas=solo_activas)


@router.post("/simular", response_model=SimularReglasOutput)
def simular_reglas_comerciales_route(data: SimularReglasInput):
    return simular_reglas_comerciales(data)