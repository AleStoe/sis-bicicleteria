from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


ESTADOS_PEDIDO_COMPRA = {"borrador", "enviado", "recibido_parcial", "cerrado"}


class PedidoCompraItemCreate(BaseModel):
    id_variante: int | None = Field(default=None, gt=0)
    producto_nombre: str = Field(min_length=1, max_length=300)
    nombre_variante: str | None = Field(default=None, max_length=300)
    sku: str | None = Field(default=None, max_length=100)
    codigo_proveedor: str | None = Field(default=None, max_length=100)
    stock_disponible_al_crear: Decimal = Field(default=Decimal("0"), ge=0)
    cantidad_sugerida: Decimal = Field(default=Decimal("0"), ge=0)
    cantidad_pedida: Decimal = Field(gt=0)
    observacion: str | None = None


class PedidoCompraCreate(BaseModel):
    id_proveedor: int | None = Field(default=None, gt=0)
    proveedor_nombre: str = Field(min_length=1, max_length=150)
    observaciones: str | None = None
    id_usuario: int | None = None
    items: list[PedidoCompraItemCreate] = Field(min_length=1)


class PedidoCompraEstadoUpdate(BaseModel):
    estado: str = Field(pattern="^(borrador|enviado|recibido_parcial|cerrado)$")
    observaciones: str | None = None
    id_usuario: int | None = None


class PedidoCompraRecepcionItem(BaseModel):
    id_item: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    cantidad_recibida: Decimal = Field(gt=0)
    costo_unitario: Decimal = Field(ge=0)
    gastos_adicionales: Decimal = Field(default=Decimal("0"), ge=0)
    observacion: str | None = None


class PedidoCompraRecepcionCreate(BaseModel):
    observaciones: str | None = None
    id_usuario: int | None = None
    items: list[PedidoCompraRecepcionItem] = Field(min_length=1)


class PedidoCompraItemOut(BaseModel):
    id: int
    id_pedido: int
    id_variante: int | None = None
    producto_nombre_snapshot: str
    variante_nombre_snapshot: str | None = None
    sku_snapshot: str | None = None
    codigo_proveedor_snapshot: str | None = None
    stock_disponible_al_crear: Decimal
    cantidad_sugerida: Decimal
    cantidad_pedida: Decimal
    cantidad_recibida: Decimal
    observacion: str | None = None
    created_at: datetime
    updated_at: datetime


class PedidoCompraHistorialOut(BaseModel):
    id: int
    id_pedido: int
    accion: str
    estado_anterior: str | None = None
    estado_nuevo: str | None = None
    detalle: str | None = None
    metadata: dict
    id_usuario: int | None = None
    fecha: datetime


class PedidoCompraOut(BaseModel):
    id: int
    id_proveedor: int | None = None
    proveedor_nombre_snapshot: str
    estado: str
    fecha_creacion: datetime
    fecha_envio: datetime | None = None
    fecha_cierre: datetime | None = None
    observaciones: str | None = None
    id_usuario_creador: int | None = None
    created_at: datetime
    updated_at: datetime
    total_items: int = 0
    cantidad_total_pedida: Decimal = Decimal("0")
    cantidad_total_recibida: Decimal = Decimal("0")
    items: list[PedidoCompraItemOut] = Field(default_factory=list)
    historial: list[PedidoCompraHistorialOut] = Field(default_factory=list)
