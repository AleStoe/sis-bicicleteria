from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class DeudaCrearInput(BaseModel):
    id_cliente: int = Field(..., gt=0)
    id_venta: int = Field(..., gt=0)
    monto_inicial: Decimal = Field(..., gt=0)
    observacion: Optional[str] = None
    id_usuario: int = Field(..., gt=0)


class DeudaPagoInput(BaseModel):
    monto: Decimal = Field(..., gt=0)
    medio_pago: str
    nota: Optional[str] = None
    id_usuario: int = Field(..., gt=0)


class DeudaOut(BaseModel):
    id: int
    id_cliente: int
    origen_tipo: str
    origen_id: int
    saldo_actual: Decimal
    estado: str
    genera_recargo: bool
    tasa_recargo: Optional[Decimal] = None
    proximo_vencimiento: Optional[str] = None
    observacion: Optional[str] = None


class DeudaMovimientoOut(BaseModel):
    id: int
    id_deuda: int
    tipo_movimiento: str
    monto: Decimal
    origen_tipo: Optional[str] = None
    origen_id: Optional[int] = None
    nota: Optional[str] = None
    id_usuario: int


class DeudaDetalleOut(BaseModel):
    deuda: dict
    movimientos: list[dict]