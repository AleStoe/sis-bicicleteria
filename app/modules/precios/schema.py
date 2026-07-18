from decimal import Decimal
from typing import Optional, Literal, List
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict, model_validator


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
    costo_promedio_vigente: Optional[Decimal] = None
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


TipoClientePrecio = Literal["minorista", "mayorista"]
AplicarSobrePrecio = Literal["minorista", "mayorista", "ambos"]
TipoAjusteProveedor = Literal["porcentaje", "monto_fijo"]


class ReglaPrecioCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=100)
    id_categoria: Optional[int] = Field(default=None, gt=0)
    id_marca: Optional[int] = Field(default=None, gt=0)
    tipo_cliente: TipoClientePrecio
    margen_porcentaje: Decimal = Field(ge=0)
    redondeo_base: Decimal = Field(default=Decimal("100"), gt=0)
    descuento_base_porcentaje: Decimal = Field(default=Decimal("0"), ge=0, lt=100)
    margen_minimo_porcentaje: Decimal = Field(default=Decimal("0"), ge=0)
    id_familia_precio: Optional[int] = Field(default=None, gt=0)
    id_proveedor: Optional[int] = Field(default=None, gt=0)

class ReglaPrecioOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    id_categoria: Optional[int] = None
    categoria_nombre: Optional[str] = None
    id_marca: Optional[int] = None
    marca_nombre: Optional[str] = None
    descuento_base_porcentaje: Decimal
    margen_minimo_porcentaje: Decimal
    tipo_cliente: str
    margen_porcentaje: Decimal
    redondeo_base: Decimal
    activa: bool
    created_at: datetime
    updated_at: datetime
    id_familia_precio: Optional[int] = None
    familia_precio_nombre: Optional[str] = None

    id_proveedor: Optional[int] = None
    proveedor_nombre: Optional[str] = None


class ReglaPrecioEstadoInput(BaseModel):
    id_usuario: int = Field(gt=0)


class PrecioSugeridoInput(BaseModel):
    tipo_cliente: TipoClientePrecio


class PrecioSugeridoOutput(BaseModel):
    id_variante: int
    tipo_cliente: str
    costo_base: Decimal
    precio_actual: Decimal
    precio_sugerido: Decimal
    margen_porcentaje: Decimal
    redondeo_base: Decimal
    regla_id: Optional[int] = None
    regla_nombre: Optional[str] = None
    precio_objetivo: Decimal
    precio_lista: Decimal
    precio_final_estimado: Decimal
    precio_minimo: Decimal
    descuento_base_porcentaje: Decimal
    margen_minimo_porcentaje: Decimal

class PrecioDesfasadoOutput(BaseModel):
    id_variante: int
    producto_nombre: str
    nombre_variante: str
    tipo_cliente: str
    costo_base: Decimal
    precio_actual: Decimal
    precio_sugerido: Decimal
    diferencia: Decimal
    margen_real: Decimal
    margen_esperado: Decimal
    regla_id: int
    regla_nombre: str


class PreciosDesfasadosResponse(BaseModel):
    total: int
    items: List[PrecioDesfasadoOutput]

class RecalculoProveedorInput(BaseModel):
    id_proveedor: int = Field(gt=0)
    tipo_cliente: TipoClientePrecio
    aplicar: bool = False
    id_usuario: Optional[int] = Field(default=None, gt=0)
    motivo: Optional[str] = Field(default=None, max_length=500)


class RecalculoProveedorItemOutput(BaseModel):
    id_variante: int
    producto_nombre: str
    nombre_variante: str
    tipo_cliente: str
    costo_base: Decimal
    precio_actual: Decimal
    precio_sugerido: Decimal
    diferencia: Decimal
    margen_real: Decimal
    margen_esperado: Decimal
    regla_id: int
    regla_nombre: str
    aplicado: bool
    movimiento_id: Optional[int] = None


class RecalculoProveedorOutput(BaseModel):
    ok: bool
    aplicado: bool
    id_proveedor: int
    tipo_cliente: str
    total_detectados: int
    total_aplicados: int
    items: List[RecalculoProveedorItemOutput]


class AjusteProveedorInput(BaseModel):
    id_proveedor: int = Field(gt=0)
    aplicar_sobre: AplicarSobrePrecio = "ambos"
    tipo_ajuste: TipoAjusteProveedor = "porcentaje"
    valor: Decimal = Field(gt=0)
    aplicar: bool = False
    id_usuario: Optional[int] = Field(default=None, gt=0)
    motivo: Optional[str] = Field(default=None, max_length=500)
    solo_productos_activos: bool = True
    solo_variantes_activas: bool = True
    solo_con_stock: bool = False


class AjusteProveedorItemOutput(BaseModel):
    id_variante: int
    id_producto: int
    producto_nombre: str
    nombre_variante: str
    sku: Optional[str] = None
    codigo_proveedor: Optional[str] = None
    precio_minorista_actual: Decimal
    precio_mayorista_actual: Decimal
    precio_minorista_nuevo: Decimal
    precio_mayorista_nuevo: Decimal
    diferencia_minorista: Decimal
    diferencia_mayorista: Decimal
    aplicado: bool
    movimiento_id: Optional[int] = None


class CorreccionCargaInicialInput(BaseModel):
    costo_promedio_vigente: Decimal = Field(ge=0)
    precio_minorista: Decimal = Field(ge=0)
    precio_mayorista: Decimal = Field(ge=0)
    alicuota_iva: Decimal = Field(ge=0)
    gravado: bool = True
    proveedor_preferido_id: Optional[int] = Field(default=None, gt=0)
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)

    @model_validator(mode="after")
    def validar_iva(self):
        permitidas = {
            Decimal("0"),
            Decimal("10.50"),
            Decimal("21.00"),
            Decimal("27.00"),
        }
        if self.alicuota_iva not in permitidas:
            raise ValueError("La alícuota de IVA debe ser 0, 10.5, 21 o 27")
        return self


class CorreccionCargaInicialOutput(BaseModel):
    ok: bool
    id_variante: int
    movimiento_precio_id: Optional[int] = None
    ventas_historicas: int
    advertencia: Optional[str] = None
    valores_anteriores: dict
    valores_nuevos: dict
    margen_minorista_anterior: Decimal
    margen_minorista_nuevo: Decimal


class AjusteProveedorOutput(BaseModel):
    ok: bool
    aplicado: bool
    id_proveedor: int
    aplicar_sobre: str
    tipo_ajuste: str
    valor: Decimal
    total_detectados: int
    total_aplicados: int
    items: List[AjusteProveedorItemOutput]

class FamiliaPrecioOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    activa: bool
