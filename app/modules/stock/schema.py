from pydantic import BaseModel, Field


class StockSucursalOut(BaseModel):
    sucursal_id: int
    sucursal_nombre: str
    variante_id: int
    producto_nombre: str
    nombre_variante: str
    sku: str | None = None
    stock_fisico: float
    stock_reservado: float
    stock_vendido_pendiente_entrega: float
    stock_disponible: float


class IngresoStockCreate(BaseModel):
    id_sucursal: int
    id_variante: int
    id_proveedor: int
    cantidad_ingresada: float = Field(gt=0)
    costo_productos: float = Field(ge=0)
    gastos_adicionales: float = Field(ge=0, default=0)
    origen_ingreso: str = "manual"
    observacion: str | None = None
    id_usuario: int


class IngresoStockResponse(BaseModel):
    ok: bool
    ingreso_id: int
    id_sucursal: int
    id_variante: int
    cantidad_ingresada: float
    costo_total_lote: float
    costo_unitario_calculado: float
    stock_anterior: float
    stock_nuevo: float
    costo_promedio_anterior: float
    costo_promedio_nuevo: float