from pydantic import BaseModel


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
    nombre_variante: str
    sku: str | None = None
    codigo_barras: str | None = None
    proveedor_preferido_id: int | None = None
    proveedor_preferido_nombre: str | None = None
    alicuota_iva: float
    gravado: bool
    precio_minorista: float
    precio_mayorista: float
    permite_precio_libre: bool
    costo_promedio_vigente: float
    activo: bool