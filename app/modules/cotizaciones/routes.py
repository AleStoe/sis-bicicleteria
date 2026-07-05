from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_CREAR_VENTA

from .schemas import (
    CotizacionConversionPreviewOutput,
    CotizacionConversionVentaOutput,
    CotizacionConvertirVentaInput,
    CotizacionCreate,
    CotizacionDetalleResponse,
    CotizacionEstadoUpdate,
    CotizacionItemCantidadUpdate,
    CotizacionItemInput,
    CotizacionItemResponse,
    CotizacionMensajeWhatsappResponse,
    CotizacionResumenResponse,
)
from .service import (
    actualizar_cantidad_item_cotizacion,
    actualizar_estado_cotizacion,
    agregar_item_cotizacion,
    convertir_cotizacion_a_venta,
    crear_cotizacion,
    generar_mensaje_whatsapp_cotizacion,
    obtener_cotizacion,
    obtener_cotizaciones,
    obtener_preview_conversion_venta,
    quitar_item_cotizacion,
)

router = APIRouter()
puede_crear_venta = requerir_permiso(PERMISO_CREAR_VENTA)


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


@router.patch(
    "/{cotizacion_id}/items/{item_id}/cantidad",
    response_model=CotizacionItemResponse,
)
def actualizar_cantidad_item(
    cotizacion_id: int,
    item_id: int,
    payload: CotizacionItemCantidadUpdate,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return actualizar_cantidad_item_cotizacion(cotizacion_id, item_id, payload)


@router.post("/{cotizacion_id}/estado", response_model=CotizacionDetalleResponse)
def cambiar_estado(cotizacion_id: int, payload: CotizacionEstadoUpdate):
    return actualizar_estado_cotizacion(cotizacion_id, payload)


@router.get(
    "/{cotizacion_id}/conversion-preview",
    response_model=CotizacionConversionPreviewOutput,
)
def preview_conversion(
    cotizacion_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_preview_conversion_venta(cotizacion_id)


@router.post(
    "/{cotizacion_id}/convertir-a-venta",
    response_model=CotizacionConversionVentaOutput,
)
def convertir_a_venta(
    cotizacion_id: int,
    payload: CotizacionConvertirVentaInput,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(payload, usuario)
    return convertir_cotizacion_a_venta(cotizacion_id, payload)


@router.get(
    "/{cotizacion_id}/mensaje-whatsapp",
    response_model=CotizacionMensajeWhatsappResponse,
)
def mensaje_whatsapp(cotizacion_id: int):
    return generar_mensaje_whatsapp_cotizacion(cotizacion_id)
