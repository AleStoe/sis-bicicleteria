from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class PrecioListaItemOut(BaseModel):
    id: int
    numero_fila: int
    valores_originales: list[Any]
    linea_original: str | None = None
    codigo_original: str | None = None
    descripcion_original: str | None = None
    costo_original: str | None = None
    cantidad_original: str | None = None
    moneda_original: str | None = None
    estado: str
    codigo_normalizado: str | None = None
    estado_coincidencia: str = "pendiente"
    id_variante: int | None = None
    origen_coincidencia: str | None = None
    confianza_coincidencia: float | None = None
    candidatos: list[dict[str, Any]] = Field(default_factory=list)
    mensaje_coincidencia: str | None = None
    coincidencia_confirmada: bool = False
    variante_producto_nombre: str | None = None
    variante_nombre: str | None = None
    variante_sku: str | None = None
    variante_ean: str | None = None
    costo_reposicion_anterior_snapshot: Decimal | None = None
    costo_reposicion_nuevo: Decimal | None = None
    costo_variacion_pct: Decimal | None = None
    precio_minorista_anterior_snapshot: Decimal | None = None
    precio_mayorista_anterior_snapshot: Decimal | None = None
    precio_minorista_propuesto: Decimal | None = None
    precio_mayorista_propuesto: Decimal | None = None
    margen_minorista_anterior_pct: Decimal | None = None
    margen_mayorista_anterior_pct: Decimal | None = None
    margen_minorista_resultante_pct: Decimal | None = None
    margen_mayorista_resultante_pct: Decimal | None = None
    estrategia_minorista: str | None = None
    estrategia_mayorista: str | None = None
    descuento_minorista_snapshot: Decimal | None = None
    descuento_mayorista_snapshot: Decimal | None = None
    redondeo_minorista_snapshot: Decimal | None = None
    redondeo_mayorista_snapshot: Decimal | None = None
    regla_minorista_snapshot: dict[str, Any] | None = None
    regla_mayorista_snapshot: dict[str, Any] | None = None
    oferta_vigente_snapshot: dict[str, Any] | None = None
    permite_precio_libre_snapshot: bool = False
    precio_libre_confirmado: bool = False
    alertas_preview: list[dict[str, Any]] = Field(default_factory=list)
    explicacion_preview: dict[str, Any] = Field(default_factory=dict)
    seleccionado_aplicar: bool = True
    preview_valido: bool = False
    preview_generado_at: datetime | None = None
    precio_movimiento_aplicacion_id: int | None = None
    precio_movimiento_reversion_id: int | None = None
    aplicado_at: datetime | None = None
    revertido_at: datetime | None = None


class PrecioListaDocumentoOut(BaseModel):
    id: int
    nombre_original: str
    ruta_relativa: str
    mime_type: str | None = None
    extension: str
    tamano_bytes: int
    sha256: str
    extractor: str
    metadata_lectura: dict[str, Any]


class PrecioListaLoteResumenOut(BaseModel):
    id: int
    id_proveedor: int
    proveedor_nombre_snapshot: str
    estado: str
    nombre_archivo: str
    formato: str
    hoja_detectada: str | None = None
    fila_encabezado_detectada: int | None = None
    total_filas: int
    id_perfil: int | None = None
    preview_generado_at: datetime | None = None
    estrategia_preview: str | None = None
    alerta_variacion_pct: Decimal | None = None
    descuento_minorista_pct: Decimal | None = None
    descuento_mayorista_pct: Decimal | None = None
    redondeo_minorista: Decimal | None = None
    redondeo_mayorista: Decimal | None = None
    preview_version: int = 0
    aplicado_at: datetime | None = None
    aplicado_por: int | None = None
    preview_version_aplicada: int | None = None
    revertido_at: datetime | None = None
    revertido_por: int | None = None
    motivo_reversion: str | None = None
    created_at: datetime
    updated_at: datetime


class PrecioListaLoteDetalleOut(PrecioListaLoteResumenOut):
    proveedor_nombre: str
    delimitador_detectado: str | None = None
    codificacion_detectada: str | None = None
    encabezados: list[Any]
    mapeo_detectado: dict[str, Any]
    observaciones: str | None = None
    error_lectura: str | None = None
    motivo_anulacion: str | None = None
    documento: PrecioListaDocumentoOut
    items: list[PrecioListaItemOut]
    resumen_coincidencias: dict[str, int] = Field(default_factory=dict)


class PrecioListaLoteAnularInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaPerfilCreateInput(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaPerfilOut(BaseModel):
    id: int
    id_proveedor: int
    proveedor_nombre: str | None = None
    nombre: str
    formato: str
    hoja: str | None = None
    fila_encabezado: int
    delimitador: str | None = None
    codificacion: str | None = None
    mapeo_columnas: dict[str, Any]
    activo: bool
    created_at: datetime
    updated_at: datetime


class PrecioListaCoincidenciasProcesarInput(BaseModel):
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaItemVincularInput(BaseModel):
    id_variante: int = Field(gt=0)
    recordar_alias: bool = True
    reemplazar_alias: bool = False
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaItemDesvincularInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int | None = Field(default=None, gt=0)


PrecioEstrategia = Literal[
    "conservar_margen", "usar_regla", "mantener_precio", "manual", "ignorar"
]


class PrecioListaPreviewInput(BaseModel):
    estrategia: PrecioEstrategia = "conservar_margen"
    descuento_minorista_pct: Decimal = Field(default=10, ge=0, lt=100)
    descuento_mayorista_pct: Decimal = Field(default=0, ge=0, lt=100)
    redondeo_minorista: Decimal = Field(default=100, gt=0)
    redondeo_mayorista: Decimal = Field(default=100, gt=0)
    alerta_variacion_pct: Decimal = Field(default=10, ge=0)
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaItemPreviewInput(BaseModel):
    estrategia_minorista: PrecioEstrategia
    estrategia_mayorista: PrecioEstrategia
    precio_minorista_manual: Decimal | None = Field(default=None, gt=0)
    precio_mayorista_manual: Decimal | None = Field(default=None, gt=0)
    seleccionado_aplicar: bool = True
    confirmar_precio_libre: bool = False
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaAplicarInput(BaseModel):
    preview_version: int = Field(gt=0)
    id_usuario: int | None = Field(default=None, gt=0)


class PrecioListaRevertirInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int | None = Field(default=None, gt=0)
