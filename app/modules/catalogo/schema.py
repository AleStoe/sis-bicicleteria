from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
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
    id_marca: int | None = None
    marca_nombre: str | None = None
    rodado: str | None = None
    tipo_bicicleta: str | None = None
    material_cuadro: str | None = None


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
    talle: str | None = None
    color: str | None = None


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
    id_marca: int | None = None
    marca_nombre: str | None = None

    
    stock_fisico: Decimal = Decimal("0")
    stock_reservado: Decimal = Decimal("0")
    stock_vendido_pendiente_entrega: Decimal = Decimal("0")
    stock_disponible: Decimal = Decimal("0")

    disponible_para_venta: bool
    motivo_no_disponible: str | None = None

    proveedor_preferido_id: int | None = None
    proveedor_preferido_nombre: str | None = None
    talle: str | None = None
    color: str | None = None

TipoItemCatalogo = Literal["producto", "servicio"]

class CatalogoPOSPaginatedOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[CatalogoPOSItemOut]
    
class ProductoCreate(BaseModel):
    id_categoria: int = Field(gt=0)
    id_marca: int | None = Field(default=None, gt=0)
    nombre: str = Field(min_length=2, max_length=150)
    tipo_item: TipoItemCatalogo = "producto"
    stockeable: bool = True
    serializable: bool = False
    rodado: str | None = Field(default=None, max_length=30)
    tipo_bicicleta: str | None = Field(default=None, max_length=80)
    material_cuadro: str | None = Field(default=None, max_length=80)


class ProductoCreateOut(BaseModel):
    id: int
    id_categoria: int
    id_marca: int | None = None
    nombre: str
    tipo_item: str
    stockeable: bool
    serializable: bool
    activo: bool
    rodado: str | None = None
    tipo_bicicleta: str | None = None
    material_cuadro: str | None = None


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
    talle: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=120)


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
    talle: str | None = None
    color: str | None = None




class MarcaOut(BaseModel):
    id: int
    nombre: str
    activa: bool
    created_at: datetime


class MarcaCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)

class ProductoUpdate(BaseModel):
    id_categoria: int | None = Field(default=None, gt=0)
    id_marca: int | None = Field(default=None, gt=0)
    nombre: str | None = Field(default=None, min_length=2, max_length=150)
    tipo_item: TipoItemCatalogo | None = None
    stockeable: bool | None = None
    serializable: bool | None = None
    rodado: str | None = Field(default=None, max_length=30)
    tipo_bicicleta: str | None = Field(default=None, max_length=80)
    material_cuadro: str | None = Field(default=None, max_length=80)


class ProductoEstadoUpdate(BaseModel):
    activo: bool
    id_usuario: int = Field(gt=0)


class VarianteUpdate(BaseModel):
    nombre_variante: str | None = Field(default=None, min_length=1, max_length=150)
    sku: str | None = Field(default=None, max_length=100)
    codigo_barras: str | None = Field(default=None, max_length=100)
    codigo_proveedor: str | None = Field(default=None, max_length=100)
    proveedor_preferido_id: int | None = Field(default=None, gt=0)
    alicuota_iva: Decimal | None = None
    gravado: bool | None = None
    permite_precio_libre: bool | None = None
    talle: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=120)


class VarianteEstadoUpdate(BaseModel):
    activo: bool
    id_usuario: int = Field(gt=0)

class ProductoFichaTecnicaItemInput(BaseModel):
    grupo: str = Field(min_length=1, max_length=80)
    clave: str = Field(min_length=1, max_length=120)
    valor: str = Field(min_length=1, max_length=1000)
    orden: int = 0


class ProductoFichaTecnicaItemOut(BaseModel):
    id: int
    id_producto: int
    grupo: str
    clave: str
    valor: str
    orden: int
    activo: bool


class ProductoFichaTecnicaReplaceInput(BaseModel):
    items: list[ProductoFichaTecnicaItemInput]