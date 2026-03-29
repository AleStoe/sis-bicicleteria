from fastapi import APIRouter

from .schema import (
    BicicletaSerializadaCreateInput,
    BicicletaSerializadaCreateOutput,
)
from .service import armar_bicicleta_serializada

router = APIRouter()


@router.post("/", response_model=BicicletaSerializadaCreateOutput)
def armar_bicicleta_serializada_route(data: BicicletaSerializadaCreateInput):
    return armar_bicicleta_serializada(data)