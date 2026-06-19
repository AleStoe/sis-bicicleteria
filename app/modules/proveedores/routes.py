from typing import List

from fastapi import APIRouter

from .schema import ProveedorCreateInput, ProveedorOutput, ProveedorUpdateInput
from .service import (
    cambiar_estado_proveedor,
    crear_proveedor,
    listar_proveedores,
    modificar_proveedor,
    obtener_proveedor,
)


router = APIRouter()


@router.get("/", response_model=List[ProveedorOutput])
def proveedores_route(solo_activos: bool = True):
    return listar_proveedores(solo_activos=solo_activos)


@router.post("/", response_model=ProveedorOutput)
def crear_proveedor_route(data: ProveedorCreateInput):
    return crear_proveedor(data)


@router.get("/{proveedor_id}", response_model=ProveedorOutput)
def proveedor_detalle_route(proveedor_id: int):
    return obtener_proveedor(proveedor_id)


@router.put("/{proveedor_id}", response_model=ProveedorOutput)
def modificar_proveedor_route(proveedor_id: int, data: ProveedorUpdateInput):
    return modificar_proveedor(proveedor_id, data)


@router.patch("/{proveedor_id}/desactivar", response_model=ProveedorOutput)
def desactivar_proveedor_route(proveedor_id: int):
    return cambiar_estado_proveedor(proveedor_id, False)


@router.patch("/{proveedor_id}/activar", response_model=ProveedorOutput)
def activar_proveedor_route(proveedor_id: int):
    return cambiar_estado_proveedor(proveedor_id, True)
