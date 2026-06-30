from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_REGISTRAR_PAGO
from .schema import DeudaCrearInput, DeudaPagoInput
from .service import (
    crear_deuda_por_venta,
    listar_deudas,
    obtener_deuda,
    registrar_pago_deuda,
    simular_pago_deuda,
)

router = APIRouter()
puede_registrar_pago = requerir_permiso(PERMISO_REGISTRAR_PAGO)


@router.post("/")
def crear_deuda(data: DeudaCrearInput):
    return crear_deuda_por_venta(data)


@router.get("/")
def listar(
    q: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    origen_tipo: Optional[str] = Query(default=None),
    origen_id: Optional[int] = Query(default=None),
):
    return listar_deudas(
        q=q,
        estado=estado,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
    )


@router.get("/{deuda_id}")
def detalle(deuda_id: int):
    return obtener_deuda(deuda_id)


@router.post("/{deuda_id}/pagos/preview")
def preview_pago_deuda(deuda_id: int, data: DeudaPagoInput):
    return simular_pago_deuda(deuda_id, data)


@router.post("/{deuda_id}/pagos")
def pagar_deuda(
    deuda_id: int,
    data: DeudaPagoInput,
    usuario: CurrentUser = Depends(puede_registrar_pago),
):
    aplicar_actor_actual(data, usuario)
    return registrar_pago_deuda(deuda_id, data)
