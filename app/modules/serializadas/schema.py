from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class BicicletaSerializadaCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    id_sucursal_actual: int = Field(gt=0)
    numero_cuadro: str = Field(min_length=3, max_length=100)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int = Field(gt=0)


class BicicletaSerializadaCreateOutput(BaseModel):
    ok: bool
    bicicleta_id: int
    estado: str


class BicicletaSerializadaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    id_sucursal_actual: int
    numero_cuadro: str
    estado: str
    observaciones: Optional[str] = None