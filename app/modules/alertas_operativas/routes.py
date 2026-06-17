from fastapi import APIRouter, Query

from .service import obtener_alertas_operativas

router = APIRouter()


@router.get("/")
def alertas(
    dias_lista_retiro: int = Query(default=7, ge=1, le=365),
    stock_umbral: int = Query(default=2, ge=0, le=999999),
):
    return obtener_alertas_operativas(
        dias_lista_retiro=dias_lista_retiro,
        stock_umbral=stock_umbral,
    )
