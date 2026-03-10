from fastapi import APIRouter, HTTPException
from .service import listar_stock, registrar_ingreso_stock
from .schema import StockSucursalOut, IngresoStockCreate, IngresoStockResponse

router = APIRouter()


@router.get("/", response_model=list[StockSucursalOut])
def stock():
    return listar_stock()


@router.post("/ingresos", response_model=IngresoStockResponse)
def crear_ingreso(payload: IngresoStockCreate):
    try:
        return registrar_ingreso_stock(payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")