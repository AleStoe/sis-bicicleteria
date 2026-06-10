from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal

RolUsuario = Literal["administrador", "encargado", "operador", "mecanico"]


class UsuarioCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    password: str = Field(min_length=6, max_length=72)
    rol: RolUsuario


class UsuarioUpdateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    password: str | None = Field(default=None, min_length=6, max_length=72)
    rol: RolUsuario
    activo: bool = True