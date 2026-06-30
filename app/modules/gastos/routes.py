from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_GASTOS

from .schema import (
    GastoCategoriaCreateInput,
    GastoCategoriaUpdateInput,
    GastoCategoriaEstadoInput,
    GastoCategoriaOutput,
    GastoCategoriaEstadoOutput,
    GastoCreateInput,
    GastoCreateOutput,
    GastoOutput,
    GastoDetalleOutput,
    GastoAnularInput,
    GastoCorregirInput,
    GastoEstadoOutput,
    GastoResumenOutput,
)
from .service import (
    GastoFiltros,
    crear_categoria,
    listar_categorias,
    editar_categoria,
    cambiar_estado_categoria,
    crear_gasto,
    listar_gastos,
    obtener_resumen_gastos,
    obtener_gasto,
    anular_gasto,
    corregir_gasto,
)

router = APIRouter()
puede_gestionar_gastos = requerir_permiso(PERMISO_GESTIONAR_GASTOS)


@router.post("/categorias", response_model=GastoCategoriaOutput)
def crear_categoria_route(data: GastoCategoriaCreateInput):
    return crear_categoria(data)


@router.get("/categorias", response_model=List[GastoCategoriaOutput])
def categorias_route(incluir_inactivas: bool = False):
    return listar_categorias(incluir_inactivas=incluir_inactivas)


@router.put("/categorias/{categoria_id}", response_model=GastoCategoriaOutput)
def editar_categoria_route(categoria_id: int, data: GastoCategoriaUpdateInput):
    return editar_categoria(categoria_id, data)


@router.patch("/categorias/{categoria_id}/estado", response_model=GastoCategoriaEstadoOutput)
def cambiar_estado_categoria_route(categoria_id: int, data: GastoCategoriaEstadoInput):
    return cambiar_estado_categoria(categoria_id, data)


@router.post("/", response_model=GastoCreateOutput)
def crear_gasto_route(
    data: GastoCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_gastos),
):
    aplicar_actor_actual(data, usuario)
    return crear_gasto(data)


@router.get("/", response_model=List[GastoOutput])
def gastos_route(
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    id_categoria_gasto: Optional[int] = Query(default=None, gt=0),
    estado: Optional[str] = None,
    medio_pago: Optional[str] = None,
    impacta_caja: Optional[bool] = None,
    es_recurrente: Optional[bool] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    periodo_mes: Optional[date] = None,
    q: Optional[str] = Query(default=None, min_length=2, max_length=100),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    filtros = GastoFiltros(
        id_sucursal=id_sucursal,
        id_categoria_gasto=id_categoria_gasto,
        estado=estado,
        medio_pago=medio_pago,
        impacta_caja=impacta_caja,
        es_recurrente=es_recurrente,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        periodo_mes=periodo_mes,
        q=q,
        limit=limit,
        offset=offset,
    )
    return listar_gastos(filtros)


@router.get("/resumen", response_model=GastoResumenOutput)
def gastos_resumen_route(
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    id_categoria_gasto: Optional[int] = Query(default=None, gt=0),
    estado: Optional[str] = None,
    medio_pago: Optional[str] = None,
    impacta_caja: Optional[bool] = None,
    es_recurrente: Optional[bool] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    periodo_mes: Optional[date] = None,
    q: Optional[str] = Query(default=None, min_length=2, max_length=100),
):
    filtros = GastoFiltros(
        id_sucursal=id_sucursal,
        id_categoria_gasto=id_categoria_gasto,
        estado=estado,
        medio_pago=medio_pago,
        impacta_caja=impacta_caja,
        es_recurrente=es_recurrente,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        periodo_mes=periodo_mes,
        q=q,
        limit=1,
        offset=0,
    )
    return obtener_resumen_gastos(filtros)


@router.get("/{gasto_id}", response_model=GastoDetalleOutput)
def gasto_detalle_route(gasto_id: int):
    return obtener_gasto(gasto_id)


@router.post("/{gasto_id}/anular", response_model=GastoEstadoOutput)
def anular_gasto_route(
    gasto_id: int,
    data: GastoAnularInput,
    usuario: CurrentUser = Depends(puede_gestionar_gastos),
):
    aplicar_actor_actual(data, usuario)
    return anular_gasto(gasto_id, data)


@router.post("/{gasto_id}/corregir", response_model=GastoEstadoOutput)
def corregir_gasto_route(
    gasto_id: int,
    data: GastoCorregirInput,
    usuario: CurrentUser = Depends(puede_gestionar_gastos),
):
    aplicar_actor_actual(data, usuario)
    return corregir_gasto(gasto_id, data)
