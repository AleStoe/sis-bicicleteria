from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class AuditoriaEventoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: Any
    id_usuario: int

    usuario_nombre: Optional[str] = None
    usuario_username: Optional[str] = None

    id_sucursal: Optional[int] = None
    entidad: str
    entidad_id: int
    accion: str
    detalle: Optional[str] = None
    metadata: Optional[dict] = None
    origen_tipo: Optional[str] = None
    origen_id: Optional[int] = None