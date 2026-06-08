from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal

RolUsuario = Literal["administrador", "encargado", "operador", "mecanico"]


class UsuarioCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    rol: RolUsuario


class UsuarioUpdateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    rol: RolUsuario
    activo: bool = True