from typing import List

from fastapi import APIRouter

from .schema import (
    GastoCategoriaCreateInput,
    GastoCategoriaOutput,
    GastoCreateInput,
    GastoCreateOutput,
    GastoOutput,
    GastoDetalleOutput,
    GastoAnularInput,
    GastoCorregirInput,
    GastoEstadoOutput,
)
from .service import (
    crear_categoria,
    listar_categorias,
    crear_gasto,
    listar_gastos,
    obtener_gasto,
    anular_gasto,
    corregir_gasto,
)

router = APIRouter()


@router.post("/categorias", response_model=GastoCategoriaOutput)
def crear_categoria_route(data: GastoCategoriaCreateInput):
    return crear_categoria(data)


@router.get("/categorias", response_model=List[GastoCategoriaOutput])
def categorias_route():
    return listar_categorias()


@router.post("/", response_model=GastoCreateOutput)
def crear_gasto_route(data: GastoCreateInput):
    return crear_gasto(data)


@router.get("/", response_model=List[GastoOutput])
def gastos_route():
    return listar_gastos()


@router.get("/{gasto_id}", response_model=GastoDetalleOutput)
def gasto_detalle_route(gasto_id: int):
    return obtener_gasto(gasto_id)


@router.post("/{gasto_id}/anular", response_model=GastoEstadoOutput)
def anular_gasto_route(gasto_id: int, data: GastoAnularInput):
    return anular_gasto(gasto_id, data)


@router.post("/{gasto_id}/corregir", response_model=GastoEstadoOutput)
def corregir_gasto_route(gasto_id: int, data: GastoCorregirInput):
    return corregir_gasto(gasto_id, data)