from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


ESTADOS_PEDIDO_CLIENTE = {"borrador", "convertido_a_venta", "cancelado"}


class PedidoClienteCreate(BaseModel):
    id_cliente: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    tipo_precio: str = Field(default="minorista", pattern="^(minorista|mayorista)$")
    observaciones: str | None = None
    id_usuario: int | None = None


class PedidoClienteItemCreate(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0)
    id_usuario: int | None = None


class PedidoClienteItemUpdate(BaseModel):
    cantidad: Decimal = Field(gt=0)
    id_usuario: int | None = None


class PedidoClienteCancelar(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)
    id_usuario: int | None = None


class PedidoClienteConvertir(BaseModel):
    id_venta: int = Field(gt=0)
    id_usuario: int | None = None


class PedidoClienteHistorialOut(BaseModel):
    id: int
    id_pedido: int
    accion: str
    estado_anterior: str | None = None
    estado_nuevo: str | None = None
    detalle: str | None = None
    metadata: dict
    id_usuario: int | None = None
    fecha: datetime


class PedidoClienteItemOut(BaseModel):
    id: int
    id_pedido: int
    id_variante: int
    id_producto: int | None = None
    producto_nombre: str
    nombre_variante: str | None = None
    categoria_nombre: str | None = None
    tipo_item: str | None = None
    stockeable: bool = True
    serializable: bool = False
    precio_minorista: Decimal = Decimal("0")
    precio_mayorista: Decimal = Decimal("0")
    permite_precio_libre: bool = False
    sku: str | None = None
    codigo_barras: str | None = None
    codigo_proveedor: str | None = None
    imagen_principal: str | None = None
    stock_fisico: Decimal = Decimal("0")
    stock_reservado: Decimal = Decimal("0")
    stock_vendido_pendiente_entrega: Decimal = Decimal("0")
    stock_disponible: Decimal = Decimal("0")
    serializadas_disponibles: int = 0
    disponible_para_venta: bool = True
    motivo_no_disponible: str | None = None
    en_oferta: bool = False
    oferta_id: int | None = None
    oferta_nombre: str | None = None
    precio_oferta: Decimal | None = None
    oferta_fecha_desde: object | None = None
    oferta_fecha_hasta: object | None = None
    cantidad: Decimal
    created_at: datetime
    updated_at: datetime


class PedidoClienteOut(BaseModel):
    id: int
    id_cliente: int
    cliente_nombre: str
    cliente_dni: str | None = None
    cliente_telefono: str | None = None
    id_sucursal: int
    sucursal_nombre: str
    tipo_precio: str
    estado: str
    fecha_creacion: datetime
    fecha_conversion: datetime | None = None
    fecha_cancelacion: datetime | None = None
    id_venta_generada: int | None = None
    observaciones: str | None = None
    id_usuario_creador: int | None = None
    created_at: datetime
    updated_at: datetime
    total_items: int = 0
    cantidad_total: Decimal = Decimal("0")
    total_estimado: Decimal = Decimal("0")
    items: list[PedidoClienteItemOut] = Field(default_factory=list)
    historial: list[PedidoClienteHistorialOut] = Field(default_factory=list)
