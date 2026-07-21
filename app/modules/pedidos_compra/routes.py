from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_CATALOGO

from .schema import PedidoCompraCreate, PedidoCompraEstadoUpdate, PedidoCompraOut, PedidoCompraRecepcionCreate
from .service import (
    cambiar_estado_pedido_compra,
    crear_pedido_compra,
    listar_pedidos_compra,
    obtener_pedido_compra,
    recibir_pedido_compra,
)

router = APIRouter()
puede_gestionar_catalogo = requerir_permiso(PERMISO_GESTIONAR_CATALOGO)


@router.get("/", response_model=list[PedidoCompraOut])
def listar_pedidos_route(
    estado: str | None = Query(default=None),
    id_proveedor: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=500),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_pedidos_compra(estado=estado, id_proveedor=id_proveedor, limit=limit)


@router.post("/", response_model=PedidoCompraOut)
def crear_pedido_route(
    data: PedidoCompraCreate,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return crear_pedido_compra(data)


@router.get("/{pedido_id}", response_model=PedidoCompraOut)
def obtener_pedido_route(
    pedido_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_pedido_compra(pedido_id)


@router.patch("/{pedido_id}/estado", response_model=PedidoCompraOut)
def cambiar_estado_route(
    pedido_id: int,
    data: PedidoCompraEstadoUpdate,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return cambiar_estado_pedido_compra(pedido_id, data)


@router.post("/{pedido_id}/recepciones", response_model=PedidoCompraOut)
def recibir_pedido_route(
    pedido_id: int,
    data: PedidoCompraRecepcionCreate,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return recibir_pedido_compra(pedido_id, data)
