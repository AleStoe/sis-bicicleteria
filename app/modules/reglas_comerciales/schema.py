from decimal import Decimal
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


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
    monto: Decimal = Field(gt=0)

    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)

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
    tipo: str
    descripcion: str
    medio_pago: str | None = None
    porcentaje_aplicado: Decimal | None = None
    monto_aplicado: Decimal
    id_tarjeta_plan: int | None = None


class SimularReglasOutput(BaseModel):
    subtotal_base: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal
    total_pagos_cargados: Decimal
    saldo_estimado: Decimal
    monto_sugerido_para_saldar: Decimal | None = None
    reglas_aplicadas: list[ReglaAplicadaOutput]

class SugerirSaldoConMedioPagoInput(BaseModel):
    medio_pago: MedioPagoRegla
    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)

class ReglaComercialUpdateInput(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=120)
    porcentaje: Decimal | None = Field(default=None, ge=0)
    monto_fijo: Decimal | None = Field(default=None, ge=0)
    requiere_pago_total: bool | None = None
    combinable: bool | None = None
    prioridad: int | None = Field(default=None, ge=0)
    activa: bool | None = None


class TarjetaPlanOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    medio_pago: str
    entidad: str | None = None
    cuotas: int
    porcentaje_recargo_cliente: Decimal
    porcentaje_costo_financiero: Decimal
    activa: bool
    fecha_desde: datetime | None = None
    fecha_hasta: datetime | None = None


class TarjetaPlanCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    medio_pago: MedioPagoRegla = "tarjeta"
    entidad: str | None = Field(default=None, max_length=80)
    cuotas: int = Field(gt=0)
    porcentaje_recargo_cliente: Decimal = Field(ge=0)
    porcentaje_costo_financiero: Decimal = Field(default=Decimal("0"), ge=0)
    activa: bool = True


class TarjetaPlanUpdateInput(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=120)
    entidad: str | None = Field(default=None, max_length=80)
    cuotas: int | None = Field(default=None, gt=0)
    porcentaje_recargo_cliente: Decimal | None = Field(default=None, ge=0)
    porcentaje_costo_financiero: Decimal | None = Field(default=None, ge=0)
    activa: bool | None = None