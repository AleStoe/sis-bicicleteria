from fastapi import APIRouter

from .schema import DeudaCrearInput, DeudaPagoInput
from .service import (
    crear_deuda_por_venta,
    listar_deudas,
    obtener_deuda,
    registrar_pago_deuda,
)

router = APIRouter()


@router.post("/")
def crear_deuda(data: DeudaCrearInput):
    return crear_deuda_por_venta(data)


@router.get("/")
def listar():
    return listar_deudas()


@router.get("/{deuda_id}")
def detalle(deuda_id: int):
    return obtener_deuda(deuda_id)


@router.post("/{deuda_id}/pagos")
def pagar_deuda(deuda_id: int, data: DeudaPagoInput):
    return registrar_pago_deuda(deuda_id, data)