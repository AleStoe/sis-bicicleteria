from typing import List

from fastapi import APIRouter, Query

from .schema import (
    BicicletaSerializadaCreateInput,
    BicicletaSerializadaCreateOutput,
    BicicletaSerializadaDetalleOutput,
)
from .service import (
    armar_bicicleta_serializada,
    listar_bicicletas_serializadas,
    listar_bicicletas_serializadas_disponibles,
)

router = APIRouter()


@router.get("/", response_model=List[BicicletaSerializadaDetalleOutput])
def listar_serializadas(
    id_variante: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
    estado: str | None = Query(default=None),
):
    return listar_bicicletas_serializadas(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
        estado=estado,
    )


@router.get("/disponibles", response_model=List[BicicletaSerializadaDetalleOutput])
def listar_serializadas_disponibles(
    id_variante: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
):
    return listar_bicicletas_serializadas_disponibles(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
    )


@router.post("/", response_model=BicicletaSerializadaCreateOutput)
def armar_bicicleta_serializada_route(data: BicicletaSerializadaCreateInput):
    return armar_bicicleta_serializada(data)