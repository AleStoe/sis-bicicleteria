from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from typing import List

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_PRECIOS
from .schema import (
    VariantePrecioOutput,
    CostoReposicionActualizarInput,
    CostoReposicionActualizarOutput,
    PrecioActualizarInput,
    PrecioActualizarOutput,
    PrecioHistorialOutput,
    ReglaPrecioCreateInput,
    ReglaPrecioOutput,
    ReglaPrecioEstadoInput,
    PrecioSugeridoInput,
    PrecioSugeridoOutput,
    PreciosDesfasadosResponse,
    RecalculoProveedorInput,
    RecalculoProveedorOutput,
    AjusteProveedorInput,
    AjusteProveedorOutput,
    FamiliaPrecioOut,
    CorreccionCargaInicialInput,
    CorreccionCargaInicialOutput,
)
from .service import (
    obtener_precio_variante,
    actualizar_costo_reposicion_variante,
    actualizar_precio_variante,
    obtener_historial_precio_variante,
    crear_regla_precio,
    listar_reglas_precio,
    desactivar_regla_precio,
    sugerir_precio_variante,
    listar_precios_desfasados,
    recalcular_precios_por_proveedor,
    ajustar_precios_por_proveedor,
    listar_familias_precio,
    corregir_carga_inicial_variante,
)
from .listas_schema import (
    PrecioListaLoteAnularInput,
    PrecioListaCoincidenciasProcesarInput,
    PrecioListaLoteDetalleOut,
    PrecioListaLoteResumenOut,
    PrecioListaItemDesvincularInput,
    PrecioListaItemVincularInput,
    PrecioListaItemPreviewInput,
    PrecioListaPreviewInput,
    PrecioListaAplicarInput,
    PrecioListaRevertirInput,
    PrecioListaPerfilCreateInput,
    PrecioListaPerfilOut,
)
from .listas_service import (
    anular_lote_precios,
    guardar_perfil_desde_lote,
    importar_lista_precios,
    listar_lotes_precios,
    listar_perfiles_precios,
    obtener_lote_precios,
    procesar_coincidencias_lote,
    vincular_item_lote,
    desvincular_item_lote,
    generar_preview_lote,
    actualizar_preview_item,
    aplicar_lote_precios,
    revertir_lote_precios,
    generar_informe_lote_precios,
)

router = APIRouter()
puede_gestionar_precios = requerir_permiso(PERMISO_GESTIONAR_PRECIOS)


def _actor_lista(usuario: CurrentUser, actor_enviado: int | None) -> int:
    if usuario.auth_disabled:
        if actor_enviado is None:
            raise HTTPException(status_code=400, detail="Se requiere id_usuario para auditar la operación")
        return actor_enviado
    return usuario.id


