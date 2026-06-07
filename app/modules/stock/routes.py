from fastapi import APIRouter, HTTPException, Query
from .service import listar_stock, obtener_resumen_stock, crear_ingreso_stock, crear_ajuste_stock
from .schema import (
    StockSucursalOut,
    StockResumenOut,
    IngresoStockCreate,
    IngresoStockResponse,
    AjusteStockCreate,
    AjusteStockResponse,
)

router = APIRouter()


def _stock_filtros(
    q: str | None = None,
    id_sucursal: int | None = None,
    id_categoria: int | None = None,
    id_marca: int | None = None,
    id_proveedor: int | None = None,
    tipo_operativo: str | None = None,
    estado_stock: str | None = None,
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
    stock_bajo_umbral: int = Query(default=2, ge=0, le=999999),
    dias_sin_movimiento: int | None = Query(default=None, ge=1, le=3650),
    ordenar_por: str = Query(default="producto", pattern="^(producto|variante|stock|fisico|capital|ultima_venta|categoria|marca|proveedor)$"),
    orden: str = Query(default="asc", pattern="^(asc|desc)$"),
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
):
    return listar_stock(
        _stock_filtros(
            q=q,
            id_sucursal=id_sucursal,
            id_categoria=id_categoria,
            id_marca=id_marca,
            id_proveedor=id_proveedor,
            tipo_operativo=tipo_operativo,
            estado_stock=estado_stock,
            stock_bajo_umbral=stock_bajo_umbral,
            dias_sin_movimiento=dias_sin_movimiento,
            ordenar_por=ordenar_por,
            orden=orden,
            limit=limit,
            offset=offset,
        )
    )


@router.get("/resumen", response_model=StockResumenOut)
def stock_resumen(
    q: str | None = Query(default=None),
    id_sucursal: int | None = Query(default=None, gt=0),
    id_categoria: int | None = Query(default=None, gt=0),
    id_marca: int | None = Query(default=None, gt=0),
    id_proveedor: int | None = Query(default=None, gt=0),
    tipo_operativo: str | None = Query(default=None, pattern="^(todos|bicicleta|repuesto|accesorio|producto|no_bicicletas)$"),
    estado_stock: str | None = Query(default=None, pattern="^(todos|con_stock|sin_stock|sin_disponible|stock_bajo|bajo|reservado|pendiente|inconsistente)$"),
    stock_bajo_umbral: int = Query(default=2, ge=0, le=999999),
    dias_sin_movimiento: int | None = Query(default=None, ge=1, le=3650),
):
    return obtener_resumen_stock(
        _stock_filtros(
            q=q,
            id_sucursal=id_sucursal,
            id_categoria=id_categoria,
            id_marca=id_marca,
            id_proveedor=id_proveedor,
            tipo_operativo=tipo_operativo,
            estado_stock=estado_stock,
            stock_bajo_umbral=stock_bajo_umbral,
            dias_sin_movimiento=dias_sin_movimiento,
        )
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
