from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class AsistentePreguntaInput(BaseModel):
    pregunta: str = Field(min_length=1, max_length=300)
    id_sucursal: int | None = Field(default=None, gt=0)
    cliente_id: int | None = Field(default=None, gt=0)
    periodo: str = Field(default="365d", pattern="^(30d|90d|365d|all)$")


class AsistenteAccionOutput(BaseModel):
    label: str
    to: str


class AsistenteCardOutput(BaseModel):
    titulo: str
    valor: str | int | Decimal
    detalle: str | None = None
    tono: str = "neutral"
    to: str | None = None


class AsistenteItemOutput(BaseModel):
    titulo: str
    subtitulo: str | None = None
    detalle: str | None = None
    monto: Decimal | None = None
    estado: str | None = None
    to: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AsistenteRespuestaOutput(BaseModel):
    intent: str
    titulo: str
    resumen: str
    cards: list[AsistenteCardOutput] = Field(default_factory=list)
    items: list[AsistenteItemOutput] = Field(default_factory=list)
    sugerencias: list[str] = Field(default_factory=list)
    fuentes: list[str] = Field(default_factory=list)
    referencias: list[AsistenteAccionOutput] = Field(default_factory=list)
    acciones: list[AsistenteAccionOutput] = Field(default_factory=list)
    borrador_mensaje: str | None = None
    requiere_confirmacion: bool = False
    solo_lectura: bool = True


class AsistenteResumenOutput(BaseModel):
    titulo: str
    resumen: str
    cards: list[AsistenteCardOutput]
    sugerencias: list[str]
    fuentes: list[str]
    solo_lectura: bool = True
