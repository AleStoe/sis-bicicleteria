from decimal import Decimal
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, model_validator


TipoReglaComercial = Literal["descuento", "recargo"]
MedioPagoRegla = Literal["efectivo", "transferencia", "mercadopago", "tarjeta"]


class ReglaComercialOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    tipo: str
    medio_pago: str | None = None
    porcentaje: Decimal | None = None
    monto_fijo: Decimal | None = None
    requiere_pago_total: bool
    combinable: bool
    prioridad: int
    activa: bool
    fecha_desde: datetime | None = None
    fecha_hasta: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PagoSimulacionInput(BaseModel):
    medio_pago: MedioPagoRegla

    monto_base: Decimal | None = Field(default=None, gt=0)
    monto: Decimal | None = Field(default=None, gt=0)

    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)
    nota: str | None = None

    @model_validator(mode="after")
    def validar_monto_base(self):
        if self.monto_base is None and self.monto is None:
            raise ValueError("Debe informar monto_base")
        return self

    @property
    def base(self) -> Decimal:
        return self.monto_base if self.monto_base is not None else self.monto


class SugerirSaldoConMedioPagoInput(BaseModel):
    medio_pago: MedioPagoRegla
    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)


class SimularReglasInput(BaseModel):
    subtotal_base: Decimal = Field(gt=0)
    medios_pago: list[PagoSimulacionInput] = Field(default_factory=list)
    sugerir_saldo_con_medio_pago: SugerirSaldoConMedioPagoInput | None = None


class ReglaAplicadaOutput(BaseModel):
    id_regla_comercial: int | None = None
    id_tarjeta_plan: int | None = None
    tipo: str
    descripcion: str
    medio_pago: str | None = None
    porcentaje_aplicado: Decimal | None = None
    monto_base_aplicado: Decimal | None = None
    monto_aplicado: Decimal


class TramoPagoOutput(BaseModel):
    medio_pago: str
    monto_base_aplicado: Decimal
    descuento_aplicado: Decimal
    recargo_aplicado: Decimal
    monto_total_cobrado: Decimal
    cuotas: int | None = None
    entidad: str | None = None
    id_tarjeta_plan: int | None = None
    porcentaje_recargo_aplicado: Decimal | None = None
    porcentaje_costo_financiero_aplicado: Decimal = Decimal("0")
    costo_financiero: Decimal = Decimal("0")
    monto_neto_liquidado: Decimal


class SimularReglasOutput(BaseModel):
    subtotal_base: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal
    total_base_asignada: Decimal
    total_pagos_cargados: Decimal
    saldo_base_estimado: Decimal
    saldo_estimado: Decimal
    monto_base_sugerido_para_saldar: Decimal | None = None
    monto_sugerido_para_saldar: Decimal | None = None
    reglas_aplicadas: list[ReglaAplicadaOutput]
    tramos_pago: list[TramoPagoOutput]


class ReglaComercialUpdateInput(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=120)
    tipo: TipoReglaComercial | None = None
    medio_pago: MedioPagoRegla | None = None
    porcentaje: Decimal | None = Field(default=None, ge=0)
    monto_fijo: Decimal | None = Field(default=None, ge=0)
    requiere_pago_total: bool | None = None
    combinable: bool | None = None
    prioridad: int | None = Field(default=None, ge=0)
    activa: bool | None = None


class ReglaComercialCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    tipo: TipoReglaComercial
    medio_pago: MedioPagoRegla | None = None
    porcentaje: Decimal | None = Field(default=None, ge=0)
    monto_fijo: Decimal | None = Field(default=None, ge=0)
    requiere_pago_total: bool = False
    combinable: bool = False
    prioridad: int = Field(default=100, ge=0)
    activa: bool = True

    @model_validator(mode="after")
    def validar_valor(self):
        valores = [self.porcentaje, self.monto_fijo]
        informados = [valor for valor in valores if valor is not None]

        if len(informados) != 1:
            raise ValueError("Debe informar porcentaje o monto fijo, pero no ambos")

        if informados[0] <= 0:
            raise ValueError("El valor de la regla debe ser mayor a cero")

        return self


class TarjetaPlanOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    medio_pago: str
    entidad: str | None = None
    cuotas: int
    porcentaje_recargo_cliente: Decimal
    porcentaje_costo_financiero: Decimal | None = None
    activa: bool
    fecha_desde: datetime | None = None
    fecha_hasta: datetime | None = None


class TarjetaPlanCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    medio_pago: MedioPagoRegla = "tarjeta"
    entidad: str | None = Field(default=None, max_length=80)
    cuotas: int = Field(gt=0)
    porcentaje_recargo_cliente: Decimal = Field(ge=0)
    porcentaje_costo_financiero: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        le=100,
    )
    activa: bool = True


class TarjetaPlanUpdateInput(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=120)
    entidad: str | None = Field(default=None, max_length=80)
    cuotas: int | None = Field(default=None, gt=0)
    porcentaje_recargo_cliente: Decimal | None = Field(default=None, ge=0)
    porcentaje_costo_financiero: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )
    activa: bool | None = None
