from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.modules.authz.service import exigir_permiso_actual
from app.shared.constants import PERMISO_AJUSTAR_STOCK, PERMISO_GESTIONAR_CATALOGO

from .schema import (
    RecepcionDetalleOut,
    RecepcionAccionInput,
    RecepcionAnularInput,
    RecepcionClasificacionMasivaInput,
    RecepcionDeshacerCoincidenciaInput,
    RecepcionItemAltaInput,
    RecepcionItemLecturaInput,
    RecepcionItemPrecioSugerenciaInput,
    RecepcionItemPrecioSugerenciaOut,
    RecepcionItemPrecioInput,
    RecepcionPreciosPreviewInput,
    RecepcionCostosInput,
    RecepcionConfirmarInput,
    RecepcionItemVinculoInput,
    RecepcionResumenOut,
    RecepcionReglaResolverInput,
    RecepcionTablaImportInput,
)
from .service import aceptar_vinculo, anular_recepcion, clasificar_items_masivamente, configurar_costos, confirmar_recepcion, deshacer_coincidencia, eliminar_documento, eliminar_linea, guardar_imagen_preparada_item, guardar_lectura_item, guardar_precio_item, importar_documento, importar_tabla, listar_recepciones, obtener_recepcion, preparar_alta, previsualizar_precios, quitar_imagen_preparada_item, reprocesar_documento, resolver_sugerencia_regla, sugerir_precios_item


router = APIRouter()
puede_gestionar_catalogo = requerir_permiso(PERMISO_GESTIONAR_CATALOGO)


