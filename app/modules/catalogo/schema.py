from pydantic import BaseModel
from decimal import Decimal

from pydantic import Field
from typing import Literal

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
    codigo_proveedor: str | None = None
    proveedor_preferido_id: int | None = None
    proveedor_preferido_nombre: str | None = None
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
    codigo_proveedor: str | None = None
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



TipoItemCatalogo = Literal["producto", "servicio"]


class ProductoCreate(BaseModel):
    id_categoria: int = Field(gt=0)
    id_marca: int | None = Field(default=None, gt=0)
    nombre: str = Field(min_length=2, max_length=150)
    tipo_item: TipoItemCatalogo = "producto"
    stockeable: bool = True
    serializable: bool = False


class ProductoCreateOut(BaseModel):
    id: int
    id_categoria: int
    id_marca: int | None = None
    nombre: str
    tipo_item: str
    stockeable: bool
    serializable: bool
    activo: bool


class VarianteCreate(BaseModel):
    id_producto: int = Field(gt=0)
    nombre_variante: str = Field(min_length=1, max_length=150)
    sku: str | None = Field(default=None, max_length=100)
    codigo_barras: str | None = Field(default=None, max_length=100)
    codigo_proveedor: str | None = Field(default=None, max_length=100)
    proveedor_preferido_id: int | None = Field(default=None, gt=0)

    alicuota_iva: Decimal = Decimal("21.00")
    gravado: bool = True

    precio_minorista: Decimal = Field(default=Decimal("0"), ge=0)
    precio_mayorista: Decimal = Field(default=Decimal("0"), ge=0)
    permite_precio_libre: bool = False


class VarianteCreateOut(BaseModel):
    id: int
    id_producto: int
    nombre_variante: str
    sku: str | None = None
    codigo_barras: str | None = None
    codigo_proveedor: str | None = None
    proveedor_preferido_id: int | None = None
    alicuota_iva: Decimal
    gravado: bool
    precio_minorista: Decimal
    precio_mayorista: Decimal
    permite_precio_libre: bool
    costo_promedio_vigente: Decimal
    activo: bool

from datetime import datetime


class MarcaOut(BaseModel):
    id: int
    nombre: str
    activa: bool
    created_at: datetime


class MarcaCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)