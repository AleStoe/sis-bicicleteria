from typing import List
from fastapi import APIRouter

from .schema import PagoCreateInput, PagoCreateOutput, PagoResumenOutput
from .service import crear_pago, listar_pagos, obtener_pagos_venta

router = APIRouter()


@router.post("/", response_model=PagoCreateOutput)
def registrar_pago(data: PagoCreateInput):
    return crear_pago(data)


@router.get("/", response_model=List[PagoResumenOutput])
def pagos():
    return listar_pagos()


@router.get("/ventas/{venta_id}/pagos", response_model=List[PagoResumenOutput])
def pagos_por_venta(venta_id: int):
    return obtener_pagos_venta(venta_id)