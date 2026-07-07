from fastapi import APIRouter, Depends
from typing import List

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_PRECIOS
from .schema import (
    VariantePrecioOutput,
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

router = APIRouter()
puede_gestionar_precios = requerir_permiso(PERMISO_GESTIONAR_PRECIOS)

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
