from datetime import date, time
from typing import Optional, Literal
from datetime import date, time, datetime
from pydantic import BaseModel, Field

FranjaAgendaTaller = Literal["mañana", "tarde"]

EstadoAgendaTaller = Literal[
    "pendiente",
    "confirmado",
    "en_taller",
    "cancelado",
    "convertido_orden",
]


class AgendaTallerCreateInput(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_bicicleta_cliente: Optional[int] = Field(default=None, gt=0)
    id_cliente: Optional[int] = Field(default=None, gt=0)

    cliente_nombre: str = Field(
        min_length=2,
        max_length=150,
    )

    cliente_telefono: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    fecha: date
    franja: FranjaAgendaTaller = "mañana"
    hora_inicio: time
    hora_fin: Optional[time] = None

    tipo_servicio: str = Field(
        min_length=2,
        max_length=150,
    )

    descripcion: Optional[str] = None
    notas: Optional[str] = None

    id_usuario_creador: int = Field(gt=0)


class AgendaTallerUpdateInput(BaseModel):
    id_cliente: Optional[int] = Field(default=None, gt=0)
    id_bicicleta_cliente: Optional[int] = Field(default=None, gt=0)
    cliente_nombre: str = Field(
        min_length=2,
        max_length=150,
    )

    cliente_telefono: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    fecha: date
    franja: FranjaAgendaTaller = "mañana"
    hora_inicio: time
    hora_fin: Optional[time] = None

    tipo_servicio: str = Field(
        min_length=2,
        max_length=150,
    )

    descripcion: Optional[str] = None
    notas: Optional[str] = None


class AgendaTallerEstadoInput(BaseModel):
    estado: EstadoAgendaTaller


class AgendaTallerOutput(BaseModel):
    id: int

    id_sucursal: int

    id_cliente: Optional[int]

    cliente_nombre: str
    cliente_telefono: Optional[str]

    fecha: date
    franja: FranjaAgendaTaller
    hora_inicio: time
    hora_fin: Optional[time]
    id_bicicleta_cliente: Optional[int]
    bicicleta_descripcion: Optional[str] = None
    tipo_servicio: str

    descripcion: Optional[str]
    notas: Optional[str]

    estado: EstadoAgendaTaller

    id_usuario_creador: int

    id_orden_taller: Optional[int]
    recordatorio_enviado: bool
    fecha_recordatorio: Optional[datetime] = None

class AgendaTallerConvertirOrdenInput(BaseModel):
    id_usuario: int = Field(gt=0)


class AgendaTallerConvertirOrdenOutput(BaseModel):
    ok: bool
    turno_id: int
    orden_id: int
    estado_turno: EstadoAgendaTaller