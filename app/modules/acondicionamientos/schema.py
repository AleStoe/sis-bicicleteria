from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class AcondicionamientoCreateInput(BaseModel):
    id_bicicleta_serializada: int = Field(gt=0)
    motivo: str = Field(min_length=3, max_length=500)
    observaciones: str | None = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class AcondicionamientoItemCreateInput(BaseModel):
    tipo_intervencion: str = Field(
        pattern="^(reemplazo|mejora|agregado_incluido)$"
    )
    id_variante: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0)
    detalle_pieza_retirada: str | None = Field(default=None, max_length=500)
    destino_pieza_retirada: str | None = Field(
        default=None, pattern="^(descarte|garantia|recuperable)$"
    )
    observaciones: str | None = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class AcondicionamientoCostoCreateInput(BaseModel):
    tipo: str = Field(
        pattern="^(mano_obra|consumible_no_inventariado|trabajo_externo|otro)$"
    )
    descripcion: str = Field(min_length=2, max_length=300)
    cantidad: Decimal = Field(default=Decimal("1"), gt=0)
    costo_unitario: Decimal = Field(ge=0)
    observaciones: str | None = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class AcondicionamientoAccionInput(BaseModel):
    motivo: str | None = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class AcondicionamientoAplicarInput(AcondicionamientoAccionInput):
    actualizar_precio_venta: bool = False
    precio_venta_nuevo: Decimal | None = Field(default=None, gt=0)


class AcondicionamientoPiezaRetiradaInput(BaseModel):
    estado: str = Field(
        pattern="^(pendiente|descartada|en_garantia|compensada|recuperada)$"
    )
    resolucion: str | None = Field(default=None, max_length=500)
    id_usuario: int | None = Field(default=None, gt=0)


class AcondicionamientoRecuperoCreateInput(BaseModel):
    tipo: str = Field(pattern="^(nota_credito|garantia|recupero|otro)$")
    descripcion: str = Field(min_length=2, max_length=300)
    monto: Decimal = Field(gt=0)
    referencia: str | None = Field(default=None, max_length=150)
    observaciones: str | None = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class AcondicionamientoItemOutput(BaseModel):
    id: int
    id_acondicionamiento: int
    tipo_intervencion: str
    id_variante: int
    producto_nombre_snapshot: str
    variante_nombre_snapshot: str | None = None
    sku_snapshot: str | None = None
    cantidad: Decimal
    costo_unitario_estimado: Decimal
    subtotal_estimado: Decimal = Decimal("0")
    stock_disponible_snapshot: Decimal
    stock_disponible_actual: Decimal = Decimal("0")
    disponibilidad_suficiente: bool = False
    detalle_pieza_retirada: str | None = None
    destino_pieza_retirada: str | None = None
    estado_pieza_retirada: str | None = None
    resolucion_pieza_retirada: str | None = None
    fecha_resolucion_pieza_retirada: datetime | None = None
    id_usuario_resolucion_pieza_retirada: int | None = None
    observaciones: str | None = None
    estado: str = "pendiente"
    cantidad_consumida: Decimal = Decimal("0")
    costo_unitario_real: Decimal | None = None
    subtotal_real: Decimal | None = None
    id_movimiento_consumo: int | None = None
    id_movimiento_reversion: int | None = None
    fecha_consumo: datetime | None = None
    fecha_reversion: datetime | None = None
    created_at: datetime


class AcondicionamientoCostoOutput(BaseModel):
    id: int
    id_acondicionamiento: int
    tipo: str
    descripcion: str
    cantidad: Decimal
    costo_unitario: Decimal
    total: Decimal = Decimal("0")
    observaciones: str | None = None
    costo_unitario_real: Decimal | None = None
    total_real: Decimal | None = None
    fecha_aplicacion: datetime | None = None
    created_at: datetime


class AcondicionamientoRecuperoOutput(BaseModel):
    id: int
    id_acondicionamiento: int
    tipo: str
    descripcion: str
    monto: Decimal
    referencia: str | None = None
    observaciones: str | None = None
    id_usuario: int | None = None
    created_at: datetime


class AcondicionamientoEventoOutput(BaseModel):
    id: int
    id_acondicionamiento: int
    accion: str
    detalle: str | None = None
    metadata: dict
    id_usuario: int | None = None
    usuario_nombre: str | None = None
    fecha: datetime


class AcondicionamientoOutput(BaseModel):
    id: int
    codigo: str
    id_bicicleta_serializada: int
    id_sucursal: int
    estado: str
    estado_tecnico_anterior: str
    motivo: str
    observaciones: str | None = None
    numero_cuadro: str
    producto_nombre: str
    variante_nombre: str | None = None
    sku: str | None = None
    sucursal_nombre: str | None = None
    id_usuario_creador: int | None = None
    id_usuario_confirmacion: int | None = None
    id_usuario_reversion: int | None = None
    fecha_creacion: datetime
    fecha_confirmacion: datetime | None = None
    fecha_reversion: datetime | None = None
    fecha_aplicacion: datetime | None = None
    id_usuario_aplicacion: int | None = None
    motivo_reversion: str | None = None
    total_componentes_estimado: Decimal = Decimal("0")
    total_costos_adicionales: Decimal = Decimal("0")
    total_bruto_estimado: Decimal = Decimal("0")
    total_recuperos_estimado: Decimal = Decimal("0")
    total_estimado: Decimal = Decimal("0")
    puede_confirmar: bool = False
    puede_aplicar: bool = False
    costo_componentes_real: Decimal = Decimal("0")
    costo_adicional_real: Decimal = Decimal("0")
    recuperos_total: Decimal = Decimal("0")
    costo_acondicionamiento_aplicado: Decimal = Decimal("0")
    costo_total_unidad_anterior: Decimal | None = None
    costo_total_unidad_nuevo: Decimal | None = None
    precio_variante: Decimal = Decimal("0")
    precio_venta_personalizado: Decimal | None = None
    precio_venta_actual: Decimal = Decimal("0")
    precio_venta_actualizado: bool = False
    precio_venta_personalizado_anterior: Decimal | None = None
    precio_venta_personalizado_nuevo: Decimal | None = None
    advertencias: list[str] = Field(default_factory=list)
    items: list[AcondicionamientoItemOutput] = Field(default_factory=list)
    costos: list[AcondicionamientoCostoOutput] = Field(default_factory=list)
    recuperos: list[AcondicionamientoRecuperoOutput] = Field(default_factory=list)
    historial: list[AcondicionamientoEventoOutput] = Field(default_factory=list)
