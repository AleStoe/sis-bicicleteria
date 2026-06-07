from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class StockSucursalOut(BaseModel):
    sucursal_id: int
    sucursal_nombre: str
    variante_id: int
    producto_id: int | None = None
    producto_nombre: str
    nombre_variante: str
    sku: str | None = None
    stock_fisico: Decimal
    stock_reservado: Decimal
    stock_vendido_pendiente_entrega: Decimal
    stock_disponible: Decimal
    codigo_barras: str | None = None
    codigo_proveedor: str | None = None

    id_categoria: int | None = None
    categoria_nombre: str | None = None
    id_marca: int | None = None
    marca_nombre: str | None = None
    id_proveedor: int | None = None
    proveedor_nombre: str | None = None
    producto_tipo_item: str | None = None
    serializable: bool | None = None
    tipo_operativo: str | None = None

    costo_promedio_vigente: Decimal = Decimal("0")
    capital_inmovilizado: Decimal = Decimal("0")
    ultima_venta: datetime | None = None
    dias_sin_movimiento: int | None = None


class StockResumenOut(BaseModel):
    total_items: int
    con_stock: int
    sin_stock: int
    stock_bajo: int
    reservado: int
    pendiente_entrega: int
    inconsistentes: int
    stock_fisico_total: Decimal
    stock_disponible_total: Decimal
    capital_inmovilizado_total: Decimal


class IngresoStockCreate(BaseModel):
    id_sucursal: int
    id_variante: int
    id_proveedor: int
    cantidad_ingresada: Decimal = Field(gt=0)
    costo_productos: Decimal = Field(ge=0)
    gastos_adicionales: Decimal = Field(ge=0, default=0)
    origen_ingreso: str = "manual"
    observacion: str | None = None
    id_usuario: int


class IngresoStockResponse(BaseModel):
    ok: bool
    ingreso_id: int
    id_sucursal: int
    id_variante: int
    cantidad_ingresada: Decimal
    costo_total_lote: Decimal
    costo_unitario_calculado: Decimal
    stock_anterior: Decimal
    stock_nuevo: Decimal
    costo_promedio_anterior: Decimal
    costo_promedio_nuevo: Decimal


class AjusteStockCreate(BaseModel):
    id_sucursal: int
    id_variante: int
    cantidad: Decimal
    nota: str
    id_usuario: int
    origen_tipo: str = "ajuste_manual"
    origen_id: int | None = None


class AjusteStockResponse(BaseModel):
    ok: bool
    movimiento_id: int
    id_sucursal: int
    id_variante: int
    tipo_movimiento: str
    cantidad: Decimal
    stock_fisico_anterior: Decimal
    stock_reservado_anterior: Decimal
    stock_vendido_pendiente_entrega_anterior: Decimal
    stock_fisico_nuevo: Decimal
    stock_reservado_nuevo: Decimal
    stock_vendido_pendiente_entrega_nuevo: Decimal
    stock_disponible_nuevo: Decimal
