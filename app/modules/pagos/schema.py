from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class PagoCreateInput(BaseModel):
    venta_id: int = Field(gt=0)
    medio_pago: str
    monto: Decimal = Field(gt=0)
    id_usuario: int = Field(gt=0)
    nota: str | None = None


class PagoCreateOutput(BaseModel):
    ok: bool
    pago_id: int
    venta_id: int
    estado_venta: str
    saldo_restante: Decimal


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