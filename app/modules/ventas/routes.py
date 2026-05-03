from typing import List
from fastapi import APIRouter

from .schema import (
    VentaCreateInput,
    VentaCreateOutput,
    VentaResumenOutput,
    VentaDetalleOutput,
    VentaEntregaInput,
    VentaEstadoOutput,
    VentaAnulacionInput,
    VentaAnulacionOutput,
    VentaDevolucionSerializadaInput,
    VentaDevolucionSerializadaOutput,
    VentaDevolucionInput,
    VentaDevolucionOutput,
    VentaDevolucionParcialInput,
    VentaDevolucionParcialOutput,
)
from .service import (
    crear_venta,
    listar_ventas,
    obtener_venta,
    entregar_venta,
    anular_venta,
    devolver_item_serializado_entregado,
    devolver_venta,
    devolver_items,
)

router = APIRouter()


@router.post("/", response_model=VentaCreateOutput)
def registrar_venta(data: VentaCreateInput):
    return crear_venta(data)


@router.get("/", response_model=List[VentaResumenOutput])
def ventas():
    return listar_ventas()


@router.get("/{venta_id}", response_model=VentaDetalleOutput)
def venta_detalle(venta_id: int):
    return obtener_venta(venta_id)


@router.post("/{venta_id}/entregar", response_model=VentaEstadoOutput)
def entregar_venta_route(venta_id: int, data: VentaEntregaInput):
    return entregar_venta(venta_id, data)


@router.post("/{venta_id}/anular", response_model=VentaAnulacionOutput)
def anular_venta_route(venta_id: int, data: VentaAnulacionInput):
    return anular_venta(venta_id, data)

@router.post(
    "/{venta_id}/devolver-serializada",
    response_model=VentaDevolucionSerializadaOutput,
)
def devolver_serializada_route(venta_id: int, data: VentaDevolucionSerializadaInput):
    return devolver_item_serializado_entregado(venta_id, data)

@router.post("/{venta_id}/devolver", response_model=VentaDevolucionOutput)
def devolver_venta_route(venta_id: int, data: VentaDevolucionInput):
    return devolver_venta(venta_id, data)

@router.post("/{venta_id}/devolver-items", response_model=VentaDevolucionParcialOutput)
def devolver_items_route(venta_id: int, data: VentaDevolucionParcialInput):
    return devolver_items(venta_id, data)