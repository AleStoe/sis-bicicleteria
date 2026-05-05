from fastapi import APIRouter

from .schema import (
    VariantePrecioOutput,
    PrecioActualizarInput,
    PrecioActualizarOutput,
    PrecioHistorialOutput,
)
from .service import (
    obtener_precio_variante,
    actualizar_precio_variante,
    obtener_historial_precio_variante,
)

router = APIRouter()


@router.get("/variantes/{id_variante}", response_model=VariantePrecioOutput)
def precio_variante_route(id_variante: int):
    return obtener_precio_variante(id_variante)


@router.post(
    "/variantes/{id_variante}/actualizar",
    response_model=PrecioActualizarOutput,
)
def actualizar_precio_variante_route(
    id_variante: int,
    data: PrecioActualizarInput,
):
    return actualizar_precio_variante(id_variante, data)


@router.get(
    "/variantes/{id_variante}/historial",
    response_model=PrecioHistorialOutput,
)
def historial_precio_variante_route(id_variante: int):
    return obtener_historial_precio_variante(id_variante)