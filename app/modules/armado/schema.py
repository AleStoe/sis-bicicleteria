from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ArmadoModeloCreateInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoModeloUpdateInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoEstadoInput(BaseModel):
    activo: bool
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoModeloOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime
    versiones: int = 0
    versiones_activas: int = 0
    costo_estimado_min: Optional[Decimal] = None
    costo_estimado_max: Optional[Decimal] = None


class ArmadoVersionCreateInput(BaseModel):
    id_modelo: int = Field(gt=0)
    nombre: str = Field(min_length=1, max_length=120)
    id_variante_final: int = Field(gt=0)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoVersionUpdateInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    id_variante_final: int = Field(gt=0)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoVersionOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_modelo: int
    modelo_nombre: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    id_variante_final: int
    variante_final_nombre: Optional[str] = None
    producto_final_nombre: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime
    configuraciones: int = 0
    configuracion_activa_id: Optional[int] = None
    configuracion_activa_revision: Optional[int] = None
    costo_estimado: Optional[Decimal] = None
    precio_objetivo: Optional[Decimal] = None
    margen_estimado: Optional[Decimal] = None
    cantidad_fabricable_estimada: Optional[Decimal] = None


class ArmadoConfiguracionCreateInput(BaseModel):
    id_version: int = Field(gt=0)
    nombre: str = Field(default="Configuracion tecnica", min_length=1, max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoConfiguracionUpdateInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoConfiguracionDuplicarInput(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoConfiguracionItemInput(BaseModel):
    id_variante_componente: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0)
    orden: int = Field(default=0, ge=0)
    nota: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoConfiguracionItemOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_configuracion: int
    id_variante_componente: int
    producto_nombre: str
    nombre_variante: str
    sku: Optional[str] = None
    codigo_proveedor: Optional[str] = None
    categoria_nombre: Optional[str] = None
    grupo_tecnico: Optional[str] = None
    cantidad: Decimal
    costo_unitario_estimado: Optional[Decimal] = None
    subtotal_estimado: Optional[Decimal] = None
    origen_costo: str
    costo_disponible: bool = True
    costo_cero: bool = False
    orden: int
    nota: Optional[str] = None


class ArmadoConfiguracionOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_version: int
    version_nombre: Optional[str] = None
    modelo_nombre: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    numero_revision: int
    estado: str
    id_configuracion_origen: Optional[int] = None
    costo_estimado_total: Decimal
    created_at: datetime
    updated_at: datetime
    items: list[ArmadoConfiguracionItemOutput] = Field(default_factory=list)


class ArmadoCostoAdicionalInput(BaseModel):
    monto: Decimal = Field(ge=0)
    descripcion: Optional[str] = Field(default=None, max_length=200)


class ArmadoSimulacionComponenteInput(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0)
    grupo_tecnico: Optional[str] = Field(default=None, max_length=80)
    opcional: bool = False


class ArmadoSimulacionInput(BaseModel):
    id_configuracion: Optional[int] = Field(default=None, gt=0)
    id_sucursal: int = Field(gt=0)
    componentes: Optional[list[ArmadoSimulacionComponenteInput]] = None
    costo_mano_obra: Decimal = Field(default=Decimal("0"), ge=0)
    costo_consumibles_no_inventariados: Decimal = Field(default=Decimal("0"), ge=0)
    costo_trabajos_externos: Decimal = Field(default=Decimal("0"), ge=0)
    otros_costos: Decimal = Field(default=Decimal("0"), ge=0)
    precio_comercial: Optional[Decimal] = Field(default=None, gt=0)
    margen_objetivo: Optional[Decimal] = Field(default=None, ge=0, lt=100)


class ArmadoSimulacionComponenteOutput(BaseModel):
    id_variante: int
    producto_nombre: Optional[str] = None
    nombre_variante: Optional[str] = None
    sku: Optional[str] = None
    categoria_nombre: Optional[str] = None
    grupo_tecnico: str
    cantidad: Decimal
    opcional: bool
    costo_unitario_estimado: Optional[Decimal] = None
    subtotal_estimado: Optional[Decimal] = None
    origen_costo: str
    costo_disponible: bool
    costo_cero: bool
    stock_fisico: Optional[Decimal] = None
    stock_reservado: Optional[Decimal] = None
    stock_vendido_pendiente: Optional[Decimal] = None
    stock_disponible: Optional[Decimal] = None
    stock_calculable: bool
    cantidad_fabricable_por_componente: Optional[Decimal] = None
    estado_costo: str
    estado_disponibilidad: str
    producto_activo: bool
    variante_activa: bool
    advertencias: list[str] = Field(default_factory=list)


class ArmadoPrecioEscenarioOutput(BaseModel):
    margen_objetivo: Decimal
    precio_matematico: Optional[Decimal] = None
    precio_redondeado_sugerido: Optional[Decimal] = None


class ArmadoSimulacionOutput(BaseModel):
    id_configuracion: Optional[int] = None
    id_sucursal: int
    sucursal_nombre: Optional[str] = None
    componentes: list[ArmadoSimulacionComponenteOutput]
    costo_componentes: Decimal
    costo_mano_obra: Decimal
    costo_consumibles_no_inventariados: Decimal
    costo_trabajos_externos: Decimal
    otros_costos: Decimal
    costo_total: Decimal
    costo_total_parcial: Decimal
    calculo_completo: bool
    precio_comercial: Optional[Decimal] = None
    margen_objetivo: Optional[Decimal] = None
    precio_sugerido: Optional[Decimal] = None
    utilidad_estimada: Optional[Decimal] = None
    margen_sobre_venta: Optional[Decimal] = None
    markup_sobre_costo: Optional[Decimal] = None
    diferencia_precio_comercial_vs_sugerido: Optional[Decimal] = None
    escenarios: list[ArmadoPrecioEscenarioOutput] = Field(default_factory=list)
    cantidad_fabricable: Optional[Decimal] = None
    componente_limitante: Optional[ArmadoSimulacionComponenteOutput] = None
    advertencias: list[str]


class ArmadoOrdenCreateInput(BaseModel):
    id_configuracion: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    talle: Optional[str] = Field(default=None, max_length=80)
    color: Optional[str] = Field(default=None, max_length=120)
    numero_cuadro: Optional[str] = Field(default=None, max_length=120)
    descripcion_final: Optional[str] = Field(default=None, max_length=1000)
    id_usuario_responsable: Optional[int] = Field(default=None, gt=0)
    precio_objetivo: Optional[Decimal] = Field(default=None, ge=0)
    margen_objetivo: Optional[Decimal] = Field(default=None, ge=0, lt=100)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenUpdateInput(BaseModel):
    talle: Optional[str] = Field(default=None, max_length=80)
    color: Optional[str] = Field(default=None, max_length=120)
    numero_cuadro: Optional[str] = Field(default=None, max_length=120)
    descripcion_final: Optional[str] = Field(default=None, max_length=1000)
    id_usuario_responsable: Optional[int] = Field(default=None, gt=0)
    precio_objetivo: Optional[Decimal] = Field(default=None, ge=0)
    margen_objetivo: Optional[Decimal] = Field(default=None, ge=0, lt=100)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenSustitucionInput(BaseModel):
    id_variante_utilizada: int = Field(gt=0)
    cantidad_utilizada: Decimal = Field(gt=0)
    motivo_sustitucion: str = Field(min_length=3, max_length=1000)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenCostoInput(BaseModel):
    tipo: str = Field(pattern="^(mano_obra|consumible_no_inventariado|trabajo_externo|otro)$")
    descripcion: str = Field(min_length=1, max_length=220)
    cantidad: Decimal = Field(default=Decimal("1"), gt=0)
    costo_unitario: Decimal = Field(ge=0)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenEstadoInput(BaseModel):
    estado: str = Field(pattern="^(borrador|pendiente_componentes|lista_para_armar|cancelada)$")
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenCancelarInput(BaseModel):
    motivo_cancelacion: str = Field(min_length=3, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenAccionInput(BaseModel):
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenVolverArmadoInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenControlInput(BaseModel):
    codigo_control: str = Field(min_length=1, max_length=80)
    aprobado: bool
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenCostoFinalInput(BaseModel):
    costo_unitario_final: Decimal = Field(ge=0)
    id_usuario: int | None = Field(default=None, gt=0)


class ArmadoOrdenItemOutput(BaseModel):
    id: int
    id_orden: int
    id_configuracion_item_origen: Optional[int] = None
    grupo: Optional[str] = None
    id_variante_prevista: int
    id_variante_utilizada: int
    producto_previsto_nombre: Optional[str] = None
    variante_prevista_nombre: Optional[str] = None
    producto_utilizado_nombre: Optional[str] = None
    variante_utilizada_nombre: Optional[str] = None
    cantidad_prevista: Decimal
    cantidad_utilizada: Decimal
    costo_unitario_previsto: Optional[Decimal] = None
    subtotal_previsto: Optional[Decimal] = None
    cantidad_consumida: Decimal = Decimal("0")
    costo_unitario_real: Optional[Decimal] = None
    subtotal_real: Optional[Decimal] = None
    id_movimiento_consumo: Optional[int] = None
    id_movimiento_reversion: Optional[int] = None
    fecha_consumo: Optional[datetime] = None
    fecha_reversion: Optional[datetime] = None
    es_sustitucion: bool
    motivo_sustitucion: Optional[str] = None
    observaciones: Optional[str] = None
    estado: str
    stock_fisico: Optional[Decimal] = None
    stock_reservado: Optional[Decimal] = None
    stock_vendido_pendiente: Optional[Decimal] = None
    stock_disponible: Optional[Decimal] = None
    estado_disponibilidad: Optional[str] = None


class ArmadoOrdenCostoOutput(BaseModel):
    id: int
    id_orden: int
    tipo: str
    descripcion: str
    cantidad: Decimal
    costo_unitario: Decimal
    total: Decimal
    costo_unitario_final: Optional[Decimal] = None
    total_final: Optional[Decimal] = None
    fecha_confirmacion_final: Optional[datetime] = None
    id_usuario_confirmacion_final: Optional[int] = None
    observaciones: Optional[str] = None


class ArmadoOrdenControlOutput(BaseModel):
    id: Optional[int] = None
    id_orden: Optional[int] = None
    codigo_control: str
    aprobado: bool = False
    observaciones: Optional[str] = None
    id_usuario: Optional[int] = None
    fecha_control: Optional[datetime] = None


class ArmadoOrdenOutput(BaseModel):
    id: int
    codigo: str
    id_modelo: int
    modelo_nombre: Optional[str] = None
    id_version: int
    version_nombre: Optional[str] = None
    id_configuracion: int
    configuracion_nombre: Optional[str] = None
    configuracion_revision: Optional[int] = None
    id_sucursal: int
    sucursal_nombre: Optional[str] = None
    estado: str
    talle: Optional[str] = None
    color: Optional[str] = None
    numero_cuadro: Optional[str] = None
    descripcion_final: Optional[str] = None
    id_usuario_responsable: Optional[int] = None
    responsable_nombre: Optional[str] = None
    costo_componentes_previsto: Decimal
    costo_adicional_previsto: Decimal
    costo_total_previsto: Decimal
    costo_componentes_real: Decimal = Decimal("0")
    costo_total_real: Decimal = Decimal("0")
    desvio_componentes: Decimal = Decimal("0")
    id_bicicleta_serializada_resultante: Optional[int] = None
    costo_componentes_final: Decimal = Decimal("0")
    costo_adicional_final: Decimal = Decimal("0")
    costo_fabricacion_final: Decimal = Decimal("0")
    desvio_total: Decimal = Decimal("0")
    precio_objetivo: Optional[Decimal] = None
    margen_objetivo: Optional[Decimal] = None
    utilidad_prevista: Optional[Decimal] = None
    margen_previsto: Optional[Decimal] = None
    markup_previsto: Optional[Decimal] = None
    calculo_completo: bool = True
    cantidad_fabricable: Optional[Decimal] = None
    observaciones: Optional[str] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime
    fecha_inicio: Optional[datetime] = None
    id_usuario_inicio: Optional[int] = None
    fecha_control_final: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    id_usuario_control_final: Optional[int] = None
    id_usuario_finalizacion: Optional[int] = None
    fecha_cancelacion: Optional[datetime] = None
    motivo_cancelacion: Optional[str] = None
    id_usuario_cancelacion: Optional[int] = None
    items: list[ArmadoOrdenItemOutput] = Field(default_factory=list)
    costos: list[ArmadoOrdenCostoOutput] = Field(default_factory=list)
    controles: list[ArmadoOrdenControlOutput] = Field(default_factory=list)
    advertencias: list[str] = Field(default_factory=list)


class ArmadoOrdenFichaTecnicaOutput(BaseModel):
    id_orden: int
    codigo: str
    modelo_nombre: Optional[str] = None
    version_nombre: Optional[str] = None
    configuracion_revision: Optional[int] = None
    id_bicicleta_serializada: int
    id_variante_final: int
    producto_final_nombre: Optional[str] = None
    variante_final_nombre: Optional[str] = None
    talle: Optional[str] = None
    color: Optional[str] = None
    numero_cuadro: str
    fecha_fabricacion: Optional[datetime] = None
    responsable_nombre: Optional[str] = None
    costo_componentes_final: Decimal
    costo_adicional_final: Decimal
    costo_fabricacion_final: Decimal
    desvio_total: Decimal
    componentes: list[ArmadoOrdenItemOutput] = Field(default_factory=list)
    costos: list[ArmadoOrdenCostoOutput] = Field(default_factory=list)
