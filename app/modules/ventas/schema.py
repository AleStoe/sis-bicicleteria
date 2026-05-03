from decimal import Decimal
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


MedioPagoVenta = Literal["efectivo", "transferencia", "mercadopago", "tarjeta"]


class VentaItemCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: Decimal
    id_bicicleta_serializada: Optional[int] = Field(default=None, gt=0)


class VentaPagoCreateInput(BaseModel):
    medio_pago: MedioPagoVenta
    monto: Decimal = Field(gt=0)
    nota: Optional[str] = None


class VentaCreateInput(BaseModel):
    id_cliente: int
    id_sucursal: int
    id_usuario: int
    items: List[VentaItemCreateInput]
    pagos: List[VentaPagoCreateInput] = Field(default_factory=list)
    observaciones: Optional[str] = None
    usar_credito: bool = True
    monto_credito_a_aplicar: Optional[Decimal] = None


class VentaEntregaInput(BaseModel):
    id_usuario: int = Field(gt=0)


class VentaAnulacionInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class VentaCreateOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str
    credito_aplicado: Decimal
    saldo_pendiente: Decimal


class VentaEstadoOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str


class VentaAnulacionOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str
    anulacion_id: int
    credito_generado: bool
    monto_credito: Decimal


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

class VentaDeudaAbiertaResumenOutput(BaseModel):
    id: int
    saldo_actual: Decimal
    estado: str
    origen_tipo: str
    origen_id: int


class VentaSituacionFinancieraOutput(BaseModel):
    tiene_deuda: bool
    deuda_abierta: Optional[VentaDeudaAbiertaResumenOutput] = None

class VentaDetalleOutput(BaseModel):
    venta: VentaDetalleCabeceraOutput
    items: List[VentaDetalleItemOutput]
    situacion_financiera: VentaSituacionFinancieraOutput

class VentaDevolucionSerializadaInput(BaseModel):
    id_bicicleta_serializada: int = Field(gt=0)
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class VentaDevolucionSerializadaOutput(BaseModel):
    ok: bool
    venta_id: int
    devolucion_id: int
    id_bicicleta_serializada: int
    estado_bicicleta: str

class VentaDevolucionInput(BaseModel):
    motivo: str
    id_usuario: int


class VentaDevolucionOutput(BaseModel):
    ok: bool
    venta_id: int
    credito_generado: Decimal

class VentaDevolucionItemInput(BaseModel):
    id_venta_item: int
    cantidad: Decimal = Field(gt=0)


class VentaDevolucionParcialInput(BaseModel):
    items: List[VentaDevolucionItemInput]
    motivo: str
    id_usuario: int


class VentaDevolucionParcialOutput(BaseModel):
    ok: bool
    venta_id: int
    credito_generado: Decimal