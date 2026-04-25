from decimal import Decimal
from pydantic import BaseModel
from pydantic import Field

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


class CreditoDetalleResponse(BaseModel):
    credito: CreditoResponse
    movimientos: list[CreditoMovimientoResponse]

class CreditoReintegroInput(BaseModel):
    monto: Decimal = Field(..., gt=0)
    medio_pago: str
    motivo: str
    id_sucursal: int
    id_usuario: int


class CreditoReintegroResponse(BaseModel):
    ok: bool
    credito_id: int
    saldo_actual: Decimal
    estado: str