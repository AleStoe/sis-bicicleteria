from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class BicicletaSerializadaCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    id_sucursal_actual: int = Field(gt=0)
    numero_cuadro: str = Field(min_length=3, max_length=100)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    id_usuario: int = Field(gt=0)


class BicicletaSerializadaCreateOutput(BaseModel):
    ok: bool
    bicicleta_id: int
    estado: str


class BicicletaSerializadaFichaUpdateInput(BaseModel):
    estado_tecnico: str = Field(
        pattern="^(pendiente_revision|en_acondicionamiento|lista|bloqueada)$"
    )
    condicion_comercial: str = Field(
        pattern="^(normal|reacondicionada|oferta)$"
    )
    ubicacion_fisica: Optional[str] = Field(default=None, max_length=120)
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    texto_comercial: Optional[str] = Field(default=None, max_length=500)
    usar_precio_personalizado: Optional[bool] = None
    precio_venta_personalizado: Optional[Decimal] = Field(default=None, gt=0)
    motivo: str = Field(min_length=3, max_length=1000)
    id_usuario: int = Field(gt=0)


class BicicletaSerializadaCorregirNumeroCuadroInput(BaseModel):
    numero_cuadro: str = Field(min_length=1, max_length=100)
    motivo: str = Field(min_length=1, max_length=1000)


class BicicletaSerializadaCorregirNumeroCuadroOutput(BaseModel):
    ok: bool
    bicicleta_id: int
    numero_cuadro_anterior: str
    numero_cuadro_nuevo: str
    bicicletas_cliente_actualizadas: int = 0


class BicicletaSerializadaCorreccionNumeroCuadroOutput(BaseModel):
    id: int
    fecha: datetime
    usuario_nombre: Optional[str] = None
    usuario_username: Optional[str] = None
    numero_cuadro_anterior: Optional[str] = None
    numero_cuadro_nuevo: Optional[str] = None
    motivo: Optional[str] = None
    origen_accion: Optional[str] = None


class BicicletaSerializadaOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    id_sucursal_actual: int
    numero_cuadro: str
    estado: str
    observaciones: Optional[str] = None


class BicicletaSerializadaDetalleOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_variante: int
    id_sucursal_actual: int
    sucursal_nombre: str
    numero_cuadro: str
    estado: str
    estado_tecnico: str = "lista"
    condicion_comercial: str = "normal"
    ubicacion_fisica: Optional[str] = None
    observaciones: Optional[str] = None
    texto_comercial: Optional[str] = None
    costo_base_unitario: Decimal = Decimal("0")
    costo_base_origen: str = "migracion_costo_promedio"
    costo_acondicionamiento: Decimal = Decimal("0")
    costo_total_unitario: Decimal = Decimal("0")
    fecha_revision_tecnica: Optional[datetime] = None
    id_usuario_revision_tecnica: Optional[int] = None
    nombre_variante: str
    producto_nombre: str
    id_producto: Optional[int] = None
    sku: Optional[str] = None
    codigo_barras: Optional[str] = None
    codigo_proveedor: Optional[str] = None
    imagen_principal: Optional[str] = None
    fecha_alta: Optional[datetime] = None
    cliente_actual_id: Optional[int] = None
    cliente_actual_nombre: Optional[str] = None
    cliente_actual_telefono: Optional[str] = None
    operacion_tipo: Optional[str] = None
    operacion_id: Optional[int] = None
    venta_id: Optional[int] = None
    reserva_id: Optional[int] = None
    id_orden_armado_origen: Optional[int] = None
    costo_fabricacion_final: Optional[Decimal] = None
    codigo_orden_armado: Optional[str] = None
    oferta_id: Optional[int] = None
    oferta_nombre: Optional[str] = None
    precio_oferta: Optional[Decimal] = None
    oferta_alcance: Optional[str] = None
    oferta_politica_contado: Optional[str] = None
    oferta_fecha_hasta: Optional[object] = None
    precio_minorista: Decimal = Decimal("0")
    precio_venta_personalizado: Optional[Decimal] = None
    precio_venta_actual: Decimal = Decimal("0")
    ganancia_estimada: Decimal = Decimal("0")
    margen_estimado: Optional[Decimal] = None
    venta_fecha: Optional[datetime] = None
    venta_precio_final: Optional[Decimal] = None
    venta_costo_aplicado: Optional[Decimal] = None
    venta_ganancia: Optional[Decimal] = None
    venta_oferta_id: Optional[int] = None
    venta_oferta_nombre: Optional[str] = None
    venta_oferta_alcance: Optional[str] = None