@router.post("/listas-lotes/importar", response_model=PrecioListaLoteDetalleOut)
async def importar_lista_precios_route(
    archivo: UploadFile = File(...),
    id_proveedor: int = Form(..., gt=0),
    observaciones: str | None = Form(default=None, max_length=2000),
    id_usuario: int | None = Form(default=None),
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    id_usuario = _actor_lista(usuario, id_usuario)
    contenido = await archivo.read()
    return importar_lista_precios(
        nombre_archivo=archivo.filename or "lista",
        mime_type=archivo.content_type,
        contenido=contenido,
        proveedor_id=id_proveedor,
        observaciones=observaciones,
        usuario_id=id_usuario,
    )


@router.get("/listas-lotes", response_model=list[PrecioListaLoteResumenOut])
def listar_lotes_precios_route(
    estado: str | None = Query(default=None),
    id_proveedor: int | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=200),
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return listar_lotes_precios(estado=estado, proveedor_id=id_proveedor, limit=limit)


@router.get("/listas-lotes/{lote_id}", response_model=PrecioListaLoteDetalleOut)
def obtener_lote_precios_route(
    lote_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return obtener_lote_precios(lote_id)


@router.post("/listas-lotes/{lote_id}/anular", response_model=PrecioListaLoteDetalleOut)
def anular_lote_precios_route(
    lote_id: int,
    data: PrecioListaLoteAnularInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return anular_lote_precios(lote_id, data)


@router.post("/listas-lotes/{lote_id}/perfil", response_model=PrecioListaPerfilOut)
def guardar_perfil_lista_precios_route(
    lote_id: int,
    data: PrecioListaPerfilCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return guardar_perfil_desde_lote(lote_id, data)


@router.get("/listas-perfiles", response_model=list[PrecioListaPerfilOut])
def listar_perfiles_lista_precios_route(
    id_proveedor: int | None = Query(default=None, gt=0),
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return listar_perfiles_precios(id_proveedor)


@router.post(
    "/listas-lotes/{lote_id}/coincidencias/procesar",
    response_model=PrecioListaLoteDetalleOut,
)
def procesar_coincidencias_lote_route(
    lote_id: int,
    data: PrecioListaCoincidenciasProcesarInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return procesar_coincidencias_lote(lote_id, data)


@router.post(
    "/listas-lotes/{lote_id}/items/{item_id}/vincular",
    response_model=PrecioListaLoteDetalleOut,
)
def vincular_item_lote_route(
    lote_id: int,
    item_id: int,
    data: PrecioListaItemVincularInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return vincular_item_lote(lote_id, item_id, data)


@router.post(
    "/listas-lotes/{lote_id}/items/{item_id}/desvincular",
    response_model=PrecioListaLoteDetalleOut,
)
def desvincular_item_lote_route(
    lote_id: int,
    item_id: int,
    data: PrecioListaItemDesvincularInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return desvincular_item_lote(lote_id, item_id, data)


@router.post(
    "/listas-lotes/{lote_id}/preview",
    response_model=PrecioListaLoteDetalleOut,
)
def generar_preview_lote_route(
    lote_id: int,
    data: PrecioListaPreviewInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return generar_preview_lote(lote_id, data)


@router.patch(
    "/listas-lotes/{lote_id}/items/{item_id}/preview",
    response_model=PrecioListaLoteDetalleOut,
)
def actualizar_preview_item_route(
    lote_id: int,
    item_id: int,
    data: PrecioListaItemPreviewInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return actualizar_preview_item(lote_id, item_id, data)


@router.post(
    "/listas-lotes/{lote_id}/aplicar",
    response_model=PrecioListaLoteDetalleOut,
)
def aplicar_lote_precios_route(
    lote_id: int,
    data: PrecioListaAplicarInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return aplicar_lote_precios(lote_id, data)


@router.post(
    "/listas-lotes/{lote_id}/revertir",
    response_model=PrecioListaLoteDetalleOut,
)
def revertir_lote_precios_route(
    lote_id: int,
    data: PrecioListaRevertirInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    data.id_usuario = _actor_lista(usuario, data.id_usuario)
    return revertir_lote_precios(lote_id, data)


@router.get("/listas-lotes/{lote_id}/informe")
def informe_lote_precios_route(
    lote_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    content = generar_informe_lote_precios(lote_id)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Lote-precios-{lote_id}.pdf"'},
    )

@router.get("/desfasados", response_model=PreciosDesfasadosResponse)
def precios_desfasados_route(
    tipo_cliente: str = "minorista",
    id_proveedor: int | None = None,
    id_categoria: int | None = None,
    id_marca: int | None = None,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return listar_precios_desfasados(
        tipo_cliente=tipo_cliente,
        id_proveedor=id_proveedor,
        id_categoria=id_categoria,
        id_marca=id_marca,
    )

@router.get("/variantes/{id_variante}", response_model=VariantePrecioOutput)
def precio_variante_route(
    id_variante: int,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return obtener_precio_variante(id_variante)


@router.post(
    "/variantes/{id_variante}/actualizar",
    response_model=PrecioActualizarOutput,
)
def actualizar_precio_variante_route(
    id_variante: int,
    data: PrecioActualizarInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_precio_variante(id_variante, data)


@router.post(
    "/variantes/{id_variante}/costo-reposicion",
    response_model=CostoReposicionActualizarOutput,
)
def actualizar_costo_reposicion_variante_route(
    id_variante: int,
    data: CostoReposicionActualizarInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_costo_reposicion_variante(id_variante, data)


@router.get(
    "/variantes/{id_variante}/historial",
    response_model=PrecioHistorialOutput,
)
def historial_precio_variante_route(
    id_variante: int,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return obtener_historial_precio_variante(id_variante)


@router.post(
    "/variantes/{id_variante}/correccion-inicial",
    response_model=CorreccionCargaInicialOutput,
)
def corregir_carga_inicial_variante_route(
    id_variante: int,
    data: CorreccionCargaInicialInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    aplicar_actor_actual(data, usuario)
    return corregir_carga_inicial_variante(id_variante, data)

@router.post("/reglas", response_model=ReglaPrecioOutput)
def crear_regla_precio_route(
    data: ReglaPrecioCreateInput,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return crear_regla_precio(data)


@router.get("/reglas", response_model=List[ReglaPrecioOutput])
def reglas_precio_route(
    solo_activas: bool = True,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return listar_reglas_precio(solo_activas=solo_activas)


@router.post("/reglas/{regla_id}/desactivar", response_model=ReglaPrecioOutput)
def desactivar_regla_precio_route(
    regla_id: int,
    data: ReglaPrecioEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    aplicar_actor_actual(data, usuario)
    return desactivar_regla_precio(regla_id, data)


@router.post(
    "/variantes/{id_variante}/sugerir",
    response_model=PrecioSugeridoOutput,
)
def sugerir_precio_variante_route(
    id_variante: int,
    data: PrecioSugeridoInput,
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return sugerir_precio_variante(id_variante, data)

@router.post(
    "/recalcular-proveedor",
    response_model=RecalculoProveedorOutput,
)
def recalcular_precios_por_proveedor_route(
    data: RecalculoProveedorInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    aplicar_actor_actual(data, usuario)
    return recalcular_precios_por_proveedor(data)


@router.post(
    "/ajuste-proveedor",
    response_model=AjusteProveedorOutput,
)
def ajustar_precios_por_proveedor_route(
    data: AjusteProveedorInput,
    usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    aplicar_actor_actual(data, usuario)
    return ajustar_precios_por_proveedor(data)


@router.get("/familias", response_model=List[FamiliaPrecioOut])
def familias_precio_route(
    _usuario: CurrentUser = Depends(puede_gestionar_precios),
):
    return listar_familias_precio()
