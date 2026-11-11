from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class RecepcionTablaImportInput(BaseModel):
    id_proveedor: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    texto: str = Field(min_length=1, max_length=200_000)
    observaciones: str | None = Field(default=None, max_length=2000)
    origen_carga: str = Field(default="tabla_pegada", pattern="^(tabla_pegada|csv)$")
    id_usuario: int | None = None


class RecepcionItemAltaInput(BaseModel):
    nombre_propuesto: str = Field(min_length=2, max_length=250)
    nombre_variante_propuesta: str = Field(default="UNICA", min_length=1, max_length=120)
    rubro_propuesto: str = Field(min_length=2, max_length=80)
    id_categoria_propuesta: int = Field(gt=0)
    id_marca_propuesta: int | None = Field(default=None, gt=0)
    subtipo_propuesto: str = Field(min_length=2, max_length=80)
    precio_minorista_propuesto: Decimal | None = Field(default=None, ge=0)
    precio_mayorista_propuesto: Decimal | None = Field(default=None, ge=0)
    serializable_propuesto: bool = False
    id_usuario: int | None = None


class RecepcionItemVinculoInput(BaseModel):
    id_variante: int = Field(gt=0)
    id_usuario: int | None = None


class RecepcionItemLecturaInput(BaseModel):
    codigo_proveedor: str = Field(min_length=1, max_length=100)
    descripcion: str = Field(min_length=2, max_length=500)
    cantidad: Decimal = Field(gt=0)
    costo_unitario: Decimal = Field(ge=0)
    descuento_linea_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    id_usuario: int | None = None


class RecepcionItemDescuentoInput(BaseModel):
    id_item: int = Field(gt=0)
    descuento_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    nota_credito_monto: Decimal = Field(default=Decimal("0"), ge=0)


class RecepcionCostosInput(BaseModel):
    descuento_global_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    bonificacion_factura: Decimal = Field(default=Decimal("0"), ge=0)
    nota_credito: Decimal = Field(default=Decimal("0"), ge=0)
    nota_credito_modo: str = Field(default="global", pattern="^(global|lineas)$")
    flete: Decimal = Field(default=Decimal("0"), ge=0)
    iva_factura: Decimal = Field(default=Decimal("0"), ge=0)
    otros_gastos: Decimal = Field(default=Decimal("0"), ge=0)
    impuestos_no_recuperables: Decimal = Field(default=Decimal("0"), ge=0)
    total_documental: Decimal | None = Field(default=None, ge=0)
    descuentos_linea: list[RecepcionItemDescuentoInput] = Field(default_factory=list)
    id_usuario: int | None = None


class RecepcionConfirmarInput(BaseModel):
    confirmacion: str = Field(pattern="^CONFIRMAR$")
    id_usuario: int | None = None


class RecepcionPreciosPreviewInput(BaseModel):
    estrategia: str = Field(pattern="^(reglas|mantener_margen|mantener_actuales)$")
    variacion_alerta_pct: Decimal = Field(default=Decimal("10"), ge=0, le=1000)
    redondeo_base: Decimal = Field(default=Decimal("100"), gt=0)
    descuento_minorista_pct: Decimal = Field(default=Decimal("10"), ge=0, lt=100)
    descuento_mayorista_pct: Decimal = Field(default=Decimal("0"), ge=0, lt=100)
    redondeo_minorista: Decimal | None = Field(default=None, gt=0)
    redondeo_mayorista: Decimal | None = Field(default=None, gt=0)
    confirmar_precio_libre: bool = False
    id_usuario: int | None = None


class RecepcionItemPrecioSugerenciaInput(BaseModel):
    rubro: str | None = Field(default=None, max_length=80)
    id_categoria: int | None = Field(default=None, gt=0)
    id_marca: int | None = Field(default=None, gt=0)
    redondeo_base: Decimal = Field(default=Decimal("100"), gt=0)


class RecepcionItemPrecioSugerenciaOut(BaseModel):
    costo_unitario: Decimal
    precio_minorista_sugerido: Decimal
    precio_mayorista_sugerido: Decimal
    margen_minorista_pct: Decimal | None = None
    margen_mayorista_pct: Decimal | None = None
    regla_minorista: str | None = None
    regla_mayorista: str | None = None


class RecepcionItemPrecioInput(BaseModel):
    precio_minorista: Decimal = Field(gt=0)
    precio_mayorista: Decimal = Field(gt=0)
    id_usuario: int | None = None


class RecepcionDeshacerCoincidenciaInput(BaseModel):
    id_usuario: int | None = None


class RecepcionAnularInput(BaseModel):
    motivo: str = Field(min_length=5, max_length=500)
    id_usuario: int | None = None


class RecepcionAccionInput(BaseModel):
    id_usuario: int | None = None


class RecepcionReglaResolverInput(BaseModel):
    decision: str = Field(pattern="^(aceptada|descartada)$")
    nota: str | None = Field(default=None, max_length=500)
    id_usuario: int | None = None


class RecepcionClasificacionMasivaInput(BaseModel):
    ids_items: list[int] = Field(min_length=1, max_length=500)
    rubro_propuesto: str = Field(min_length=2, max_length=80)
    id_categoria_propuesta: int = Field(gt=0)
    id_marca_propuesta: int | None = Field(default=None, gt=0)
    subtipo_propuesto: str = Field(min_length=2, max_length=80)
    id_usuario: int | None = None


