from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

class PagoCreateInput(BaseModel):
    id_sucursal: int | None = Field(default=None, gt=0)
    id_cliente: int | None = Field(default=None, gt=0)
    origen_tipo: str
    origen_id: int
    medio_pago: str
    monto: Decimal = Field(gt=0)
    id_usuario: int = Field(gt=0)
    nota: str | None = None

class PagoCreateOutput(BaseModel):
    ok: bool
    pago_id: int
    origen_tipo: str | None = None
    origen_id: int | None = None
    venta_id: int | None = None
    estado_venta: str | None = None
    saldo_restante: Decimal | None = None

class PagoReversionInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)

class PagoCreateOutput(BaseModel):
    ok: bool
    pago_id: int
    origen_tipo: str | None = None
    origen_id: int | None = None
    venta_id: int | None = None
    estado_venta: str | None = None
    saldo_restante: Decimal | None = None

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

class PagoResponseBase(BaseModel):
    ok: bool
    pago_id: int
    origen_tipo: str
    origen_id: int

class PagoVentaResponse(PagoResponseBase):
    venta_id: int
    estado_venta: str
    saldo_restante: Decimal

class PagoTallerResponse(PagoResponseBase):
    pass