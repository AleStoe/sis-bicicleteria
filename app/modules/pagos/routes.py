from typing import List
from fastapi import APIRouter

from .schema import PagoCreateInput, PagoCreateOutput, PagoResumenOutput
from .service import crear_pago, listar_pagos

router = APIRouter()


@router.post("/", response_model=PagoCreateOutput)
def registrar_pago(data: PagoCreateInput):
    return crear_pago(data)


@router.get("/", response_model=List[PagoResumenOutput])
def pagos():
    return listar_pagos()