class RecepcionCostosOut(BaseModel):
    descuento_global_pct: Decimal = Decimal("0")
    bonificacion_factura: Decimal = Decimal("0")
    nota_credito: Decimal = Decimal("0")
    nota_credito_modo: str = "global"
    flete: Decimal = Decimal("0")
    iva_factura: Decimal = Decimal("0")
    otros_gastos: Decimal = Decimal("0")
    impuestos_no_recuperables: Decimal = Decimal("0")
    total_documental: Decimal | None = None
    subtotal_bruto: Decimal = Decimal("0")
    descuento_lineas_total: Decimal = Decimal("0")
    descuento_global_monto: Decimal = Decimal("0")
    total_calculado: Decimal = Decimal("0")
    diferencia_conciliacion: Decimal | None = None
    conciliado: bool = False


class RecepcionItemOut(BaseModel):
    id: int
    numero_linea: int
    linea_original: str
    codigo_proveedor: str | None = None
    descripcion_original: str | None = None
    descripcion_normalizada: str | None = None
    cantidad: Decimal | None = None
    costo_unitario: Decimal | None = None
    costo_total: Decimal | None = None
    total_linea_documental: Decimal | None = None
    estado_resolucion: str
    id_variante: int | None = None
    producto_nombre: str | None = None
    variante_nombre: str | None = None
    mensaje_revision: str | None = None
    nombre_propuesto: str | None = None
    nombre_variante_propuesta: str | None = None
    rubro_propuesto: str | None = None
    id_categoria_propuesta: int | None = None
    categoria_propuesta_nombre: str | None = None
    id_marca_propuesta: int | None = None
    marca_propuesta_nombre: str | None = None
    subtipo_propuesto: str | None = None
    sku_propuesto: str | None = None
    confianza_sugerencia: str | None = None
    descuento_linea_pct: Decimal = Decimal("0")
    nota_credito_linea_monto: Decimal = Decimal("0")
    importe_bruto: Decimal | None = None
    descuento_linea_monto: Decimal | None = None
    base_prorrateo: Decimal | None = None
    prorrateo_descuento_global: Decimal | None = None
    prorrateo_bonificacion_factura: Decimal | None = None
    prorrateo_nota_credito: Decimal | None = None
    prorrateo_gastos: Decimal | None = None
    costo_total_calculado: Decimal | None = None
    costo_unitario_calculado: Decimal | None = None
    precio_minorista_propuesto: Decimal | None = None
    precio_mayorista_propuesto: Decimal | None = None
    serializable_propuesto: bool = False
    id_producto_confirmado: int | None = None
    id_variante_confirmada: int | None = None
    id_ingreso_stock: int | None = None
    origen_extraccion: str = "estructurado"
    confianza_codigo: Decimal | None = None
    confianza_descripcion: Decimal | None = None
    confianza_cantidad: Decimal | None = None
    confianza_costo: Decimal | None = None
    lectura_confirmada: bool = True
    estrategia_precio: str | None = None
    costo_anterior_snapshot: Decimal | None = None
    precio_minorista_anterior_snapshot: Decimal | None = None
    precio_mayorista_anterior_snapshot: Decimal | None = None
    margen_minorista_anterior_pct: Decimal | None = None
    margen_mayorista_anterior_pct: Decimal | None = None
    margen_minorista_resultante_pct: Decimal | None = None
    margen_mayorista_resultante_pct: Decimal | None = None
    id_regla_minorista: int | None = None
    id_regla_mayorista: int | None = None
    regla_minorista_snapshot: str | None = None
    regla_mayorista_snapshot: str | None = None
    alerta_precio: str | None = None
    precio_revisado: bool = False
    precio_revisado_at: datetime | None = None
    origen_resolucion: str = "reglas"
    id_memoria_clasificacion: int | None = None
    posible_duplicado: bool = False
    duplicado_candidatos: list[dict] = Field(default_factory=list)
    variacion_costo_pct: Decimal | None = None
    alerta_costo: str | None = None
    imagen_ruta_relativa: str | None = None
    imagen_nombre_original: str | None = None
    imagen_mime_type: str | None = None
    imagen_tamano_bytes: int | None = None


class RecepcionAprendizajeOut(BaseModel):
    total_correcciones: int = 0
    coincidencias_automaticas: int = 0
    coincidencias_sugeridas: int = 0
    coincidencias_rechazadas: int = 0
    duplicados_detectados: int = 0
    alertas_costo: int = 0
    duracion_segundos: int | None = None
    sugerencias_regla: list[dict] = Field(default_factory=list)


class RecepcionResumenOut(BaseModel):
    id: int
    id_proveedor: int
    proveedor_nombre_snapshot: str
    id_sucursal: int
    estado: str
    origen_carga: str
    observaciones: str | None = None
    total_lineas: int
    total_unidades: Decimal
    total_costo: Decimal
    exactas: int = 0
    sugeridas: int = 0
    nuevas: int = 0
    altas_preparadas: int = 0
    conflictos: int = 0
    incompletas: int = 0
    created_at: datetime
    updated_at: datetime
    confirmada_at: datetime | None = None
    id_usuario_confirmador: int | None = None
    anulada_at: datetime | None = None
    id_usuario_anulador: int | None = None
    motivo_anulacion: str | None = None


class RecepcionDocumentoOut(BaseModel):
    id: int
    id_recepcion: int
    nombre_original: str
    mime_type: str | None = None
    extension: str
    tamano_bytes: int
    sha256: str
    estado: str
    extractor: str | None = None
    metadata_extraida: dict = Field(default_factory=dict)
    error_extraccion: str | None = None
    tipo_documento: str = "documento"
    numero_documento: str | None = None
    procesado_at: datetime
    cantidad_reprocesos: int = 0
    created_at: datetime


class RecepcionDetalleOut(RecepcionResumenOut):
    texto_origen: str
    id_usuario_creador: int | None = None
    items: list[RecepcionItemOut] = Field(default_factory=list)
    costos: RecepcionCostosOut | None = None
    documentos: list[RecepcionDocumentoOut] = Field(default_factory=list)
    aprendizaje: RecepcionAprendizajeOut | None = None
