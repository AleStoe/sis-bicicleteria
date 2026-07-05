from decimal import Decimal
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class DashboardKpiOutput(BaseModel):
    ventas_mes: Decimal
    gastos_mes: Decimal
    resultado_estimado: Decimal
    margen_bruto_mes: Decimal
    margen_bruto_porcentaje: Decimal
    margen_real_mes: Decimal
    margen_real_porcentaje: Decimal
    cantidad_ventas_mes: int
    ticket_promedio_mes: Decimal
    caja_actual: Decimal
    deudas_abiertas: Decimal
    creditos_abiertos: Decimal
    ventas_pendientes_entrega: int
    taller_pendiente: int
    repuestos_criticos: int
    productos_sin_movimiento: int


class DashboardCajaOutput(BaseModel):
    caja_abierta_id: Optional[int] = None
    estado: Optional[str] = None
    fecha: Optional[date] = None
    saldo_teorico: Decimal
    ingresos: Decimal
    egresos: Decimal
    ajustes_positivos: Decimal
    ajustes_negativos: Decimal


class DashboardResultadoHoyOutput(BaseModel):
    fecha: date
    ventas_total: Decimal
    cantidad_ventas: int
    ventas_items_total: Decimal
    cmv: Decimal
    margen_bruto: Decimal
    financiacion_cobrada: Decimal
    costos_financieros: Decimal
    resultado_financiero: Decimal
    margen_real: Decimal
    gastos_operativos: Decimal
    resultado_estimado: Decimal


class DashboardVentaMensualOutput(BaseModel):
    periodo: date
    etiqueta: str
    ventas_total: Decimal
    cantidad_ventas: int


class DashboardTopClienteOutput(BaseModel):
    id_cliente: int
    cliente_nombre: str
    cantidad_compras: int
    total_comprado: Decimal
    ticket_promedio: Decimal
    ultima_compra: Optional[datetime] = None


class DashboardTopProductoOutput(BaseModel):
    id_variante: Optional[int] = None
    producto: str
    variante: Optional[str] = None
    cantidad_vendida: Decimal
    venta_total: Decimal
    costo_total: Decimal
    margen_bruto: Decimal


class DashboardProductoSinMovimientoOutput(BaseModel):
    id_variante: int
    producto: str
    variante: Optional[str] = None
    stock_fisico: Decimal
    costo_promedio_vigente: Decimal
    capital_inmovilizado: Decimal
    ultima_venta: Optional[datetime] = None
    dias_sin_movimiento: Optional[int] = None


class DashboardRepuestoCriticoOutput(BaseModel):
    id_variante: int
    producto: str
    variante: Optional[str] = None
    stock_fisico: Decimal
    stock_reservado: Decimal
    stock_vendido_pendiente_entrega: Decimal
    costo_promedio_vigente: Decimal


class DashboardCapitalInmovilizadoOutput(BaseModel):
    id_variante: int
    producto: str
    variante: Optional[str] = None
    stock_fisico: Decimal
    costo_promedio_vigente: Decimal
    capital_inmovilizado: Decimal


class DashboardTallerPendienteOutput(BaseModel):
    id: int
    fecha_ingreso: datetime
    cliente_nombre: str
    estado: str
    problema_reportado: str
    total_final: Decimal
    saldo_pendiente: Decimal


class DashboardVentaPendienteEntregaOutput(BaseModel):
    id: int
    fecha: datetime
    cliente_nombre: str
    estado: str
    total_final: Decimal
    saldo_pendiente: Decimal
    cantidad_items: Decimal


class DashboardAlertaOperativaOutput(BaseModel):
    tipo: str
    titulo: str
    detalle: str
    cantidad: int
    severidad: str
    to: str


class DashboardResumenOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    periodo_mes: date
    fecha_desde: date
    fecha_hasta: date
    id_sucursal: Optional[int] = None
    kpis: DashboardKpiOutput
    caja: DashboardCajaOutput
    resultado_hoy: DashboardResultadoHoyOutput
    ventas_ultimos_meses: List[DashboardVentaMensualOutput]
    top_clientes: List[DashboardTopClienteOutput]
    top_productos_cantidad: List[DashboardTopProductoOutput]
    productos_sin_movimiento: List[DashboardProductoSinMovimientoOutput]
    repuestos_criticos: List[DashboardRepuestoCriticoOutput]
    capital_inmovilizado: List[DashboardCapitalInmovilizadoOutput]
    taller_pendiente: List[DashboardTallerPendienteOutput]
    ventas_pendientes_entrega: List[DashboardVentaPendienteEntregaOutput]
    alertas_operativas: List[DashboardAlertaOperativaOutput]
