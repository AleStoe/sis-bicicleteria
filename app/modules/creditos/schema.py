from decimal import Decimal
from pydantic import BaseModel


class CreditoMovimientoResponse(BaseModel):
    id: int
    id_credito: int
    tipo_movimiento: str
    monto: Decimal
    origen_tipo: str | None = None
    origen_id: int | None = None
    nota: str | None = None
    id_usuario: int


class CreditoResponse(BaseModel):
    id: int
    id_cliente: int
    origen_tipo: str
    origen_id: int
    saldo_actual: Decimal
    estado: str
    observacion: str | None = None


class CreditoDetalleResponse(CreditoResponse):
    movimientos: list[CreditoMovimientoResponse]