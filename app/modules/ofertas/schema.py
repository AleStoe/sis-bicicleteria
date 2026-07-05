from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OfertaCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    nombre: str = Field(min_length=3, max_length=120)
    precio_oferta: Decimal = Field(gt=0)
    fecha_desde: date
    fecha_hasta: date
    motivo: str | None = Field(default=None, max_length=500)
    id_usuario: int = Field(gt=0)

    @model_validator(mode="after")
    def validar_vigencia(self):
        if self.fecha_hasta < self.fecha_desde:
            raise ValueError("La fecha hasta no puede ser anterior a la fecha desde")
        return self


class OfertaUpdateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    precio_oferta: Decimal = Field(gt=0)
    fecha_desde: date
    fecha_hasta: date
    motivo: str | None = Field(default=None, max_length=500)
    id_usuario: int = Field(gt=0)

    @model_validator(mode="after")
    def validar_vigencia(self):
        if self.fecha_hasta < self.fecha_desde:
            raise ValueError("La fecha hasta no puede ser anterior a la fecha desde")
        return self


class OfertaEstadoInput(BaseModel):
    activa: bool
    id_usuario: int = Field(gt=0)


class OfertaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    id_producto: int
    producto_nombre: str
    nombre_variante: str
    sku: str | None = None
    nombre: str
    precio_regular_referencia: Decimal
    precio_oferta: Decimal
    ahorro_unitario: Decimal
    porcentaje_descuento: Decimal
    fecha_desde: date
    fecha_hasta: date
    motivo: str | None = None
    activa: bool
    vigente: bool
    id_usuario_creador: int
    id_usuario_actualizador: int | None = None
    created_at: datetime
    updated_at: datetime
