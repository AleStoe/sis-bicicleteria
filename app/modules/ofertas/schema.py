from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OfertaUnidadOutput(BaseModel):
    id: int
    numero_cuadro: str
    estado: str
    estado_tecnico: str
    condicion_comercial: str
    costo_total_unitario: Decimal = Decimal("0")
    ganancia_estimada: Decimal = Decimal("0")
    margen_estimado: Decimal | None = None


class OfertaCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    alcance: str = Field(default="variante", pattern="^(variante|unidades)$")
    ids_bicicletas_serializadas: list[int] = Field(default_factory=list)
    politica_contado: str = Field(
        default="precio_lista_promocional",
        pattern="^precio_lista_promocional$",
    )
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
        if self.alcance == "unidades" and not self.ids_bicicletas_serializadas:
            raise ValueError("Seleccioná al menos un número de cuadro")
        if self.alcance == "variante" and self.ids_bicicletas_serializadas:
            raise ValueError("Una oferta general no debe incluir números de cuadro")
        return self


class OfertaUpdateInput(BaseModel):
    alcance: str = Field(default="variante", pattern="^(variante|unidades)$")
    ids_bicicletas_serializadas: list[int] = Field(default_factory=list)
    politica_contado: str = Field(
        default="precio_lista_promocional",
        pattern="^precio_lista_promocional$",
    )
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
        if self.alcance == "unidades" and not self.ids_bicicletas_serializadas:
            raise ValueError("Seleccioná al menos un número de cuadro")
        if self.alcance == "variante" and self.ids_bicicletas_serializadas:
            raise ValueError("Una oferta general no debe incluir números de cuadro")
        return self


class OfertaEstadoInput(BaseModel):
    activa: bool
    id_usuario: int = Field(gt=0)


class OfertaCierreVencidasInput(BaseModel):
    id_usuario: int = Field(gt=0)


class OfertaCierreVencidasOutput(BaseModel):
    ok: bool = True
    cantidad: int
    ids_ofertas: list[int] = Field(default_factory=list)


class OfertaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    id_producto: int
    producto_nombre: str
    nombre_variante: str
    sku: str | None = None
    nombre: str
    alcance: str = "variante"
    politica_contado: str = "precio_lista_promocional"
    unidades: list[OfertaUnidadOutput] = Field(default_factory=list)
    precio_regular_referencia: Decimal
    precio_oferta: Decimal
    ahorro_unitario: Decimal
    porcentaje_descuento: Decimal
    fecha_desde: date
    fecha_hasta: date
    motivo: str | None = None
    activa: bool
    vigente: bool
    estado_calculado: str = "inactiva"
    id_usuario_creador: int
    id_usuario_actualizador: int | None = None
    created_at: datetime
    updated_at: datetime
