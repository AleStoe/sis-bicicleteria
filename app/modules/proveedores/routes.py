from typing import List

from fastapi import APIRouter

from .schema import ProveedorCreateInput, ProveedorOutput
from .service import listar_proveedores, obtener_proveedor, crear_proveedor


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