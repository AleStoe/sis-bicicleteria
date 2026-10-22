from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_ARMADO

from .schema import (
    AcondicionamientoAccionInput,
    AcondicionamientoAplicarInput,
    AcondicionamientoCostoCreateInput,
    AcondicionamientoCreateInput,
    AcondicionamientoItemCreateInput,
    AcondicionamientoOutput,
    AcondicionamientoPiezaRetiradaInput,
    AcondicionamientoRecuperoCreateInput,
)
from .service import (
    agregar_costo,
    agregar_item,
    agregar_recupero,
    aplicar_acondicionamiento,
    confirmar_acondicionamiento,
    crear_acondicionamiento,
    listar_acondicionamientos_bicicleta,
    obtener_acondicionamiento,
    quitar_costo,
    quitar_item,
    quitar_recupero,
    resolver_pieza_retirada,
    revertir_acondicionamiento,
)

router = APIRouter()
puede_gestionar_armado = requerir_permiso(PERMISO_GESTIONAR_ARMADO)


def _actor_id(usuario: CurrentUser, id_usuario: int | None = None) -> int:
    if usuario.auth_disabled:
        if id_usuario is None:
            raise HTTPException(
                status_code=400,
                detail="Se requiere id_usuario para auditar la operación",
            )
        return id_usuario
    return usuario.id


@router.get("/bicicleta/{bicicleta_id}", response_model=list[AcondicionamientoOutput])
def listar_por_bicicleta_route(
    bicicleta_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_acondicionamientos_bicicleta(bicicleta_id)


@router.get("/{acondicionamiento_id}", response_model=AcondicionamientoOutput)
def obtener_route(
    acondicionamiento_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_acondicionamiento(acondicionamiento_id)


@router.post("/", response_model=AcondicionamientoOutput, status_code=201)
def crear_route(
    data: AcondicionamientoCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return crear_acondicionamiento(data)


@router.post("/{acondicionamiento_id}/items", response_model=AcondicionamientoOutput)
def agregar_item_route(
    acondicionamiento_id: int,
    data: AcondicionamientoItemCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return agregar_item(acondicionamiento_id, data)


@router.delete("/{acondicionamiento_id}/items/{item_id}", response_model=AcondicionamientoOutput)
def quitar_item_route(
    acondicionamiento_id: int,
    item_id: int,
    id_usuario: int | None = Query(default=None, gt=0),
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return quitar_item(
        acondicionamiento_id,
        item_id,
        id_usuario=_actor_id(usuario, id_usuario),
    )


@router.patch(
    "/{acondicionamiento_id}/items/{item_id}/pieza-retirada",
    response_model=AcondicionamientoOutput,
)
def resolver_pieza_retirada_route(
    acondicionamiento_id: int,
    item_id: int,
    data: AcondicionamientoPiezaRetiradaInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return resolver_pieza_retirada(acondicionamiento_id, item_id, data)


@router.post("/{acondicionamiento_id}/costos", response_model=AcondicionamientoOutput)
def agregar_costo_route(
    acondicionamiento_id: int,
    data: AcondicionamientoCostoCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return agregar_costo(acondicionamiento_id, data)


@router.delete("/{acondicionamiento_id}/costos/{costo_id}", response_model=AcondicionamientoOutput)
def quitar_costo_route(
    acondicionamiento_id: int,
    costo_id: int,
    id_usuario: int | None = Query(default=None, gt=0),
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return quitar_costo(
        acondicionamiento_id,
        costo_id,
        id_usuario=_actor_id(usuario, id_usuario),
    )


@router.post("/{acondicionamiento_id}/recuperos", response_model=AcondicionamientoOutput)
def agregar_recupero_route(
    acondicionamiento_id: int,
    data: AcondicionamientoRecuperoCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return agregar_recupero(acondicionamiento_id, data)


@router.delete(
    "/{acondicionamiento_id}/recuperos/{recupero_id}",
    response_model=AcondicionamientoOutput,
)
def quitar_recupero_route(
    acondicionamiento_id: int,
    recupero_id: int,
    id_usuario: int | None = Query(default=None, gt=0),
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return quitar_recupero(
        acondicionamiento_id,
        recupero_id,
        id_usuario=_actor_id(usuario, id_usuario),
    )


@router.post("/{acondicionamiento_id}/confirmar", response_model=AcondicionamientoOutput)
def confirmar_route(
    acondicionamiento_id: int,
    data: AcondicionamientoAccionInput | None = None,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    data = data or AcondicionamientoAccionInput()
    aplicar_actor_actual(data, usuario)
    return confirmar_acondicionamiento(acondicionamiento_id, data)


@router.post("/{acondicionamiento_id}/aplicar", response_model=AcondicionamientoOutput)
def aplicar_route(
    acondicionamiento_id: int,
    data: AcondicionamientoAplicarInput | None = None,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    data = data or AcondicionamientoAplicarInput()
    aplicar_actor_actual(data, usuario)
    return aplicar_acondicionamiento(acondicionamiento_id, data)


@router.post("/{acondicionamiento_id}/revertir", response_model=AcondicionamientoOutput)
def revertir_route(
    acondicionamiento_id: int,
    data: AcondicionamientoAccionInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return revertir_acondicionamiento(acondicionamiento_id, data)
