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