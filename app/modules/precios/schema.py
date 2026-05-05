from decimal import Decimal
from typing import Optional, Literal, List
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


TipoMovimientoPrecio = Literal[
    "actualizacion_manual",
    "actualizacion_por_ingreso_stock",
    "actualizacion_por_lista_proveedor",
    "correccion_error",
    "cambio_margen",
]


class VariantePrecioOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_producto: int
    producto_nombre: str
    nombre_variante: str
    sku: Optional[str] = None
    codigo_barras: Optional[str] = None
    codigo_proveedor: Optional[str] = None
    precio_minorista: Decimal
    precio_mayorista: Decimal
    costo_promedio_vigente: Decimal
    activo: bool


class PrecioActualizarInput(BaseModel):
    precio_minorista: Decimal = Field(ge=0)
    precio_mayorista: Decimal = Field(ge=0)
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)

    tipo_movimiento: TipoMovimientoPrecio = "actualizacion_manual"
    origen_tipo: Optional[str] = Field(default=None, max_length=40)
    origen_id: Optional[int] = Field(default=None, gt=0)


class PrecioMovimientoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    precio_minorista_anterior: Optional[Decimal] = None
    precio_minorista_nuevo: Optional[Decimal] = None
    precio_mayorista_anterior: Optional[Decimal] = None
    precio_mayorista_nuevo: Optional[Decimal] = None
    costo_anterior: Optional[Decimal] = None
    costo_nuevo: Optional[Decimal] = None
    tipo_movimiento: str
    motivo: Optional[str] = None
    origen_tipo: Optional[str] = None
    origen_id: Optional[int] = None
    id_usuario: int
    created_at: datetime


class PrecioActualizarOutput(BaseModel):
    ok: bool
    id_variante: int
    movimiento_id: int
    precio_minorista_anterior: Decimal
    precio_minorista_nuevo: Decimal
    precio_mayorista_anterior: Decimal
    precio_mayorista_nuevo: Decimal


class PrecioHistorialOutput(BaseModel):
    variante: VariantePrecioOutput
    movimientos: List[PrecioMovimientoOutput]


TipoClientePrecio = Literal["minorista", "mayorista"]


class ReglaPrecioCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=100)
    id_categoria: Optional[int] = Field(default=None, gt=0)
    id_marca: Optional[int] = Field(default=None, gt=0)
    tipo_cliente: TipoClientePrecio
    margen_porcentaje: Decimal = Field(ge=0)
    redondeo_base: Decimal = Field(default=Decimal("100"), gt=0)


class ReglaPrecioOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    id_categoria: Optional[int] = None
    categoria_nombre: Optional[str] = None
    id_marca: Optional[int] = None
    marca_nombre: Optional[str] = None
    tipo_cliente: str
    margen_porcentaje: Decimal
    redondeo_base: Decimal
    activa: bool
    created_at: datetime
    updated_at: datetime


class ReglaPrecioEstadoInput(BaseModel):
    id_usuario: int = Field(gt=0)


class PrecioSugeridoInput(BaseModel):
    tipo_cliente: TipoClientePrecio


class PrecioSugeridoOutput(BaseModel):
    id_variante: int
    tipo_cliente: str
    costo_base: Decimal
    precio_actual: Decimal
    precio_sugerido: Decimal
    margen_porcentaje: Decimal
    redondeo_base: Decimal
    regla_id: Optional[int] = None
    regla_nombre: Optional[str] = None

class PrecioDesfasadoOutput(BaseModel):
    id_variante: int
    producto_nombre: str
    nombre_variante: str
    tipo_cliente: str
    costo_base: Decimal
    precio_actual: Decimal
    precio_sugerido: Decimal
    diferencia: Decimal
    margen_real: Decimal
    margen_esperado: Decimal
    regla_id: int
    regla_nombre: str


class PreciosDesfasadosResponse(BaseModel):
    total: int
    items: List[PrecioDesfasadoOutput]