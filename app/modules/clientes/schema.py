from typing import Optional, Literal
from pydantic import BaseModel, Field

TipoCliente = Literal["consumidor_final", "minorista", "mayorista"]


class ClienteCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    telefono: str = Field(min_length=3, max_length=50)
    dni: Optional[str] = Field(default=None, max_length=30)
    direccion: Optional[str] = Field(default=None, max_length=200)
    tipo_cliente: TipoCliente = "minorista"
    notas: Optional[str] = None


class ClienteUpdateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    telefono: str = Field(min_length=3, max_length=50)
    dni: Optional[str] = Field(default=None, max_length=30)
    direccion: Optional[str] = Field(default=None, max_length=200)
    tipo_cliente: TipoCliente
    notas: Optional[str] = None
    activo: bool = True