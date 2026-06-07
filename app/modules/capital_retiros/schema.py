from decimal import Decimal
from typing import Optional, List, Literal
from datetime import date, datetime

from pydantic import BaseModel, Field, ConfigDict


TipoParticipanteCapital = Literal["persona", "fondo"]
TipoMovimientoCapital = Literal[
    "aporte_capital",
    "prestamo_socio",
    "devolucion_prestamo",
    "retiro_personal",
    "distribucion_ganancia",
]
EstadoMovimientoCapital = Literal["activo", "anulado"]
MedioPagoCapital = Literal["efectivo", "transferencia", "mercadopago", "tarjeta"]


class ParticipanteCapitalCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    tipo: TipoParticipanteCapital = "persona"
    observaciones: Optional[str] = Field(default=None, max_length=500)


class ParticipanteCapitalUpdateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    tipo: TipoParticipanteCapital = "persona"
    activo: bool = True
    observaciones: Optional[str] = Field(default=None, max_length=500)


class ParticipanteCapitalEstadoInput(BaseModel):
    activo: bool


class ParticipanteCapitalOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    tipo: str
    activo: bool
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ParticipanteCapitalEstadoOutput(BaseModel):
    ok: bool
    participante_id: int
    activo: bool


class MovimientoCapitalCreateInput(BaseModel):
    id_participante: int = Field(gt=0)
    id_sucursal: Optional[int] = Field(default=None, gt=0)
    tipo_movimiento: TipoMovimientoCapital
    descripcion: str = Field(min_length=3, max_length=500)
    monto: Decimal = Field(gt=0)
    medio_pago: Optional[MedioPagoCapital] = None
    impacta_caja: bool = False
    fecha: Optional[date] = None
    origen_tipo: Optional[str] = Field(default=None, max_length=40)
    origen_id: Optional[int] = Field(default=None, gt=0)
    id_usuario: int = Field(gt=0)


class MovimientoCapitalAnularInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class MovimientoCapitalOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: date
    id_sucursal: Optional[int] = None
    sucursal_nombre: Optional[str] = None
    id_participante: int
    participante_nombre: str
    participante_tipo: str
    tipo_movimiento: str
    descripcion: str
    monto: Decimal
    medio_pago: Optional[str] = None
    impacta_caja: bool
    id_caja_movimiento: Optional[int] = None
    estado: str
    id_usuario: int
    created_at: datetime
    updated_at: datetime


class MovimientoCapitalHistorialOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_movimiento: int
    tipo_evento: str
    monto: Decimal
    detalle: Optional[str] = None
    origen_tipo: Optional[str] = None
    origen_id: Optional[int] = None
    id_usuario: int
    created_at: datetime


class MovimientoCapitalDetalleOutput(BaseModel):
    movimiento: MovimientoCapitalOutput
    historial: List[MovimientoCapitalHistorialOutput]


class MovimientoCapitalCreateOutput(BaseModel):
    ok: bool
    movimiento_id: int
    historial_id: int
    caja_movimiento_id: Optional[int] = None


class MovimientoCapitalEstadoOutput(BaseModel):
    ok: bool
    movimiento_id: int
    estado: str
    historial_id: int
    caja_movimiento_id: Optional[int] = None


class CapitalResumenParticipanteOutput(BaseModel):
    id_participante: int
    participante_nombre: str
    participante_tipo: str
    total_aportes: Decimal
    total_prestamos: Decimal
    total_devoluciones_prestamo: Decimal
    saldo_prestamo: Decimal
    total_retiros: Decimal
    total_distribuciones: Decimal
    saldo_neto_capital: Decimal


class ParticipanteCapitalPerfilOutput(BaseModel):
    participante: ParticipanteCapitalOutput
    resumen: CapitalResumenParticipanteOutput
    movimientos: List[MovimientoCapitalOutput]


class CapitalResumenOutput(BaseModel):
    total_aportes: Decimal
    total_prestamos: Decimal
    total_devoluciones_prestamo: Decimal
    saldo_prestamos: Decimal
    total_retiros: Decimal
    total_distribuciones: Decimal
    participantes: List[CapitalResumenParticipanteOutput]
