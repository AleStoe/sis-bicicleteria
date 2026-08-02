from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class CorreccionCapitalSinCajaOutput(BaseModel):
    id: int
    fecha: date
    id_sucursal: Optional[int] = None
    sucursal_nombre: Optional[str] = None
    id_participante: int
    participante_nombre: str
    tipo_movimiento: str
    descripcion: str
    monto: Decimal
    medio_pago: Optional[str] = None
    estado: str
    created_at: datetime


class CorreccionVentaSaldoSinDeudaOutput(BaseModel):
    id: int
    fecha: datetime
    id_cliente: int
    cliente_nombre: str
    estado: str
    total_final: Decimal
    saldo_pendiente: Decimal


class CorreccionCreditoDudosoOutput(BaseModel):
    id: int
    id_cliente: int
    cliente_nombre: str
    origen_tipo: str
    origen_id: int
    saldo_actual: Decimal
    estado: str
    observacion: Optional[str] = None
    medio_electronico: Optional[str] = None


class CorreccionCajaViejaOutput(BaseModel):
    id: int
    fecha: date
    id_sucursal: int
    sucursal_nombre: str
    estado: str
    monto_apertura: Decimal


class CorreccionCostoSospechosoOutput(BaseModel):
    id: int
    id_venta: int
    fecha: datetime
    venta_estado: str
    id_cliente: int
    cliente_nombre: str
    id_variante: Optional[int] = None
    id_producto: Optional[int] = None
    producto_nombre: Optional[str] = None
    nombre_variante: Optional[str] = None
    sku: Optional[str] = None
    descripcion_snapshot: str
    cantidad: Decimal
    precio_final: Decimal
    subtotal: Decimal
    costo_unitario_aplicado: Decimal
    costo_vigente: Decimal
    bonificado: bool
    cmv_item: Decimal
    margen_item: Decimal
    margen_porcentaje_sobre_venta: Optional[Decimal] = None
    diferencia_costo_vigente_porcentaje: Optional[Decimal] = None
    motivo_alerta: str


class CorreccionesPendientesOutput(BaseModel):
    capital_sin_caja: List[CorreccionCapitalSinCajaOutput]
    ventas_saldo_sin_deuda: List[CorreccionVentaSaldoSinDeudaOutput]
    creditos_anulacion_dudosos: List[CorreccionCreditoDudosoOutput]
    cajas_abiertas_anteriores: List[CorreccionCajaViejaOutput]
    costos_sospechosos: List[CorreccionCostoSospechosoOutput]


class CorregirCapitalSinCajaInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class CorregirCapitalSinCajaOutput(BaseModel):
    ok: bool
    movimiento_id: int
    caja_movimiento_id: int


class ValidarCapitalSinCajaOutput(BaseModel):
    ok: bool
    movimiento_id: int
    historial_id: int
