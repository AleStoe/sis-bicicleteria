from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .service import obtener_alertas_operativas, sincronizar_saldo_venta_desde_deuda

router = APIRouter()


class SincronizarSaldoVentaInput(BaseModel):
    id_usuario: int = Field(gt=0)


@router.get("/")
def alertas(
    dias_lista_retiro: int = Query(default=7, ge=1, le=365),
    stock_umbral: int = Query(default=2, ge=0, le=999999),
):
    return obtener_alertas_operativas(
        dias_lista_retiro=dias_lista_retiro,
        stock_umbral=stock_umbral,
    )


@router.post("/ventas/{venta_id}/sincronizar-deuda")
def sincronizar_saldo_venta(venta_id: int, data: SincronizarSaldoVentaInput):
    return sincronizar_saldo_venta_desde_deuda(venta_id, data.id_usuario)
