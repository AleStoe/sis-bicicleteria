from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


ESTADOS_TALLER_BASE = Literal[
    "ingresada",
    "presupuestada",
    "esperando_aprobacion",
    "esperando_repuestos",
    "en_reparacion",
    "terminada",
    "lista_para_retirar",
    "retirada",
    "cancelada",
]


class OrdenTallerCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_cliente: int = Field(gt=0)
    id_bicicleta_cliente: int = Field(gt=0)
    problema_reportado: str = Field(min_length=1)
    id_usuario: int = Field(gt=0)


class OrdenTallerEstadoUpdate(BaseModel):
    nuevo_estado: ESTADOS_TALLER_BASE
    id_usuario: int = Field(gt=0)


class OrdenTallerItemCreate(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal = Field(ge=0)
    id_usuario: int = Field(gt=0)


class OrdenTallerResponse(BaseModel):
    id: int
    fecha_ingreso: datetime
    id_sucursal: int
    id_cliente: int
    id_bicicleta_cliente: int
    estado: str
    problema_reportado: str
    observaciones: str | None = None
    fecha_prometida: datetime | None = None
    total_final: Decimal
    saldo_pendiente: Decimal
    id_usuario: int
    created_at: datetime
    updated_at: datetime


class OrdenTallerEventoResponse(BaseModel):
    id: int
    id_orden_taller: int
    fecha: datetime
    tipo_evento: str
    detalle: str | None = None
    id_usuario: int
    created_at: datetime


class OrdenTallerItemResponse(BaseModel):
    id: int
    id_orden_taller: int
    id_variante: int
    etapa: str
    descripcion_snapshot: str
    cantidad: Decimal
    precio_unitario: Decimal
    costo_unitario_aplicado: Decimal | None = None
    aprobado: bool
    subtotal: Decimal
    created_at: datetime
    updated_at: datetime


class OrdenTallerDetalleResponse(OrdenTallerResponse):
    eventos: list[OrdenTallerEventoResponse] = Field(default_factory=list)
    items: list[OrdenTallerItemResponse] = Field(default_factory=list)

class OrdenTallerItemAprobacionUpdate(BaseModel):
    aprobado: bool
    id_usuario: int = Field(gt=0)

class OrdenTallerItemReversionEjecucionInput(BaseModel):
    id_usuario: int = Field(gt=0)
    motivo: str = Field(min_length=1)