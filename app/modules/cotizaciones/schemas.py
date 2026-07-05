from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


CotizacionTipo = Literal["venta", "reparacion"]
TipoPrecioCotizacion = Literal["minorista", "mayorista"]
CotizacionEstado = Literal[
    "borrador",
    "enviada",
    "aceptada",
    "convertida",
    "rechazada",
    "vencida",
    "cancelada",
]
CotizacionItemTipo = Literal["producto", "servicio_taller", "linea_libre"]


class CotizacionItemInput(BaseModel):
    tipo_item: CotizacionItemTipo
    id_variante: int | None = None
    id_servicio_taller: int | None = None
    descripcion_snapshot: str | None = Field(default=None, max_length=255)
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal | None = Field(default=None, ge=0)
    descuento_monto: Decimal = Field(default=Decimal("0"), ge=0)
    notas: str | None = None
    orden: int = 0

    @model_validator(mode="after")
    def validar_referencia(self):
        if self.tipo_item == "producto":
            if self.id_variante is None:
                raise ValueError("Un item producto requiere id_variante")
            if self.id_servicio_taller is not None:
                raise ValueError("Un item producto no debe tener id_servicio_taller")

        if self.tipo_item == "servicio_taller":
            if self.id_servicio_taller is None:
                raise ValueError("Un item servicio_taller requiere id_servicio_taller")
            if self.id_variante is not None:
                raise ValueError("Un item servicio_taller no debe tener id_variante")

        if self.tipo_item == "linea_libre":
            if self.id_variante is not None or self.id_servicio_taller is not None:
                raise ValueError("Una linea_libre no debe tener referencias de catalogo")
            if not self.descripcion_snapshot or not self.descripcion_snapshot.strip():
                raise ValueError("Una linea_libre requiere descripcion_snapshot")
            if self.precio_unitario is None:
                raise ValueError("Una linea_libre requiere precio_unitario")

        return self


class CotizacionCreate(BaseModel):
    tipo: CotizacionTipo
    tipo_precio: TipoPrecioCotizacion = "minorista"
    id_sucursal: int = Field(gt=0)
    id_usuario_creador: int = Field(gt=0)
    id_cliente: int | None = Field(default=None, gt=0)
    cliente_nombre_snapshot: str | None = Field(default=None, max_length=150)
    cliente_telefono_snapshot: str | None = Field(default=None, max_length=50)
    id_bicicleta_cliente: int | None = Field(default=None, gt=0)
    problema_reportado: str | None = None
    observaciones: str | None = None
    fecha_validez: date | None = None
    descuento_total: Decimal = Field(default=Decimal("0"), ge=0)
    recargo_total: Decimal = Field(default=Decimal("0"), ge=0)
    items: list[CotizacionItemInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validar_tipo(self):
        if self.tipo == "reparacion" and not self.problema_reportado:
            raise ValueError("Una cotizacion de reparacion requiere problema_reportado")
        return self


class CotizacionEstadoUpdate(BaseModel):
    estado: Literal["borrador", "enviada", "aceptada", "rechazada", "vencida", "cancelada"]
    id_usuario: int = Field(gt=0)


class CotizacionItemCantidadUpdate(BaseModel):
    cantidad: Decimal = Field(gt=0)


class CotizacionSerializadaSeleccionInput(BaseModel):
    id_cotizacion_item: int = Field(gt=0)
    id_bicicleta_serializada: int = Field(gt=0)


class CotizacionConvertirVentaInput(BaseModel):
    id_usuario: int = Field(gt=0)
    serializadas: list[CotizacionSerializadaSeleccionInput] = Field(
        default_factory=list
    )


class CotizacionSerializadaDisponibleOutput(BaseModel):
    id: int
    numero_cuadro: str


class CotizacionConversionItemOutput(BaseModel):
    id_cotizacion_item: int
    descripcion: str
    tipo_item: str
    cantidad: Decimal
    serializable: bool = False
    stockeable: bool = False
    disponible: Decimal
    faltante: Decimal
    serializadas_disponibles: list[CotizacionSerializadaDisponibleOutput] = Field(
        default_factory=list
    )
    bloqueo: str | None = None


class CotizacionConversionPreviewOutput(BaseModel):
    cotizacion_id: int
    puede_convertir: bool
    requiere_seleccion_serializadas: bool
    items: list[CotizacionConversionItemOutput] = Field(default_factory=list)
    advertencias: list[str] = Field(default_factory=list)


class CotizacionConversionVentaOutput(BaseModel):
    ok: bool
    cotizacion_id: int
    venta_id: int
    estado_cotizacion: str
    ya_convertida: bool = False


class CotizacionItemResponse(BaseModel):
    id: int
    id_cotizacion: int
    tipo_item: str
    id_variante: int | None = None
    id_servicio_taller: int | None = None
    descripcion_snapshot: str
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_monto: Decimal
    subtotal: Decimal
    costo_unitario_referencia: Decimal | None = None
    notas: str | None = None
    orden: int
    created_at: datetime
    updated_at: datetime


class CotizacionResumenResponse(BaseModel):
    id: int
    numero: str
    tipo: str
    tipo_precio: TipoPrecioCotizacion = "minorista"
    estado: str
    fecha: datetime
    fecha_validez: date | None = None
    id_sucursal: int
    sucursal_nombre: str | None = None
    id_cliente: int | None = None
    cliente_nombre: str | None = None
    cliente_nombre_snapshot: str | None = None
    id_bicicleta_cliente: int | None = None
    problema_reportado: str | None = None
    subtotal: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal
    items_count: int = 0
    created_at: datetime
    updated_at: datetime


class CotizacionDetalleResponse(CotizacionResumenResponse):
    cliente_telefono_snapshot: str | None = None
    observaciones: str | None = None
    id_usuario_creador: int
    id_usuario_actualiza: int | None = None
    id_venta_convertida: int | None = None
    id_orden_taller_convertida: int | None = None
    fecha_convertida: datetime | None = None
    items: list[CotizacionItemResponse] = Field(default_factory=list)


class CotizacionMensajeWhatsappResponse(BaseModel):
    cotizacion_id: int
    numero: str
    telefono: str | None = None
    mensaje: str
    whatsapp_url: str | None = None
