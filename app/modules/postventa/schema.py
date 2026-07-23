from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


PostventaEstado = Literal[
    "abierto",
    "en_evaluacion",
    "esperando_proveedor",
    "decision_pendiente",
    "aprobado_total",
    "aprobado_parcial",
    "rechazado",
    "en_resolucion",
    "esperando_retiro",
    "resuelto",
    "cerrado",
    "cancelado",
    "reabierto",
]

PostventaTipoCaso = Literal[
    "service_postventa",
    "garantia_fabrica",
    "garantia_local",
    "reclamo_tecnico",
    "atencion_comercial",
    "devolucion_cambio",
    "revision",
]

PostventaPrioridad = Literal["baja", "normal", "alta", "urgente"]


class PostventaCasoCreateInput(BaseModel):
    tipo_caso: PostventaTipoCaso
    id_cliente: int = Field(gt=0)
    motivo_cliente: str = Field(min_length=1, max_length=4000)
    prioridad: PostventaPrioridad = "normal"
    id_venta_origen: Optional[int] = Field(default=None, gt=0)
    id_venta_item_origen: Optional[int] = Field(default=None, gt=0)
    id_bicicleta_cliente: Optional[int] = Field(default=None, gt=0)
    id_bicicleta_serializada: Optional[int] = Field(default=None, gt=0)
    id_variante: Optional[int] = Field(default=None, gt=0)
    id_proveedor: Optional[int] = Field(default=None, gt=0)
    observaciones: Optional[str] = Field(default=None, max_length=4000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaCasoUpdateInput(BaseModel):
    prioridad: Optional[PostventaPrioridad] = None
    motivo_cliente: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    evaluacion_tecnica: Optional[str] = Field(default=None, max_length=4000)
    causa_determinada: Optional[str] = Field(default=None, max_length=4000)
    decision_proveedor: Optional[str] = Field(default=None, max_length=40)
    detalle_decision_proveedor: Optional[str] = Field(default=None, max_length=4000)
    monto_reconocido_proveedor: Optional[Decimal] = Field(default=None, ge=0)
    decision_local: Optional[str] = Field(default=None, max_length=40)
    detalle_decision_local: Optional[str] = Field(default=None, max_length=4000)
    cobertura_tipo: Optional[str] = Field(default=None, max_length=40)
    responsable_economico: Optional[str] = Field(default=None, max_length=40)
    monto_cubierto_proveedor: Optional[Decimal] = Field(default=None, ge=0)
    monto_cubierto_local: Optional[Decimal] = Field(default=None, ge=0)
    monto_a_cargo_cliente: Optional[Decimal] = Field(default=None, ge=0)
    resolucion_aplicada: Optional[str] = Field(default=None, max_length=4000)
    resultado_final: Optional[str] = Field(default=None, max_length=4000)
    observaciones: Optional[str] = Field(default=None, max_length=4000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaEstadoInput(BaseModel):
    nuevo_estado: PostventaEstado
    motivo: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaCerrarInput(BaseModel):
    resultado_final: str = Field(min_length=1, max_length=4000)
    resolucion_aplicada: str = Field(min_length=1, max_length=4000)
    observaciones: Optional[str] = Field(default=None, max_length=4000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaReabrirInput(BaseModel):
    motivo: str = Field(min_length=1, max_length=1000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaVincularOrdenInput(BaseModel):
    id_orden_taller: int = Field(gt=0)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaCrearOrdenTallerInput(BaseModel):
    id_sucursal: int = Field(gt=0)
    problema_reportado: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    fecha_prometida: Optional[datetime] = None
    prioridad: Literal["normal", "urgente"] = "normal"
    observaciones_vinculo: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: Optional[int] = Field(default=None, gt=0)


class PostventaEventoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_caso_postventa: int
    fecha: datetime
    tipo_evento: str
    detalle: Optional[str] = None
    metadata: Optional[dict] = None
    id_usuario: int


class PostventaOrdenTallerVinculadaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_caso_postventa: int
    id_orden_taller: int
    fecha_vinculacion: datetime
    id_usuario: int
    observaciones: Optional[str] = None
    estado: str
    problema_reportado: str
    total_final: Decimal
    saldo_pendiente: Decimal
    fecha_ingreso: datetime
    id_cliente: int
    cliente_nombre: Optional[str] = None
    id_bicicleta_cliente: int
    bicicleta_cliente_descripcion: Optional[str] = None


class PostventaCasoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    estado: str
    tipo_caso: str
    prioridad: str
    id_cliente: int
    cliente_nombre: Optional[str] = None
    id_venta_origen: Optional[int] = None
    id_venta_item_origen: Optional[int] = None
    id_bicicleta_cliente: Optional[int] = None
    bicicleta_cliente_descripcion: Optional[str] = None
    id_bicicleta_serializada: Optional[int] = None
    bicicleta_numero_cuadro: Optional[str] = None
    id_variante: Optional[int] = None
    variante_descripcion: Optional[str] = None
    id_proveedor: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    motivo_cliente: str
    evaluacion_tecnica: Optional[str] = None
    causa_determinada: Optional[str] = None
    decision_proveedor: Optional[str] = None
    detalle_decision_proveedor: Optional[str] = None
    monto_reconocido_proveedor: Decimal
    decision_local: Optional[str] = None
    detalle_decision_local: Optional[str] = None
    cobertura_tipo: Optional[str] = None
    responsable_economico: Optional[str] = None
    monto_cubierto_proveedor: Decimal
    monto_cubierto_local: Decimal
    monto_a_cargo_cliente: Decimal
    resolucion_aplicada: Optional[str] = None
    resultado_final: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    id_usuario_creador: int
    id_usuario_cierre: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    eventos: list[PostventaEventoOutput] = Field(default_factory=list)
