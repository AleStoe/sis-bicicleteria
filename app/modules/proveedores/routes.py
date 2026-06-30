from typing import List

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_CATALOGO

from .schema import ProveedorCreateInput, ProveedorOutput, ProveedorUpdateInput
from .service import (
    cambiar_estado_proveedor,
    crear_proveedor,
    listar_proveedores,
    modificar_proveedor,
    obtener_proveedor,
)


router = APIRouter()
puede_gestionar_catalogo = requerir_permiso(PERMISO_GESTIONAR_CATALOGO)


@router.get("/", response_model=List[ProveedorOutput])
def proveedores_route(solo_activos: bool = True):
    return listar_proveedores(solo_activos=solo_activos)


@router.post("/", response_model=ProveedorOutput)
def crear_proveedor_route(
    data: ProveedorCreateInput,
    _usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return crear_proveedor(data)


@router.get("/{proveedor_id}", response_model=ProveedorOutput)
def proveedor_detalle_route(proveedor_id: int):
    return obtener_proveedor(proveedor_id)


@router.put("/{proveedor_id}", response_model=ProveedorOutput)
def modificar_proveedor_route(
    proveedor_id: int,
    data: ProveedorUpdateInput,
    _usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return modificar_proveedor(proveedor_id, data)


@router.patch("/{proveedor_id}/desactivar", response_model=ProveedorOutput)
def desactivar_proveedor_route(
    proveedor_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return cambiar_estado_proveedor(proveedor_id, False)


@router.patch("/{proveedor_id}/activar", response_model=ProveedorOutput)
def activar_proveedor_route(
    proveedor_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return cambiar_estado_proveedor(proveedor_id, True)
