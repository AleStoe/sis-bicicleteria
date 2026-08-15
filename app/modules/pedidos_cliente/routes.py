from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_CREAR_VENTA

from .schema import (
    PedidoClienteCancelar,
    PedidoClienteConvertir,
    PedidoClienteCreate,
    PedidoClienteItemCreate,
    PedidoClienteItemUpdate,
    PedidoClienteOut,
)
from .service import (
    actualizar_item_pedido,
    agregar_item_pedido,
    cancelar_pedido_cliente,
    convertir_pedido_cliente,
    crear_pedido_cliente,
    listar_pedidos_cliente,
    obtener_pedido_cliente,
    quitar_item_pedido,
)

router = APIRouter()
puede_crear_venta = requerir_permiso(PERMISO_CREAR_VENTA)


@router.get("/", response_model=list[PedidoClienteOut])
def listar_pedidos_route(
    estado: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_pedidos_cliente(estado=estado, q=q, limit=limit)


@router.post("/", response_model=PedidoClienteOut)
def crear_pedido_route(
    data: PedidoClienteCreate,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)
    return crear_pedido_cliente(data)


@router.get("/{pedido_id}", response_model=PedidoClienteOut)
def obtener_pedido_route(
    pedido_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_pedido_cliente(pedido_id)


@router.post("/{pedido_id}/items", response_model=PedidoClienteOut)
def agregar_item_route(
    pedido_id: int,
    data: PedidoClienteItemCreate,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)
    return agregar_item_pedido(pedido_id, data)


@router.patch("/{pedido_id}/items/{item_id}", response_model=PedidoClienteOut)
def actualizar_item_route(
    pedido_id: int,
    item_id: int,
    data: PedidoClienteItemUpdate,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_item_pedido(pedido_id, item_id, data)


@router.delete("/{pedido_id}/items/{item_id}", response_model=PedidoClienteOut)
def quitar_item_route(
    pedido_id: int,
    item_id: int,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    actor_id = None if usuario.auth_disabled else usuario.id
    return quitar_item_pedido(pedido_id, item_id, id_usuario=actor_id)


@router.post("/{pedido_id}/cancelar", response_model=PedidoClienteOut)
def cancelar_pedido_route(
    pedido_id: int,
    data: PedidoClienteCancelar,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)
    return cancelar_pedido_cliente(pedido_id, data)


@router.post("/{pedido_id}/convertir", response_model=PedidoClienteOut)
def convertir_pedido_route(
    pedido_id: int,
    data: PedidoClienteConvertir,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)
    return convertir_pedido_cliente(pedido_id, data)
