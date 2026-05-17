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


class SimularReglasInput(BaseModel):
    subtotal_base: Decimal = Field(gt=0)
    medios_pago: list[PagoSimulacionInput] = Field(default_factory=list)


class ReglaAplicadaOutput(BaseModel):
    id_regla_comercial: int | None = None
    tipo: str
    descripcion: str
    medio_pago: str | None = None
    porcentaje_aplicado: Decimal | None = None
    monto_aplicado: Decimal


class SimularReglasOutput(BaseModel):
    subtotal_base: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal
    total_pagos_cargados: Decimal
    saldo_estimado: Decimal
    reglas_aplicadas: list[ReglaAplicadaOutput]