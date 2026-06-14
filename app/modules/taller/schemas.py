from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, model_validator



ESTADOS_TALLER_BASE = Literal[
    "ingresada",
    "presupuestada",
    "esperando_aprobacion",
    "esperando_repuestos",
    "en_reparacion",
    "terminada",
    "facturada",
    "lista_para_retirar",
    "retirada",
    "cancelada",
]


class OrdenTallerCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_cliente: int = Field(gt=0)
    id_bicicleta_cliente: int = Field(gt=0)
    problema_reportado: str = Field(min_length=1)
    fecha_prometida: datetime | None = None
    prioridad: Literal["normal", "urgente"] = "normal"
    id_usuario: int = Field(gt=0)


class OrdenTallerEstadoUpdate(BaseModel):
    nuevo_estado: ESTADOS_TALLER_BASE
    id_usuario: int = Field(gt=0)


class OrdenTallerOperativoUpdate(BaseModel):
    fecha_prometida: datetime | None = None
    prioridad: Literal["normal", "urgente"] = "normal"
    id_usuario: int = Field(gt=0)


class OrdenTallerAvisoRetiroInput(BaseModel):
    id_usuario: int = Field(gt=0)


class OrdenTallerMensajeRetiroOutput(BaseModel):
    orden_id: int
    cliente_nombre: str | None = None
    cliente_telefono: str | None = None
    bicicleta_descripcion: str | None = None
    mensaje: str
    whatsapp_url: str | None = None


class OrdenTallerDashboardOutput(BaseModel):
    pendientes: int = 0
    ingresadas: int = 0
    presupuestadas: int = 0
    esperando_aprobacion: int = 0
    esperando_repuestos: int = 0
    en_reparacion: int = 0
    terminadas: int = 0
    facturadas: int = 0
    listas_para_retirar: int = 0
    atrasadas: int = 0
    para_manana: int = 0
    urgentes: int = 0
    total_importe_pendiente: Decimal = Decimal("0")


class OrdenTallerItemCreate(BaseModel):
    tipo_item: Literal["repuesto", "servicio"] = "repuesto"
    id_variante: int | None = Field(default=None, gt=0)
    id_servicio_taller: int | None = Field(default=None, gt=0)
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal = Field(ge=0)
    id_usuario: int = Field(gt=0)

    @model_validator(mode="after")
    def validar_referencia_por_tipo(self):
        if self.tipo_item == "repuesto":
            if self.id_variante is None:
                raise ValueError("Para un repuesto debe informarse id_variante")
            if self.id_servicio_taller is not None:
                raise ValueError("Un repuesto no debe tener id_servicio_taller")

        if self.tipo_item == "servicio":
            if self.id_servicio_taller is None:
                raise ValueError("Para un servicio debe informarse id_servicio_taller")
            if self.id_variante is not None:
                raise ValueError("Un servicio no debe tener id_variante")

        return self


class OrdenTallerResponse(BaseModel):
    id: int
    fecha_ingreso: datetime
    id_sucursal: int
    id_cliente: int
    id_bicicleta_cliente: int
    cliente_nombre: str | None = None
    cliente_telefono: str | None = None
    cliente_dni: str | None = None
    bicicleta_marca: str | None = None
    bicicleta_modelo: str | None = None
    bicicleta_rodado: str | None = None
    bicicleta_color: str | None = None
    bicicleta_numero_cuadro: str | None = None
    bicicleta_descripcion: str | None = None
    estado: str
    problema_reportado: str
    observaciones: str | None = None
    fecha_prometida: datetime | None = None
    fecha_terminada: datetime | None = None
    fecha_retirada: datetime | None = None
    cliente_avisado_retiro: bool = False
    fecha_aviso_retiro: datetime | None = None
    prioridad: str = "normal"
    dias_en_taller: int | None = None
    dias_demorados: int | None = None
    total_final: Decimal
    saldo_pendiente: Decimal
    id_venta_generada: int | None = None
    id_usuario: int
    created_at: datetime
    updated_at: datetime


class OrdenTallerEventoResponse(BaseModel):
    id: int
    id_orden_taller: int
    fecha: datetime
    tipo_evento: str
    detalle: str | None = None
    id_usuario: int

    usuario_nombre: str | None = None
    usuario_username: str | None = None

    created_at: datetime


class OrdenTallerItemResponse(BaseModel):
    id: int
    id_orden_taller: int
    tipo_item: str
    id_variante: int | None = None
    id_servicio_taller: int | None = None
    etapa: str
    descripcion_snapshot: str
    cantidad: Decimal
    precio_unitario: Decimal
    costo_unitario_aplicado: Decimal | None = None
    aprobado: bool
    subtotal: Decimal
    created_at: datetime
    updated_at: datetime


class OrdenTallerDetalleResponse(OrdenTallerResponse):
    eventos: list[OrdenTallerEventoResponse] = Field(default_factory=list)
    items: list[OrdenTallerItemResponse] = Field(default_factory=list)

class OrdenTallerItemAprobacionUpdate(BaseModel):
    aprobado: bool
    id_usuario: int = Field(gt=0)

class OrdenTallerItemReversionEjecucionInput(BaseModel):
    id_usuario: int = Field(gt=0)
    motivo: str = Field(min_length=1)

class OrdenTallerItemCancelarInput(BaseModel):
    id_usuario: int = Field(gt=0)
    motivo: str = Field(min_length=1)

class OrdenTallerGenerarVentaInput(BaseModel):
    id_usuario: int = Field(gt=0)


class OrdenTallerGenerarVentaOutput(BaseModel):
    ok: bool
    orden_id: int
    venta_id: int
    estado_orden: str
