from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class PagoCreateInput(BaseModel):
    id_sucursal: int | None = Field(default=None, gt=0)
    id_cliente: int | None = Field(default=None, gt=0)
    origen_tipo: str
    origen_id: int
    medio_pago: str

    # V2: base comercial del tramo.
    monto_base: Decimal | None = Field(default=None, gt=0)

    # Compatibilidad temporal V1: cobrado real directo.
    monto: Decimal | None = Field(default=None, gt=0)

    id_usuario: int = Field(gt=0)
    nota: str | None = None

    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)

    monto_recargo_financiero: Decimal | None = Field(default=None, ge=0)
    monto_neto_liquidado: Decimal | None = Field(default=None, ge=0)
    id_tarjeta_plan: int | None = Field(default=None, gt=0)
    porcentaje_recargo_aplicado: Decimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validar_monto(self):
        if self.monto_base is None and self.monto is None:
            raise ValueError("Debe informar monto_base")
        return self

    @property
    def base(self) -> Decimal:
        return self.monto_base if self.monto_base is not None else self.monto


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
    monto_base_aplicado: Decimal | None = None
    monto_descuento_aplicado: Decimal | None = None
    monto_recargo_aplicado: Decimal | None = None

    estado: str
    nota: str | None = None
    id_usuario: int
    usuario_nombre: str | None = None
    usuario_username: str | None = None
    id_tarjeta_plan: int | None = None
    tarjeta_plan_nombre: str | None = None
    cuotas: int | None = None
    entidad: str | None = None
    monto_base: Decimal | None = None
    monto_recargo_financiero: Decimal | None = None
    porcentaje_recargo_aplicado: Decimal | None = None
    monto_neto_liquidado: Decimal | None = None


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

class PagoVentaSimulacionInput(BaseModel):
    venta_id: int = Field(gt=0)
    medio_pago: str

    monto_base: Decimal | None = Field(default=None, gt=0)
    monto_cobrado_objetivo: Decimal | None = Field(default=None, gt=0)

    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def validar_monto(self):
        if self.monto_base is None and self.monto_cobrado_objetivo is None:
            raise ValueError("Debe informar monto_base o monto_cobrado_objetivo")
        return self


class PagoVentaSimulacionOutput(BaseModel):
    medio_pago: str

    monto_base_aplicado: Decimal
    descuento_aplicado: Decimal
    recargo_aplicado: Decimal
    monto_total_cobrado: Decimal

    saldo_pendiente_actual: Decimal
    saldo_restante_estimado: Decimal

    cuotas: int | None = None
    entidad: str | None = None
    id_tarjeta_plan: int | None = None
    porcentaje_recargo_aplicado: Decimal | None = None