from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SubmedioCaja = Literal["efectivo", "transferencia", "mercadopago", "tarjeta"]
TipoMovimientoCaja = Literal["ingreso", "egreso", "ajuste"]


class CajaAbrirInput(BaseModel):
    id_sucursal: int = Field(gt=0)
    monto_apertura: Decimal = Field(ge=0)
    id_usuario: int = Field(gt=0)

class CajaAjusteInput(BaseModel):
    monto: Decimal = Field(gt=0)
    direccion: Literal["positivo", "negativo"]
    nota: str = Field(min_length=3, max_length=300)
    id_usuario: int
    
class CajaCerrarInput(BaseModel):
    monto_cierre_real: Decimal = Field(ge=0)
    id_usuario: int = Field(gt=0)


class CajaEgresoInput(BaseModel):
    monto: Decimal = Field(gt=0)
    nota: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class CajaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_sucursal: int
    estado: str
    monto_apertura: Decimal
    monto_cierre_teorico: Decimal | None = None
    monto_cierre_real: Decimal | None = None
    diferencia: Decimal | None = None
    id_usuario_apertura: int
    id_usuario_cierre: int | None = None


class CajaMovimientoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_caja: int
    fecha: object
    tipo_movimiento: TipoMovimientoCaja
    submedio: SubmedioCaja | None = None
    monto: Decimal
    origen_tipo: str | None = None
    origen_id: int | None = None
    nota: str | None = None
    id_usuario: int
    direccion_ajuste: Literal["positivo", "negativo"] | None = None

class CajaTotalesSubmedioOutput(BaseModel):
    efectivo: Decimal = Decimal("0")
    transferencia: Decimal = Decimal("0")
    mercadopago: Decimal = Decimal("0")
    tarjeta: Decimal = Decimal("0")


class CajaAbiertaResumenOutput(BaseModel):
    caja: CajaOutput
    efectivo_teorico: Decimal
    totales_por_submedio: CajaTotalesSubmedioOutput


class CajaDetalleOutput(BaseModel):
    caja: CajaOutput
    efectivo_teorico: Decimal
    totales_por_submedio: CajaTotalesSubmedioOutput
    movimientos: list[CajaMovimientoOutput]
    

class CajaAbrirOutput(BaseModel):
    ok: bool
    caja_id: int
    estado: str


class CajaCerrarOutput(BaseModel):
    ok: bool
    caja_id: int
    estado: str
    monto_cierre_teorico: Decimal
    monto_cierre_real: Decimal
    diferencia: Decimal


class CajaEgresoOutput(BaseModel):
    ok: bool
    movimiento_id: int
    caja_id: int
