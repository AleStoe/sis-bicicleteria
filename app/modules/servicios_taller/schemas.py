from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

class ServicioTallerCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: str | None = None
    precio_sugerido: Decimal = Field(ge=0)
    duracion_estimada_min: int | None = Field(default=None, gt=0)


class ServicioTallerUpdate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: str | None = None
    precio_sugerido: Decimal = Field(ge=0)
    duracion_estimada_min: int | None = Field(default=None, gt=0)
    activo: bool


class ServicioTallerResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None = None
    precio_sugerido: Decimal
    duracion_estimada_min: int | None = None
    activo: bool
    created_at: datetime
    updated_at: datetime