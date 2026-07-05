from datetime import date
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
    usuario_nombre: str | None = None
    usuario_username: str | None = None

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

class CajaHistorialOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_sucursal: int
    sucursal_nombre: str | None = None
    estado: str
    monto_apertura: Decimal
    monto_cierre_teorico: Decimal | None = None
    monto_cierre_real: Decimal | None = None
    diferencia: Decimal | None = None

    id_usuario_apertura: int
    usuario_apertura_nombre: str | None = None
    usuario_apertura_username: str | None = None

    id_usuario_cierre: int | None = None
    usuario_cierre_nombre: str | None = None
    usuario_cierre_username: str | None = None


class CajaResumenDiarioCajaOutput(BaseModel):
    caja_id: int | None = None
    estado: str | None = None
    fecha: date | None = None
    monto_apertura: Decimal = Decimal("0")
    efectivo_teorico: Decimal = Decimal("0")
    monto_cierre_real: Decimal | None = None
    diferencia: Decimal | None = None
    ingresos: Decimal = Decimal("0")
    egresos: Decimal = Decimal("0")
    ajustes_positivos: Decimal = Decimal("0")
    ajustes_negativos: Decimal = Decimal("0")


class CajaResumenDiarioPagosOutput(BaseModel):
    cantidad_pagos: int = 0
    total_cobrado: Decimal = Decimal("0")
    total_bruto_cobrado: Decimal = Decimal("0")
    costos_financieros: Decimal = Decimal("0")
    total_neto_esperado: Decimal = Decimal("0")
    base_aplicada: Decimal = Decimal("0")
    descuentos_aplicados: Decimal = Decimal("0")
    recargos_aplicados: Decimal = Decimal("0")
    efectivo: Decimal = Decimal("0")
    transferencia: Decimal = Decimal("0")
    mercadopago: Decimal = Decimal("0")
    tarjeta: Decimal = Decimal("0")
    total_financiado_tarjeta: Decimal = Decimal("0")


class CajaResumenDiarioRentabilidadOutput(BaseModel):
    cantidad_ventas: int = 0
    ventas_total: Decimal = Decimal("0")
    ventas_items_total: Decimal = Decimal("0")
    costo_mercaderia_vendida: Decimal | None = None
    margen_bruto: Decimal | None = None
    financiacion_cobrada: Decimal = Decimal("0")
    costos_financieros: Decimal = Decimal("0")
    resultado_financiero: Decimal = Decimal("0")
    margen_real: Decimal | None = None
    gastos_operativos: Decimal = Decimal("0")
    ganancia_dia: Decimal | None = None


class CajaResumenDiarioDocumentosOutput(BaseModel):
    comprobantes_x: int = 0
    recibos_pago: int = 0
    resumenes_cobro: int = 0
    cotizaciones: int = 0
    presupuestos_taller: int = 0
    total_disponibles: int = 0


class CajaResumenDiarioOutput(BaseModel):
    fecha: date
    id_sucursal: int | None = None
    caja: CajaResumenDiarioCajaOutput
    pagos: CajaResumenDiarioPagosOutput
    rentabilidad: CajaResumenDiarioRentabilidadOutput
    documentos: CajaResumenDiarioDocumentosOutput
