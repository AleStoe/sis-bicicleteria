from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class VentaItemCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0)


class VentaCreateInput(BaseModel):
    id_cliente: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    id_usuario: int = Field(gt=0)
    items: List[VentaItemCreateInput]


class VentaEntregaInput(BaseModel):
    id_usuario: int = Field(gt=0)


class VentaAnulacionInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class VentaCreateOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str


class VentaEstadoOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str


class VentaAnulacionOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str
    anulacion_id: int


class VentaResumenOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_cliente: int
    cliente_nombre: str
    id_sucursal: int
    sucursal_nombre: str
    estado: str
    total_final: Decimal
    saldo_pendiente: Decimal


class VentaDetalleCabeceraOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_cliente: int
    cliente_nombre: str
    id_sucursal: int
    sucursal_nombre: str
    estado: str
    subtotal_base: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal
    saldo_pendiente: Decimal


class VentaDetalleItemOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_venta: int
    id_variante: int
    id_bicicleta_serializada: Optional[int] = None
    descripcion_snapshot: str
    cantidad: Decimal
    precio_lista: Decimal
    precio_final: Decimal
    costo_unitario_aplicado: Decimal
    subtotal: Decimal


class VentaDetalleOutput(BaseModel):
    venta: VentaDetalleCabeceraOutput
    items: List[VentaDetalleItemOutput]