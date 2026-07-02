from datetime import datetime

from pydantic import BaseModel


class BackupCreateInput(BaseModel):
    incluir_uploads: bool = False


class BackupOutput(BaseModel):
    nombre: str
    tipo: str
    incluye_uploads: bool
    tamano_bytes: int
    fecha: datetime
