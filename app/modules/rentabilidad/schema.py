from decimal import Decimal
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator


class ReglaDistribucionItemInput(BaseModel):
    id_participante: int = Field(gt=0)
    porcentaje: Decimal = Field(gt=0, le=100)


class ReglaDistribucionCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    items: List[ReglaDistribucionItemInput] = Field(min_length=1)

    @model_validator(mode="after")
    def validar_suma_porcentajes(self):
        total = sum((item.porcentaje for item in self.items), Decimal("0"))
        if total != Decimal("100"):
            raise ValueError("La suma de porcentajes debe ser 100")
        return self


class ReglaDistribucionItemOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_regla: int
    id_participante: int
    participante_nombre: str
    participante_tipo: str
    porcentaje: Decimal
    activo: bool


class ReglaDistribucionOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: Optional[str] = None
    activa: bool
    created_at: datetime
    updated_at: datetime
    items: List[ReglaDistribucionItemOutput] = []


class ReglaDistribucionEstadoOutput(BaseModel):
    ok: bool
    regla_id: int
    activa: bool


class RentabilidadDistribucionOutput(BaseModel):
    id_participante: int
    participante_nombre: str
    participante_tipo: str
    porcentaje: Decimal
    monto: Decimal


class RentabilidadMensualOutput(BaseModel):
    periodo_mes: date
    fecha_desde: date
    fecha_hasta: date
    id_sucursal: Optional[int] = None

    ventas_brutas: Decimal
    devoluciones_total: Decimal
    ventas_netas: Decimal

    cmv_bruto: Decimal
    cmv_devoluciones: Decimal
    cmv_neto: Decimal

    margen_bruto: Decimal
    gastos_operativos: Decimal
    resultado_distribuible: Decimal

    regla_distribucion: Optional[ReglaDistribucionOutput] = None
    distribuciones_sugeridas: List[RentabilidadDistribucionOutput] = []


class CierreRentabilidadCreateInput(BaseModel):
    periodo_mes: date
    id_sucursal: Optional[int] = Field(default=None, gt=0)
    id_regla_distribucion: Optional[int] = Field(default=None, gt=0)
    id_usuario: int = Field(gt=0)
    observaciones: Optional[str] = Field(default=None, max_length=1000)


class CierreRentabilidadDistribucionOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_cierre: int
    id_participante: Optional[int] = None
    participante_nombre_snapshot: str
    participante_tipo_snapshot: Optional[str] = None
    porcentaje: Decimal
    monto: Decimal
    created_at: datetime


class CierreRentabilidadOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    periodo_mes: date
    fecha_desde: date
    fecha_hasta: date
    id_sucursal: Optional[int] = None
    id_regla_distribucion: Optional[int] = None
    regla_nombre_snapshot: Optional[str] = None

    ventas_brutas: Decimal
    devoluciones_total: Decimal
    ventas_netas: Decimal

    cmv_bruto: Decimal
    cmv_devoluciones: Decimal
    cmv_neto: Decimal

    margen_bruto: Decimal
    gastos_operativos: Decimal
    resultado_distribuible: Decimal

    estado: str
    id_usuario_cierre: int
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    distribuciones: List[CierreRentabilidadDistribucionOutput] = []


class CierreRentabilidadCreateOutput(BaseModel):
    ok: bool
    cierre_id: int
