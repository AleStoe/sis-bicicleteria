from fastapi import APIRouter, Query

from .schema import ClienteCreateInput, ClienteUpdateInput, BicicletaClienteCreateInput
from .service import (
    listar_clientes_service,
    obtener_cliente_service,
    crear_cliente_service,
    actualizar_cliente_service,
    desactivar_cliente_service,
    activar_cliente_service,
    listar_bicicletas_cliente_service,
    crear_bicicleta_cliente_service,
)

router = APIRouter()


@router.get("/")
def listar_clientes(
    q: str | None = Query(default=None),
    solo_activos: bool = Query(default=False),
):
    return listar_clientes_service(q=q, solo_activos=solo_activos)


@router.get("/{cliente_id}")
def obtener_cliente(cliente_id: int):
    return obtener_cliente_service(cliente_id)


@router.post("/")
def crear_cliente(data: ClienteCreateInput):
    return crear_cliente_service(data)


@router.put("/{cliente_id}")
def actualizar_cliente(cliente_id: int, data: ClienteUpdateInput):
    return actualizar_cliente_service(cliente_id, data)


@router.patch("/{cliente_id}/desactivar")
def desactivar_cliente(cliente_id: int):
    return desactivar_cliente_service(cliente_id)

@router.patch("/{cliente_id}/activar")
def activar_cliente_route(cliente_id: int):
    return activar_cliente_service(cliente_id)

@router.get("/{cliente_id}/bicicletas")
def listar_bicicletas_cliente(cliente_id: int):
    return listar_bicicletas_cliente_service(cliente_id)


@router.post("/{cliente_id}/bicicletas", status_code=201)
def crear_bicicleta_cliente(cliente_id: int, data: BicicletaClienteCreateInput):
    return crear_bicicleta_cliente_service(cliente_id, data)