@router.get("/", response_model=list[RecepcionResumenOut])
def listar_recepciones_route(
    estado: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_recepciones(estado=estado, limit=limit)


@router.post("/importar-tabla", response_model=RecepcionDetalleOut)
def importar_tabla_route(
    data: RecepcionTablaImportInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return importar_tabla(data)


@router.post("/importar-documento", response_model=RecepcionDetalleOut)
async def importar_documento_route(
    archivo: UploadFile = File(...),
    id_proveedor: int = Form(..., gt=0),
    id_sucursal: int = Form(..., gt=0),
    observaciones: str | None = Form(default=None, max_length=2000),
    id_usuario: int | None = Form(default=None),
    recepcion_id: int | None = Form(default=None, gt=0),
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    if not usuario.auth_disabled:
        id_usuario = usuario.id
    contenido = await archivo.read()
    return importar_documento(
        nombre_archivo=archivo.filename or "documento",
        mime_type=archivo.content_type,
        contenido=contenido,
        id_proveedor=id_proveedor,
        id_sucursal=id_sucursal,
        observaciones=observaciones,
        id_usuario=id_usuario,
        recepcion_id=recepcion_id,
    )


@router.post("/documentos/{documento_id}/reprocesar", response_model=RecepcionDetalleOut)
def reprocesar_documento_route(
    documento_id: int,
    reemplazar_lineas: bool = Query(default=False),
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return reprocesar_documento(
        documento_id,
        id_usuario=None if usuario.auth_disabled else usuario.id,
        reemplazar_lineas=reemplazar_lineas,
    )


@router.patch("/reglas-sugeridas/{sugerencia_id}")
def resolver_sugerencia_regla_route(
    sugerencia_id: int,
    data: RecepcionReglaResolverInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return resolver_sugerencia_regla(sugerencia_id, data)


@router.get("/{recepcion_id}", response_model=RecepcionDetalleOut)
def obtener_recepcion_route(
    recepcion_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_recepcion(recepcion_id)


@router.post("/{recepcion_id}/anular", response_model=RecepcionDetalleOut)
def anular_recepcion_route(
    recepcion_id: int,
    data: RecepcionAnularInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return anular_recepcion(recepcion_id, data)


@router.delete("/{recepcion_id}/items/{item_id}", response_model=RecepcionDetalleOut)
def eliminar_linea_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionAccionInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return eliminar_linea(recepcion_id, item_id, data)


@router.delete("/{recepcion_id}/documentos/{documento_id}", response_model=RecepcionDetalleOut)
def eliminar_documento_route(
    recepcion_id: int,
    documento_id: int,
    data: RecepcionAccionInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return eliminar_documento(recepcion_id, documento_id, data)


@router.patch("/{recepcion_id}/items/clasificacion-masiva", response_model=RecepcionDetalleOut)
def clasificar_items_masivamente_route(
    recepcion_id: int,
    data: RecepcionClasificacionMasivaInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return clasificar_items_masivamente(recepcion_id, data)


@router.post("/{recepcion_id}/items/lectura", response_model=RecepcionDetalleOut)
def agregar_lectura_item_route(
    recepcion_id: int,
    data: RecepcionItemLecturaInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return guardar_lectura_item(recepcion_id, None, data)


@router.patch("/{recepcion_id}/items/{item_id}/lectura", response_model=RecepcionDetalleOut)
def corregir_lectura_item_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionItemLecturaInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return guardar_lectura_item(recepcion_id, item_id, data)


@router.patch("/{recepcion_id}/items/{item_id}/preparar-alta", response_model=RecepcionDetalleOut)
def preparar_alta_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionItemAltaInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return preparar_alta(recepcion_id, item_id, data)


@router.post("/{recepcion_id}/items/{item_id}/imagen", response_model=RecepcionDetalleOut)
async def guardar_imagen_item_route(
    recepcion_id: int,
    item_id: int,
    archivo: UploadFile = File(...),
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    contenido = await archivo.read()
    return guardar_imagen_preparada_item(
        recepcion_id,
        item_id,
        nombre_archivo=archivo.filename or "imagen",
        mime_type=archivo.content_type,
        contenido=contenido,
        id_usuario=None if usuario.auth_disabled else usuario.id,
    )


@router.delete("/{recepcion_id}/items/{item_id}/imagen", response_model=RecepcionDetalleOut)
def quitar_imagen_item_route(
    recepcion_id: int,
    item_id: int,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return quitar_imagen_preparada_item(
        recepcion_id,
        item_id,
        id_usuario=None if usuario.auth_disabled else usuario.id,
    )


@router.post(
    "/{recepcion_id}/items/{item_id}/precios/sugerir",
    response_model=RecepcionItemPrecioSugerenciaOut,
)
def sugerir_precios_item_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionItemPrecioSugerenciaInput,
    _usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return sugerir_precios_item(recepcion_id, item_id, data)


@router.patch("/{recepcion_id}/items/{item_id}/vincular", response_model=RecepcionDetalleOut)
def aceptar_vinculo_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionItemVinculoInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return aceptar_vinculo(recepcion_id, item_id, data)


@router.patch("/{recepcion_id}/items/{item_id}/deshacer-coincidencia", response_model=RecepcionDetalleOut)
def deshacer_coincidencia_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionDeshacerCoincidenciaInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return deshacer_coincidencia(recepcion_id, item_id, data)


@router.patch("/{recepcion_id}/costos", response_model=RecepcionDetalleOut)
def configurar_costos_route(
    recepcion_id: int,
    data: RecepcionCostosInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return configurar_costos(recepcion_id, data)


@router.post("/{recepcion_id}/precios/previsualizar", response_model=RecepcionDetalleOut)
def previsualizar_precios_route(
    recepcion_id: int,
    data: RecepcionPreciosPreviewInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return previsualizar_precios(recepcion_id, data)


@router.patch("/{recepcion_id}/items/{item_id}/precio", response_model=RecepcionDetalleOut)
def guardar_precio_item_route(
    recepcion_id: int,
    item_id: int,
    data: RecepcionItemPrecioInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return guardar_precio_item(recepcion_id, item_id, data)


@router.post("/{recepcion_id}/confirmar", response_model=RecepcionDetalleOut)
def confirmar_recepcion_route(
    recepcion_id: int,
    data: RecepcionConfirmarInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    exigir_permiso_actual(usuario, PERMISO_AJUSTAR_STOCK)
    aplicar_actor_actual(data, usuario)
    return confirmar_recepcion(recepcion_id, data)
