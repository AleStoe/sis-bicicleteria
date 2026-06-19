from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class ProveedorCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=150)
    notas: Optional[str] = None


class ProveedorUpdateInput(ProveedorCreateInput):
    pass


class ProveedorOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime
