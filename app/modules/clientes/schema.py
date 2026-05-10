from typing import Optional, Literal
from pydantic import BaseModel, Field

TipoCliente = Literal["consumidor_final", "minorista", "mayorista"]

CondicionIva = Literal[
    "consumidor_final",
    "responsable_inscripto",
    "monotributo",
    "exento",
]

class ClienteCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    telefono: str = Field(min_length=3, max_length=50)
    dni: Optional[str] = Field(default=None, max_length=30)
    direccion: Optional[str] = Field(default=None, max_length=200)
    tipo_cliente: TipoCliente = "minorista"
    notas: Optional[str] = None
    condicion_iva: CondicionIva = "consumidor_final"
    cuit: Optional[str] = Field(default=None, max_length=20)
    razon_social: Optional[str] = Field(default=None, max_length=150)


class ClienteUpdateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    telefono: str = Field(min_length=3, max_length=50)
    dni: Optional[str] = Field(default=None, max_length=30)
    direccion: Optional[str] = Field(default=None, max_length=200)
    tipo_cliente: TipoCliente
    notas: Optional[str] = None
    activo: bool = True
    condicion_iva: CondicionIva = "consumidor_final"
    cuit: Optional[str] = Field(default=None, max_length=20)
    razon_social: Optional[str] = Field(default=None, max_length=150)

class BicicletaClienteCreateInput(BaseModel):
    marca: str = Field(min_length=1, max_length=100)
    modelo: str = Field(min_length=1, max_length=100)
    rodado: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=50)
    numero_cuadro: str | None = Field(default=None, max_length=100)
    notas: str | None = None

