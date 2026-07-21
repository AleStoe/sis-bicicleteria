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


class RentabilidadRubroOutput(BaseModel):
    clave: str
    nombre: str
    detalle: str
    cantidad_ventas: int = 0
    cantidad_items: int = 0
    cantidad_unidades: Decimal = Decimal("0")
    venta_comercial: Decimal = Decimal("0")
    cmv_comercial: Decimal = Decimal("0")
    margen_esperado: Decimal = Decimal("0")
    cobrado_comercial_reconocido: Decimal = Decimal("0")
    capital_recuperado: Decimal = Decimal("0")
    capital_inmovilizado: Decimal = Decimal("0")
    utilidad_liberada: Decimal = Decimal("0")
    utilidad_pendiente: Decimal = Decimal("0")


class RentabilidadMensualOutput(BaseModel):
    periodo_mes: date
    fecha_desde: date
    fecha_hasta: date
    id_sucursal: Optional[int] = None

    cantidad_ventas: int = 0
    ventas_brutas: Decimal
    devoluciones_total: Decimal
    ventas_netas: Decimal
    venta_comercial: Decimal = Decimal("0")
    ventas_cobradas: Decimal = Decimal("0")
    cobrado_comercial_reconocido: Decimal = Decimal("0")
    saldo_pendiente_por_cobrar: Decimal = Decimal("0")
    financiacion_excluida: Decimal = Decimal("0")
    financiacion_cobrada: Decimal = Decimal("0")
    costos_financieros: Decimal = Decimal("0")
    ingreso_real_neto: Decimal = Decimal("0")
    resultado_financiero: Decimal = Decimal("0")

    cmv_bruto: Decimal
    cmv_devoluciones: Decimal
    cmv_neto: Decimal
    cmv_comercial: Decimal = Decimal("0")
    cmv_cobrado: Decimal = Decimal("0")
    capital_recuperado: Decimal = Decimal("0")
    capital_inmovilizado: Decimal = Decimal("0")

    margen_bruto: Decimal
    margen_esperado: Decimal = Decimal("0")
    margen_cobrado: Decimal = Decimal("0")
    margen_pendiente: Decimal = Decimal("0")
    utilidad_liberada: Decimal = Decimal("0")
    utilidad_pendiente: Decimal = Decimal("0")
    margen_real: Decimal
    gastos_operativos: Decimal
    resultado_distribuible: Decimal

    regla_distribucion: Optional[ReglaDistribucionOutput] = None
    distribuciones_sugeridas: List[RentabilidadDistribucionOutput] = []
    resumen_por_rubro: List[RentabilidadRubroOutput] = []


class BonificacionGarantiaItemOutput(BaseModel):
    id_venta_item: int
    id_venta: int
    fecha: datetime
    id_orden_taller: Optional[int] = None
    origen: str
    cliente_nombre: str
    usuario_nombre: str
    descripcion_snapshot: str
    tipo_item: str
    cantidad_neta: Decimal
    motivo_bonificacion: str
    valor_lista: Decimal
    valor_bonificado: Decimal
    importe_post_bonificacion: Decimal
    costo_capital: Decimal
    ingreso_neto_asignado: Decimal
    resultado_economico: Decimal


class BonificacionesGarantiasOutput(BaseModel):
    periodo_mes: date
    fecha_desde: date
    fecha_hasta: date
    id_sucursal: Optional[int] = None
    cantidad_operaciones: int
    cantidad_items: int
    cantidad_productos: int
    cantidad_servicios: int
    valor_lista: Decimal
    valor_bonificado: Decimal
    importe_post_bonificacion: Decimal
    costo_capital: Decimal
    ingreso_neto_asignado: Decimal
    resultado_economico: Decimal
    items: List[BonificacionGarantiaItemOutput] = []


