from decimal import Decimal
from typing import Optional, List
from datetime import date, datetime

from pydantic import BaseModel, Field, ConfigDict, model_validator


class GastoCategoriaCreateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)


class GastoCategoriaUpdateInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    activa: bool = True


class GastoCategoriaEstadoInput(BaseModel):
    activa: bool


class GastoCategoriaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    activa: bool
    created_at: datetime


class GastoCreateInput(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_categoria_gasto: Optional[int] = Field(default=None, gt=0)
    descripcion: str = Field(min_length=3, max_length=500)
    monto: Decimal = Field(gt=0)
    medio_pago: Optional[str] = Field(default=None, max_length=30)

    impacta_caja: bool = False

    fecha: Optional[date] = None
    periodo_mes: Optional[date] = None
    es_recurrente: bool = False

    origen_tipo: Optional[str] = Field(default=None, max_length=40)
    origen_id: Optional[int] = Field(default=None, gt=0)

    id_usuario: int = Field(gt=0)

    @model_validator(mode="after")
    def validar_medio_pago_si_impacta_caja(self):
        # Si impacta caja y no se informa medio, el service usa efectivo por compatibilidad.
        # No bloqueamos para no romper payloads viejos.
        return self


class GastoCorregirInput(BaseModel):
    descripcion: str = Field(min_length=3, max_length=500)
    monto: Decimal = Field(gt=0)
    id_categoria_gasto: Optional[int] = Field(default=None, gt=0)
    medio_pago: Optional[str] = Field(default=None, max_length=30)
    periodo_mes: Optional[date] = None
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class GastoAnularInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class GastoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: date
    id_sucursal: Optional[int] = None
    usuario_nombre: str | None = None
    usuario_username: str | None = None
    sucursal_nombre: Optional[str] = None
    id_categoria_gasto: Optional[int] = None
    categoria_nombre: Optional[str] = None
    descripcion: str
    monto: Decimal
    medio_pago: Optional[str] = None
    impacta_caja: bool
    id_caja_movimiento: Optional[int] = None
    periodo_mes: Optional[date] = None
    es_recurrente: bool
    estado: str
    id_usuario: int
    created_at: datetime
    updated_at: datetime


class GastoMovimientoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_nombre: str | None = None
    usuario_username: str | None = None
    id_gasto: int
    tipo_movimiento: str
    monto: Decimal
    detalle: Optional[str] = None
    origen_tipo: Optional[str] = None
    origen_id: Optional[int] = None
    id_usuario: int
    created_at: datetime


class GastoDetalleOutput(BaseModel):
    gasto: GastoOutput
    movimientos: List[GastoMovimientoOutput]


class GastoCreateOutput(BaseModel):
    ok: bool
    gasto_id: int
    movimiento_id: int
    caja_movimiento_id: Optional[int] = None


class GastoEstadoOutput(BaseModel):
    ok: bool
    gasto_id: int
    estado: str
    movimiento_id: int
    caja_movimiento_id: Optional[int] = None


class GastoCategoriaEstadoOutput(BaseModel):
    ok: bool
    categoria_id: int
    activa: bool


class GastoResumenOutput(BaseModel):
    total: Decimal
    cantidad: int
    total_activos: Decimal
    cantidad_activos: int
    total_anulados: Decimal
    cantidad_anulados: int
