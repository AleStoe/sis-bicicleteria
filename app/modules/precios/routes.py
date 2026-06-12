from fastapi import APIRouter
from typing import List
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
    FamiliaPrecioOut,
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
    listar_familias_precio,
)

router = APIRouter()

@router.get("/desfasados", response_model=PreciosDesfasadosResponse)
def precios_desfasados_route(
    tipo_cliente: str = "minorista",
    id_proveedor: int | None = None,
    id_categoria: int | None = None,
    id_marca: int | None = None,
):
    return listar_precios_desfasados(
        tipo_cliente=tipo_cliente,
        id_proveedor=id_proveedor,
        id_categoria=id_categoria,
        id_marca=id_marca,
    )

@router.get("/variantes/{id_variante}", response_model=VariantePrecioOutput)
def precio_variante_route(id_variante: int):
    return obtener_precio_variante(id_variante)


@router.post(
    "/variantes/{id_variante}/actualizar",
    response_model=PrecioActualizarOutput,
)
def actualizar_precio_variante_route(
    id_variante: int,
    data: PrecioActualizarInput,
):
    return actualizar_precio_variante(id_variante, data)


@router.get(
    "/variantes/{id_variante}/historial",
    response_model=PrecioHistorialOutput,
)
def historial_precio_variante_route(id_variante: int):
    return obtener_historial_precio_variante(id_variante)

@router.post("/reglas", response_model=ReglaPrecioOutput)
def crear_regla_precio_route(data: ReglaPrecioCreateInput):
    return crear_regla_precio(data)


@router.get("/reglas", response_model=List[ReglaPrecioOutput])
def reglas_precio_route(solo_activas: bool = True):
    return listar_reglas_precio(solo_activas=solo_activas)


@router.post("/reglas/{regla_id}/desactivar", response_model=ReglaPrecioOutput)
def desactivar_regla_precio_route(
    regla_id: int,
    data: ReglaPrecioEstadoInput,
):
    return desactivar_regla_precio(regla_id, data)


@router.post(
    "/variantes/{id_variante}/sugerir",
    response_model=PrecioSugeridoOutput,
)
def sugerir_precio_variante_route(
    id_variante: int,
    data: PrecioSugeridoInput,
):
    return sugerir_precio_variante(id_variante, data)

@router.post(
    "/recalcular-proveedor",
    response_model=RecalculoProveedorOutput,
)
def recalcular_precios_por_proveedor_route(data: RecalculoProveedorInput):
    return recalcular_precios_por_proveedor(data)

@router.get("/familias", response_model=List[FamiliaPrecioOut])
def familias_precio_route():
    return listar_familias_precio()