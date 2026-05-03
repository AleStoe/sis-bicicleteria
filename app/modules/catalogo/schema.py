from pydantic import BaseModel
from decimal import Decimal


class CategoriaOut(BaseModel):
    id: int
    nombre: str


class ProductoOut(BaseModel):
    id: int
    nombre: str
    tipo_item: str
    stockeable: bool
    serializable: bool
    activo: bool
    categoria_id: int
    categoria_nombre: str


class VarianteOut(BaseModel):
    id: int
    id_producto: int
    producto_nombre: str
    tipo_item: str
    stockeable: bool
    serializable: bool
    categoria_id: int
    categoria_nombre: str
    nombre_variante: str
    sku: str | None = None
    codigo_barras: str | None = None
    proveedor_preferido_id: int | None = None
    proveedor_preferido_nombre: str | None = None

    # 🔴 CAMBIO CLAVE
    alicuota_iva: Decimal
    gravado: bool
    precio_minorista: Decimal
    precio_mayorista: Decimal
    permite_precio_libre: bool
    costo_promedio_vigente: Decimal

    activo: bool
    imagen_principal: str | None = None


class CatalogoImagenCreate(BaseModel):
    id_producto: int | None = None
    id_variante: int | None = None
    url: str
    es_principal: bool = False
    orden: int = 0


class CatalogoImagenUpdate(BaseModel):
    url: str | None = None
    es_principal: bool | None = None
    orden: int | None = None
    activo: bool | None = None


class CatalogoImagenOut(BaseModel):
    id: int
    id_producto: int | None = None
    id_variante: int | None = None
    url: str
    es_principal: bool
    orden: int
    activo: bool


class CatalogoPOSItemOut(BaseModel):
    id_variante: int
    id_producto: int
    producto_nombre: str
    nombre_variante: str
    categoria_id: int
    categoria_nombre: str
    tipo_item: str
    stockeable: bool
    serializable: bool
    precio_minorista: Decimal
    precio_mayorista: Decimal

    permite_precio_libre: bool
    sku: str | None = None
    codigo_barras: str | None = None
    imagen_principal: str | None = None
    activo: bool

    
    stock_fisico: Decimal = Decimal("0")
    stock_reservado: Decimal = Decimal("0")
    stock_vendido_pendiente_entrega: Decimal = Decimal("0")
    stock_disponible: Decimal = Decimal("0")

    disponible_para_venta: bool
    motivo_no_disponible: str | None = None