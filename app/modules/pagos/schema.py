from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

class PagoCreateInput(BaseModel):
    origen_tipo: str
    origen_id: int
    medio_pago: str
    monto: float
    id_usuario: int
    nota: str | None = None


class PagoReversionInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class PagoCreateOutput(BaseModel):
    ok: bool
    pago_id: int
    venta_id: int
    estado_venta: str
    saldo_restante: Decimal


class PagoReversionOutput(BaseModel):
    ok: bool
    pago_id_original: int
    pago_id_reversion: int
    venta_id: int
    estado_venta: str
    saldo_restante: Decimal
    reversion_id: int


class PagoResumenOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_cliente: int | None = None
    origen_tipo: str
    origen_id: int
    medio_pago: str
    monto_total_cobrado: Decimal
    estado: str
    nota: str | None = None
    id_usuario: int