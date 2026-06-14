from datetime import date, time, datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field


FranjaAgendaTaller = Literal["mañana", "tarde"]

EstadoAgendaTaller = Literal[
    "pendiente",
    "confirmado",
    "en_taller",
    "cancelado",
    "convertido_orden",
]

TipoHistorialAgendaTaller = Literal[
    "creado",
    "editado",
    "reprogramado",
    "estado",
    "recordatorio_enviado",
    "cliente_avisado",
    "convertido_orden",
]


class AgendaTallerCreateInput(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_bicicleta_cliente: Optional[int] = Field(default=None, gt=0)
    id_cliente: Optional[int] = Field(default=None, gt=0)

    cliente_nombre: str = Field(min_length=2, max_length=150)
    cliente_telefono: Optional[str] = Field(default=None, max_length=50)

    fecha: date
    franja: FranjaAgendaTaller = "mañana"
    hora_inicio: time
    hora_fin: Optional[time] = None

    # Fecha prometida al cliente para entrega/retiro. Es opcional porque el turno
    # puede ser sólo reserva de ingreso y la promesa cerrarse recién al presupuestar.
    fecha_prometida_entrega: Optional[date] = None

    tipo_servicio: str = Field(min_length=2, max_length=150)
    descripcion: Optional[str] = None
    notas: Optional[str] = None

    id_usuario_creador: int = Field(gt=0)


class AgendaTallerUpdateInput(BaseModel):
    id_cliente: Optional[int] = Field(default=None, gt=0)
    id_bicicleta_cliente: Optional[int] = Field(default=None, gt=0)

    cliente_nombre: str = Field(min_length=2, max_length=150)
    cliente_telefono: Optional[str] = Field(default=None, max_length=50)

    fecha: date
    franja: FranjaAgendaTaller = "mañana"
    hora_inicio: time
    hora_fin: Optional[time] = None
    fecha_prometida_entrega: Optional[date] = None

    tipo_servicio: str = Field(min_length=2, max_length=150)
    descripcion: Optional[str] = None
    notas: Optional[str] = None

    # Para historial. Si todavía no lo tenés en el front, mandá el usuario logueado.
    id_usuario: Optional[int] = Field(default=None, gt=0)


class AgendaTallerEstadoInput(BaseModel):
    estado: EstadoAgendaTaller
    id_usuario: Optional[int] = Field(default=None, gt=0)


class AgendaTallerClienteAvisadoInput(BaseModel):
    id_usuario: Optional[int] = Field(default=None, gt=0)
    observacion: Optional[str] = Field(default=None, max_length=300)


class AgendaTallerOutput(BaseModel):
    id: int
    id_sucursal: int

    id_cliente: Optional[int]
    id_bicicleta_cliente: Optional[int]

    cliente_nombre: str
    cliente_telefono: Optional[str]
    bicicleta_descripcion: Optional[str] = None

    fecha: date
    franja: FranjaAgendaTaller
    hora_inicio: time
    hora_fin: Optional[time]
    fecha_prometida_entrega: Optional[date] = None

    tipo_servicio: str
    descripcion: Optional[str]
    notas: Optional[str]

    estado: EstadoAgendaTaller
    id_usuario_creador: int
    id_orden_taller: Optional[int]

    recordatorio_enviado: bool
    fecha_recordatorio: Optional[datetime] = None

    cliente_avisado: bool
    fecha_cliente_avisado: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AgendaTallerHistorialOutput(BaseModel):
    id: int
    id_turno_agenda: int
    tipo_evento: TipoHistorialAgendaTaller
    detalle: Optional[str]
    fecha_anterior: Optional[date]
    fecha_nueva: Optional[date]
    hora_inicio_anterior: Optional[time]
    hora_inicio_nueva: Optional[time]
    estado_anterior: Optional[str]
    estado_nuevo: Optional[str]
    id_usuario: Optional[int]
    created_at: datetime


class AgendaTallerConvertirOrdenInput(BaseModel):
    id_usuario: int = Field(gt=0)


class AgendaTallerConvertirOrdenOutput(BaseModel):
    ok: bool
    turno_id: int
    orden_id: int
    estado_turno: EstadoAgendaTaller
