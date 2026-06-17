from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class InventarioFisicoCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_usuario: int = Field(gt=0)
    descripcion: str | None = Field(default=None, max_length=200)
    id_categoria: int | None = Field(default=None, gt=0)
    tipo_operativo: Literal["bicicleta", "repuesto", "accesorio", "producto", "no_bicicletas"] | None = None


class InventarioFisicoConteoInput(BaseModel):
    id_variante: int = Field(gt=0)
    stock_contado: Decimal = Field(ge=0)
    id_usuario: int = Field(gt=0)
    nota: str | None = None


class InventarioFisicoCerrarInput(BaseModel):
    id_usuario: int = Field(gt=0)


class InventarioFisicoCancelarInput(BaseModel):
    id_usuario: int = Field(gt=0)


class InventarioFisicoItemOut(BaseModel):
    id: int
    id_inventario: int
    id_variante: int
    producto_nombre: str | None = None
    categoria_nombre: str | None = None
    tipo_operativo: str | None = None
    nombre_variante: str | None = None
    sku: str | None = None
    codigo_proveedor: str | None = None
    stock_sistema: Decimal
    stock_contado: Decimal | None = None
    diferencia: Decimal
    nota: str | None = None
    contado_at: datetime | None = None
    movimiento_stock_id: int | None = None
    valor_diferencia: Decimal = Decimal("0")


class InventarioFisicoOut(BaseModel):
    id: int
    id_sucursal: int
    sucursal_nombre: str | None = None
    estado: Literal["abierto", "cerrado", "cancelado"]
    descripcion: str | None = None
    id_usuario_creador: int
    id_usuario_cierre: int | None = None
    fecha_inicio: datetime
    fecha_cierre: datetime | None = None
    total_items: int = 0
    items_contados: int = 0
    items_con_diferencia: int = 0


class InventarioFisicoDetalleOut(InventarioFisicoOut):
    items: list[InventarioFisicoItemOut] = Field(default_factory=list)


class InventarioFisicoDiferenciaOut(BaseModel):
    inventario_id: int
    fecha_cierre: datetime | None = None
    id_sucursal: int
    sucursal_nombre: str | None = None
    descripcion: str | None = None
    id_variante: int
    producto_nombre: str | None = None
    categoria_nombre: str | None = None
    tipo_operativo: str | None = None
    nombre_variante: str | None = None
    sku: str | None = None
    codigo_proveedor: str | None = None
    stock_sistema: Decimal
    stock_contado: Decimal
    diferencia: Decimal
    valor_diferencia: Decimal
    movimiento_stock_id: int | None = None