class RentabilidadDetalleDiarioOutput(BaseModel):
    id_venta_item: int
    id_venta: int
    fecha: datetime
    cliente_nombre: str
    estado_venta: str
    origen: str
    tipo_precio: str = "minorista"
    tipo_item: str
    id_variante: Optional[int] = None
    id_servicio_taller: Optional[int] = None
    producto: str
    variante: Optional[str] = None
    producto_rubro: Optional[str] = None
    categoria_nombre: Optional[str] = None
    descripcion_snapshot: str
    cantidad: Decimal
    cantidad_devuelta: Decimal
    cantidad_neta: Decimal
    precio_lista: Decimal
    precio_final: Decimal
    bonificacion_total: Decimal
    descuento_comercial_asignado: Decimal
    financiacion_excluida: Decimal
    financiacion_cobrada: Decimal = Decimal("0")
    costo_financiero: Decimal = Decimal("0")
    ingreso_real_neto: Decimal = Decimal("0")
    cobrado_comercial_reconocido: Decimal = Decimal("0")
    devolucion_comercial: Decimal
    ingreso_comercial: Decimal
    venta_cobrada: Decimal = Decimal("0")
    costo_total: Decimal
    costo_cobrado: Decimal = Decimal("0")
    capital_recuperado: Decimal = Decimal("0")
    capital_inmovilizado: Decimal = Decimal("0")
    utilidad_liberada: Decimal = Decimal("0")
    margen_bruto: Decimal
    margen_cobrado: Decimal = Decimal("0")
    margen_pendiente: Decimal = Decimal("0")
    utilidad_pendiente: Decimal = Decimal("0")
    margen_real: Decimal
    medios_pago: str


class RentabilidadArticuloDiarioOutput(BaseModel):
    tipo_item: str = "producto"
    id_variante: Optional[int] = None
    id_servicio_taller: Optional[int] = None
    producto: str
    variante: Optional[str] = None
    cantidad_vendida: Decimal
    cantidad_ventas: int = 0
    valor_lista: Decimal = Decimal("0")
    bonificacion_total: Decimal = Decimal("0")
    descuento_comercial: Decimal = Decimal("0")
    financiacion_excluida: Decimal = Decimal("0")
    financiacion_cobrada: Decimal = Decimal("0")
    costo_financiero: Decimal = Decimal("0")
    ingreso_real_neto: Decimal = Decimal("0")
    cobrado_comercial_reconocido: Decimal = Decimal("0")
    devoluciones_total: Decimal = Decimal("0")
    venta_total: Decimal
    venta_cobrada: Decimal = Decimal("0")
    costo_total: Decimal
    costo_cobrado: Decimal = Decimal("0")
    capital_recuperado: Decimal = Decimal("0")
    capital_inmovilizado: Decimal = Decimal("0")
    utilidad_liberada: Decimal = Decimal("0")
    margen_bruto: Decimal
    margen_cobrado: Decimal = Decimal("0")
    margen_pendiente: Decimal = Decimal("0")
    utilidad_pendiente: Decimal = Decimal("0")
    margen_real: Decimal
    margen_porcentaje: Decimal
    detalles: List[RentabilidadDetalleDiarioOutput] = []


class RentabilidadDiariaOutput(BaseModel):
    fecha: date
    id_sucursal: Optional[int] = None
    cantidad_ventas: int
    ventas_netas: Decimal
    venta_comercial: Decimal = Decimal("0")
    ventas_cobradas: Decimal = Decimal("0")
    cobrado_comercial_reconocido: Decimal = Decimal("0")
    saldo_pendiente_por_cobrar: Decimal = Decimal("0")
    financiacion_excluida: Decimal = Decimal("0")
    financiacion_cobrada: Decimal = Decimal("0")
    costos_financieros: Decimal = Decimal("0")
    ingreso_real_neto: Decimal = Decimal("0")
    resultado_financiero: Decimal = Decimal("0")
    devoluciones_total: Decimal
    cmv: Decimal
    cmv_comercial: Decimal = Decimal("0")
    cmv_cobrado: Decimal = Decimal("0")
    capital_recuperado: Decimal = Decimal("0")
    capital_inmovilizado: Decimal = Decimal("0")
    margen_bruto: Decimal
    margen_esperado: Decimal = Decimal("0")
    margen_cobrado: Decimal = Decimal("0")
    margen_pendiente: Decimal = Decimal("0")
    utilidad_liberada: Decimal = Decimal("0")
    utilidad_pendiente: Decimal = Decimal("0")
    margen_real: Decimal
    margen_porcentaje: Decimal
    articulos: List[RentabilidadArticuloDiarioOutput] = []


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
    financiacion_cobrada: Decimal = Decimal("0")
    costos_financieros: Decimal = Decimal("0")
    resultado_financiero: Decimal = Decimal("0")
    margen_real: Decimal = Decimal("0")
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
