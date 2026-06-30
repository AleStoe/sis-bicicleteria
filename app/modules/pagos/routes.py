from typing import List
from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_REGISTRAR_PAGO, PERMISO_REVERTIR_PAGO

from .schema import (
    PagoCreateInput,
    PagoCreateOutput,
    PagoReversionInput,
    PagoReversionOutput,
    PagoResumenOutput,
    PagoVentaSimulacionInput,
    PagoVentaSimulacionOutput,
)
from .service import crear_pago, listar_pagos, obtener_pagos_venta, revertir_pago, simular_pago_venta

router = APIRouter()
puede_registrar_pago = requerir_permiso(PERMISO_REGISTRAR_PAGO)
puede_revertir_pago = requerir_permiso(PERMISO_REVERTIR_PAGO)


@router.post("/", response_model=PagoCreateOutput)
def registrar_pago(
    data: PagoCreateInput,
    usuario: CurrentUser = Depends(puede_registrar_pago),
):
    aplicar_actor_actual(data, usuario)
    return crear_pago(data)


@router.post("/{pago_id}/revertir", response_model=PagoReversionOutput)
def revertir_pago_route(
    pago_id: int,
    data: PagoReversionInput,
    usuario: CurrentUser = Depends(puede_revertir_pago),
):
    aplicar_actor_actual(data, usuario)
    return revertir_pago(pago_id, data)


@router.get("/", response_model=List[PagoResumenOutput])
def pagos(id_cliente: int | None = Query(default=None, gt=0)):
    return listar_pagos(id_cliente=id_cliente)


@router.get("/ventas/{venta_id}/pagos", response_model=List[PagoResumenOutput])
def pagos_por_venta(venta_id: int):
    return obtener_pagos_venta(venta_id)

@router.post(
    "/ventas/simular-tramo",
    response_model=PagoVentaSimulacionOutput,
)
def simular_tramo_pago_venta(
    data: PagoVentaSimulacionInput,
):
    return simular_pago_venta(data)
