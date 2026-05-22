from datetime import datetime
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


class BicicletaSerializadaDetalleOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    id_sucursal_actual: int
    sucursal_nombre: str
    numero_cuadro: str
    estado: str
    observaciones: Optional[str] = None
    nombre_variante: str
    producto_nombre: str
    id_producto: Optional[int] = None
    sku: Optional[str] = None
    codigo_barras: Optional[str] = None
    codigo_proveedor: Optional[str] = None
    imagen_principal: Optional[str] = None
    fecha_alta: Optional[datetime] = None
    cliente_actual_id: Optional[int] = None
    cliente_actual_nombre: Optional[str] = None
    cliente_actual_telefono: Optional[str] = None
    operacion_tipo: Optional[str] = None
    operacion_id: Optional[int] = None
    venta_id: Optional[int] = None
    reserva_id: Optional[int] = None
