from typing import List
from datetime import date
from fastapi import APIRouter, Query

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
    CajaHistorialOutput,
)
from .service import abrir_caja, cerrar_caja, obtener_caja_abierta, obtener_caja_detalle, registrar_egreso, registrar_ajuste, listar_historial_cajas

router = APIRouter()


@router.post("/abrir", response_model=CajaAbrirOutput)
def abrir_caja_route(data: CajaAbrirInput):
    return abrir_caja(data)


@router.get("/abierta", response_model=CajaAbiertaResumenOutput)
def caja_abierta(id_sucursal: int):
    return obtener_caja_abierta(id_sucursal)

@router.get("/historial", response_model=List[CajaHistorialOutput])
def caja_historial_route(
    id_sucursal: int | None = Query(default=None, gt=0),
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    estado: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return listar_historial_cajas(
        id_sucursal=id_sucursal,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        limit=limit,
        offset=offset,
    )

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

