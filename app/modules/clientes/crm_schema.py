from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator


TipoSeguimiento = Literal[
    "llamada",
    "whatsapp",
    "service",
    "presupuesto",
    "reserva",
    "deuda",
    "postventa",
    "otro",
]
PrioridadSeguimiento = Literal["baja", "normal", "alta", "urgente"]
EstadoCierreSeguimiento = Literal["realizada", "cancelada"]


class SeguimientoCreateInput(BaseModel):
    tipo: TipoSeguimiento
    motivo: str = Field(min_length=3, max_length=500)
    fecha_objetivo: date
    prioridad: PrioridadSeguimiento = "normal"
    id_usuario_responsable: int = Field(gt=0)
    id_usuario_actor: int | None = Field(default=None, gt=0)
    id_venta: int | None = Field(default=None, gt=0)
    id_deuda: int | None = Field(default=None, gt=0)
    id_reserva: int | None = Field(default=None, gt=0)
    id_orden_taller: int | None = Field(default=None, gt=0)
    id_bicicleta_cliente: int | None = Field(default=None, gt=0)
    id_cotizacion: int | None = Field(default=None, gt=0)
    id_caso_postventa: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def una_referencia_como_maximo(self):
        referencias = [
            self.id_venta,
            self.id_deuda,
            self.id_reserva,
            self.id_orden_taller,
            self.id_bicicleta_cliente,
            self.id_cotizacion,
            self.id_caso_postventa,
        ]
        if sum(valor is not None for valor in referencias) > 1:
            raise ValueError("Un seguimiento puede tener una sola referencia operativa")
        return self
class SeguimientoReprogramarInput(BaseModel):
    fecha_objetivo: date
    id_usuario_responsable: int = Field(gt=0)
    prioridad: PrioridadSeguimiento = "normal"
    nota: str | None = Field(default=None, max_length=500)
    id_usuario_actor: int | None = Field(default=None, gt=0)


class SeguimientoCerrarInput(BaseModel):
    estado: EstadoCierreSeguimiento
    resultado: str = Field(min_length=3, max_length=1000)
    id_usuario_actor: int | None = Field(default=None, gt=0)


class ComunicacionCreateInput(BaseModel):
    canal: str = Field(pattern="^(whatsapp|llamada|otro)$")
    resultado: str = Field(pattern="^(contactado|sin_respuesta|respondio|interesado|no_interesado|convertido|otro)$")
    mensaje: str | None = Field(default=None, max_length=3000)
    nota: str | None = Field(default=None, max_length=1000)
    id_seguimiento: int | None = Field(default=None, gt=0)
    id_usuario_actor: int | None = Field(default=None, gt=0)


class PreferenciaContactoInput(BaseModel):
    estado: str = Field(pattern="^(habilitado|no_contactar)$")
    canal_preferido: str | None = Field(default=None, pattern="^(whatsapp|llamada|otro)$")
    motivo_exclusion: str | None = Field(default=None, max_length=500)
    id_usuario_actor: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validar_exclusion(self):
        if self.estado == "no_contactar" and not (self.motivo_exclusion or "").strip():
            raise ValueError("Indicá por qué no se debe contactar al cliente")
        return self
