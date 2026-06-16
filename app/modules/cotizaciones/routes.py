from fastapi import APIRouter

from .schemas import (
    CotizacionCreate,
    CotizacionDetalleResponse,
    CotizacionEstadoUpdate,
    CotizacionItemInput,
    CotizacionItemResponse,
    CotizacionMensajeWhatsappResponse,
    CotizacionResumenResponse,
)
from .service import (
    actualizar_estado_cotizacion,
    agregar_item_cotizacion,
    crear_cotizacion,
    generar_mensaje_whatsapp_cotizacion,
    obtener_cotizacion,
    obtener_cotizaciones,
    quitar_item_cotizacion,
)

router = APIRouter()


@router.post("/", response_model=CotizacionDetalleResponse, status_code=201)
def crear(payload: CotizacionCreate):
    return crear_cotizacion(payload)


@router.get("/", response_model=list[CotizacionResumenResponse])
def listar(tipo: str | None = None, estado: str | None = None):
    return obtener_cotizaciones(tipo=tipo, estado=estado)


@router.get("/{cotizacion_id}", response_model=CotizacionDetalleResponse)
def detalle(cotizacion_id: int):
    return obtener_cotizacion(cotizacion_id)


@router.post(
    "/{cotizacion_id}/items",
    response_model=CotizacionItemResponse,
    status_code=201,
)
def agregar_item(cotizacion_id: int, payload: CotizacionItemInput):
    return agregar_item_cotizacion(cotizacion_id, payload)


@router.delete("/{cotizacion_id}/items/{item_id}", response_model=CotizacionItemResponse)
def quitar_item(cotizacion_id: int, item_id: int):
    return quitar_item_cotizacion(cotizacion_id, item_id)


@router.post("/{cotizacion_id}/estado", response_model=CotizacionDetalleResponse)
def cambiar_estado(cotizacion_id: int, payload: CotizacionEstadoUpdate):
    return actualizar_estado_cotizacion(cotizacion_id, payload)


@router.get(
    "/{cotizacion_id}/mensaje-whatsapp",
    response_model=CotizacionMensajeWhatsappResponse,
)
def mensaje_whatsapp(cotizacion_id: int):
    return generar_mensaje_whatsapp_cotizacion(cotizacion_id)
