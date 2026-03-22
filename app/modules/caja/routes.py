from fastapi import APIRouter

from .schema import (
    CajaAbrirInput,
    CajaAbrirOutput,
    CajaAbiertaResumenOutput,
    CajaCerrarInput,
    CajaCerrarOutput,
    CajaDetalleOutput,
    CajaEgresoInput,
    CajaEgresoOutput,
    CajaAjusteInput,
)
from .service import abrir_caja, cerrar_caja, obtener_caja_abierta, obtener_caja_detalle, registrar_egreso, registrar_ajuste

router = APIRouter()


@router.post("/abrir", response_model=CajaAbrirOutput)
def abrir_caja_route(data: CajaAbrirInput):
    return abrir_caja(data)


@router.get("/abierta", response_model=CajaAbiertaResumenOutput)
def caja_abierta(id_sucursal: int):
    return obtener_caja_abierta(id_sucursal)


@router.get("/{caja_id}", response_model=CajaDetalleOutput)
def caja_detalle(caja_id: int):
    return obtener_caja_detalle(caja_id)


@router.post("/{caja_id}/egresos", response_model=CajaEgresoOutput)
def registrar_egreso_route(caja_id: int, data: CajaEgresoInput):
    return registrar_egreso(caja_id, data)


@router.post("/{caja_id}/cerrar", response_model=CajaCerrarOutput)
def cerrar_caja_route(caja_id: int, data: CajaCerrarInput):
    return cerrar_caja(caja_id, data)

@router.post("/{caja_id}/ajustes", response_model=CajaEgresoOutput)
def registrar_ajuste_route(caja_id: int, data: CajaAjusteInput):
    return registrar_ajuste(caja_id, data)