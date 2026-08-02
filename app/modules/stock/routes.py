from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import CurrentUser, obtener_usuario_actual
from app.shared.constants import (
    PERMISO_GESTIONAR_PRECIOS,
    PERMISO_VER_RENTABILIDAD,
)
from .service import (
    listar_stock,
    obtener_resumen_stock,
    obtener_pedido_compra_sugerido,
    obtener_analisis_demanda,
    crear_ingreso_stock,
    crear_ajuste_stock,
)
from .schema import (
    StockSucursalOut,
    StockResumenOut,
    PedidoCompraSugeridoOut,
    DemandaResumenOut,
    IngresoStockCreate,
    IngresoStockResponse,
    AjusteStockCreate,
    AjusteStockResponse,
)

router = APIRouter()


def _puede_ver_costos(usuario: CurrentUser) -> bool:
    return (
        usuario.auth_disabled
        or "*" in usuario.permisos
        or PERMISO_GESTIONAR_PRECIOS in usuario.permisos
        or PERMISO_VER_RENTABILIDAD in usuario.permisos
    )


def _stock_filtros(
    q: str | None = None,
    id_sucursal: int | None = None,
    id_categoria: int | None = None,
    id_marca: int | None = None,
    id_proveedor: int | None = None,
    tipo_operativo: str | None = None,
    estado_stock: str | None = None,
    reponer_stock: bool | None = None,
    stock_bajo_umbral: int = 2,
    dias_sin_movimiento: int | None = None,
    ordenar_por: str = "producto",
    orden: str = "asc",
    limit: int = 500,
    offset: int = 0,
):
    return {
        "q": q,
        "id_sucursal": id_sucursal,
        "id_categoria": id_categoria,
        "id_marca": id_marca,
        "id_proveedor": id_proveedor,
        "tipo_operativo": tipo_operativo,
        "estado_stock": estado_stock,
        "reponer_stock": reponer_stock,
        "stock_bajo_umbral": stock_bajo_umbral,
        "dias_sin_movimiento": dias_sin_movimiento,
        "ordenar_por": ordenar_por,
        "orden": orden,
        "limit": limit,
        "offset": offset,
    }


@router.get("/", response_model=list[StockSucursalOut])
def stock(
    q: str | None = Query(default=None),
    id_sucursal: int | None = Query(default=None, gt=0),
    id_categoria: int | None = Query(default=None, gt=0),
    id_marca: int | None = Query(default=None, gt=0),
    id_proveedor: int | None = Query(default=None, gt=0),
    tipo_operativo: str | None = Query(default=None, pattern="^(todos|bicicleta|repuesto|accesorio|producto|no_bicicletas)$"),
    estado_stock: str | None = Query(default=None, pattern="^(todos|con_stock|sin_stock|sin_disponible|stock_bajo|bajo|reservado|pendiente|inconsistente)$"),
    reponer_stock: bool | None = Query(default=None),
    stock_bajo_umbral: int = Query(default=2, ge=0, le=999999),
    dias_sin_movimiento: int | None = Query(default=None, ge=1, le=3650),
    ordenar_por: str = Query(default="producto", pattern="^(producto|variante|stock|fisico|capital|ultima_venta|categoria|marca|proveedor)$"),
    orden: str = Query(default="asc", pattern="^(asc|desc)$"),
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    items = listar_stock(
        _stock_filtros(
            q=q,
            id_sucursal=id_sucursal,
            id_categoria=id_categoria,
            id_marca=id_marca,
            id_proveedor=id_proveedor,
            tipo_operativo=tipo_operativo,
            estado_stock=estado_stock,
            reponer_stock=reponer_stock,
            stock_bajo_umbral=stock_bajo_umbral,
            dias_sin_movimiento=dias_sin_movimiento,
            ordenar_por=ordenar_por,
            orden=orden,
            limit=limit,
            offset=offset,
        )
    )
    if _puede_ver_costos(usuario):
        return items

    return [
        {
            **dict(item),
            "costo_promedio_vigente": None,
            "capital_inmovilizado": None,
        }
        for item in items
    ]


@router.get("/resumen", response_model=StockResumenOut)
def stock_resumen(
    q: str | None = Query(default=None),
    id_sucursal: int | None = Query(default=None, gt=0),
    id_categoria: int | None = Query(default=None, gt=0),
    id_marca: int | None = Query(default=None, gt=0),
    id_proveedor: int | None = Query(default=None, gt=0),
    tipo_operativo: str | None = Query(default=None, pattern="^(todos|bicicleta|repuesto|accesorio|producto|no_bicicletas)$"),
    estado_stock: str | None = Query(default=None, pattern="^(todos|con_stock|sin_stock|sin_disponible|stock_bajo|bajo|reservado|pendiente|inconsistente)$"),
    reponer_stock: bool | None = Query(default=None),
    stock_bajo_umbral: int = Query(default=2, ge=0, le=999999),
    dias_sin_movimiento: int | None = Query(default=None, ge=1, le=3650),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    resumen = obtener_resumen_stock(
        _stock_filtros(
            q=q,
            id_sucursal=id_sucursal,
            id_categoria=id_categoria,
            id_marca=id_marca,
            id_proveedor=id_proveedor,
            tipo_operativo=tipo_operativo,
            estado_stock=estado_stock,
            reponer_stock=reponer_stock,
            stock_bajo_umbral=stock_bajo_umbral,
            dias_sin_movimiento=dias_sin_movimiento,
        )
    )
    if _puede_ver_costos(usuario):
        return resumen

    return {**dict(resumen), "capital_inmovilizado_total": None}


@router.get("/pedido-sugerido", response_model=PedidoCompraSugeridoOut)
def pedido_compra_sugerido(
    q: str | None = Query(default=None),
    id_sucursal: int | None = Query(default=None, gt=0),
    id_categoria: int | None = Query(default=None, gt=0),
    id_marca: int | None = Query(default=None, gt=0),
    id_proveedor: int | None = Query(default=None, gt=0),
    tipo_operativo: str | None = Query(default=None, pattern="^(todos|bicicleta|repuesto|accesorio|producto|no_bicicletas)$"),
    stock_bajo_umbral: int = Query(default=2, ge=0, le=999999),
    limit: int = Query(default=2000, ge=1, le=5000),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_pedido_compra_sugerido(
        {
            "q": q,
            "id_sucursal": id_sucursal,
            "id_categoria": id_categoria,
            "id_marca": id_marca,
            "id_proveedor": id_proveedor,
            "tipo_operativo": tipo_operativo,
            "stock_bajo_umbral": stock_bajo_umbral,
            "limit": limit,
        }
    )


@router.get("/demanda", response_model=DemandaResumenOut)
def analisis_demanda(
    q: str | None = Query(default=None),
    id_sucursal: int | None = Query(default=None, gt=0),
    tipo_operativo: str | None = Query(default=None, pattern="^(todos|bicicleta|repuesto|accesorio|producto|no_bicicletas)$"),
    meses: int = Query(default=12, ge=1, le=36),
    limit: int = Query(default=80, ge=1, le=500),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_analisis_demanda(
        {
            "q": q,
            "id_sucursal": id_sucursal,
            "tipo_operativo": tipo_operativo,
            "meses": meses,
            "limit": limit,
        },
        puede_ver_costos=_puede_ver_costos(usuario),
    )


@router.post("/ingresos", response_model=IngresoStockResponse)
def crear_ingreso(payload: IngresoStockCreate):
    try:
        return crear_ingreso_stock(payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post("/ajustes", response_model=AjusteStockResponse)
def crear_ajuste(payload: AjusteStockCreate):
    try:
        return crear_ajuste_stock(payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
