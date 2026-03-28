from fastapi import APIRouter

from .schemas import (
    OrdenTallerCreate,
    OrdenTallerEstadoUpdate,
    OrdenTallerItemCreate,
    OrdenTallerResponse,
    OrdenTallerDetalleResponse,
    OrdenTallerItemResponse,
)
from .service import (
    crear_orden_taller,
    listar_ordenes_taller,
    obtener_orden_taller,
    cambiar_estado_orden_taller,
    agregar_item_orden_taller,
)

router = APIRouter(prefix="/ordenes_taller", tags=["Taller"])


@router.post("/", response_model=OrdenTallerResponse, status_code=201)
def crear_orden(payload: OrdenTallerCreate):
    return crear_orden_taller(payload)


@router.get("/", response_model=list[OrdenTallerResponse])
def listar_ordenes():
    return listar_ordenes_taller()


@router.get("/{orden_id}", response_model=OrdenTallerDetalleResponse)
def obtener_orden(orden_id: int):
    return obtener_orden_taller(orden_id)


@router.post("/{orden_id}/estado", response_model=OrdenTallerResponse)
def cambiar_estado(orden_id: int, payload: OrdenTallerEstadoUpdate):
    return cambiar_estado_orden_taller(orden_id, payload)


@router.post("/{orden_id}/items", response_model=OrdenTallerItemResponse, status_code=201)
def agregar_item(orden_id: int, payload: OrdenTallerItemCreate):
    return agregar_item_orden_taller(orden_id, payload)