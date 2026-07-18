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


class CorreccionesPendientesOutput(BaseModel):
    capital_sin_caja: List[CorreccionCapitalSinCajaOutput]
    ventas_saldo_sin_deuda: List[CorreccionVentaSaldoSinDeudaOutput]
    creditos_anulacion_dudosos: List[CorreccionCreditoDudosoOutput]
    cajas_abiertas_anteriores: List[CorreccionCajaViejaOutput]


class CorregirCapitalSinCajaInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class CorregirCapitalSinCajaOutput(BaseModel):
    ok: bool
    movimiento_id: int
    caja_movimiento_id: int
