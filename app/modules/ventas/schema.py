from decimal import Decimal
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.modules.reglas_comerciales.schema import SugerirSaldoConMedioPagoInput

MedioPagoVenta = Literal["efectivo", "transferencia", "mercadopago", "tarjeta"]
TipoPrecioVenta = Literal["minorista", "mayorista"]

class VentaItemCreateInput(BaseModel):
    tipo_item: Literal["producto", "servicio_taller"] = "producto"

    id_variante: Optional[int] = None
    id_servicio_taller: Optional[int] = None

    cantidad: Decimal = Field(gt=0)

    id_bicicleta_serializada: Optional[int] = None

    precio_unitario_manual: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )

    bonificado: bool = False
    bonificacion_unitaria_manual: Optional[Decimal] = Field(default=None, ge=0)

    motivo_precio_manual: Optional[str] = Field(
        default=None,
        max_length=300,
    )

    motivo_bonificacion: Optional[str] = Field(
        default=None,
        max_length=300,
    )
    descripcion_snapshot: Optional[str] = Field(default=None, max_length=300)
    id_orden_taller_item: Optional[int] = None

    @model_validator(mode="after")
    def validar_referencia_por_tipo(self):
        if self.tipo_item == "producto":
            if self.id_variante is None:
                raise ValueError("Un producto requiere id_variante")

            if self.id_servicio_taller is not None:
                raise ValueError("Un producto no debe tener id_servicio_taller")

        if self.tipo_item == "servicio_taller":
            if self.id_servicio_taller is None:
                raise ValueError("Un servicio de taller requiere id_servicio_taller")

            if self.id_variante is not None:
                raise ValueError("Un servicio de taller no debe tener id_variante")

            if self.id_bicicleta_serializada is not None:
                raise ValueError("Un servicio de taller no debe tener bicicleta serializada")

            if self.precio_unitario_manual is None:
                raise ValueError("Un servicio de taller requiere precio_unitario_manual")

            if not self.motivo_precio_manual:
                raise ValueError("Un servicio de taller requiere motivo_precio_manual")

        if self.bonificado and not self.motivo_bonificacion:
            raise ValueError("La bonificación requiere motivo")

        if self.bonificacion_unitaria_manual is not None:
            if not self.bonificado:
                raise ValueError(
                    "La bonificación parcial debe marcar el ítem como bonificado"
                )
            if self.precio_unitario_manual is None:
                raise ValueError(
                    "La bonificación parcial requiere precio unitario manual"
                )
            if self.bonificacion_unitaria_manual > self.precio_unitario_manual:
                raise ValueError(
                    "La bonificación no puede superar el precio unitario"
                )

        if (
            self.precio_unitario_manual is not None
            and not self.motivo_precio_manual
        ):
            raise ValueError("El precio manual requiere motivo")

        return self
    
class VentaPagoCreateInput(BaseModel):
    medio_pago: MedioPagoVenta

    monto_base: Decimal | None = Field(default=None, gt=0)

    # Compatibilidad temporal V1
    monto: Decimal | None = Field(default=None, gt=0)

    cuotas: Optional[int] = Field(default=None, gt=0)
    entidad: Optional[str] = Field(default=None, max_length=80)

    nota: Optional[str] = None

    @model_validator(mode="after")
    def validar_monto_base(self):
        if self.monto_base is None and self.monto is None:
            raise ValueError("Debe informar monto_base")
        return self

    @property
    def base(self) -> Decimal:
        return self.monto_base if self.monto_base is not None else self.monto

class VentaCreateInput(BaseModel):
    id_cliente: int
    id_sucursal: int
    id_usuario: int
    tipo_precio: TipoPrecioVenta = "minorista"
    items: List[VentaItemCreateInput]
    pagos: List[VentaPagoCreateInput] = Field(default_factory=list)
    observaciones: Optional[str] = None
    usar_credito: bool = False
    monto_credito_a_aplicar: Optional[Decimal] = None
    id_orden_taller: Optional[int] = None
    


class VentaEntregaInput(BaseModel):
    id_usuario: int = Field(gt=0)
    condicion_entrega_bicicleta: Literal["en_caja", "armada"] = "armada"
    plan_postventa_bicicleta: Literal[
        "garantia_fabrica",
        "service_30_dias",
        "sin_service",
    ] | None = None


class VentaAnulacionInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)


class VentaCreateOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str
    credito_aplicado: Decimal
    credito_base_cubierta: Decimal = Decimal("0")
    credito_descuento_aplicado: Decimal = Decimal("0")
    saldo_pendiente: Decimal


class VentaEstadoOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str


class VentaAnulacionOutput(BaseModel):
    ok: bool
    venta_id: int
    estado: str
    anulacion_id: int
    credito_generado: bool
    monto_credito: Decimal
    credito_restaurado: Decimal = Decimal("0")


class VentaResumenOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_cliente: int
    cliente_nombre: str
    id_sucursal: int
    sucursal_nombre: str
    estado: str
    total_final: Decimal
    saldo_pendiente: Decimal
    cantidad_items: Decimal | int = 0
    tiene_serializadas: bool = False
    origen_venta: str = "venta"


class VentaDetalleCabeceraOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    id_cliente: int
    cliente_nombre: str
    id_sucursal: int
    sucursal_nombre: str
    estado: str
    subtotal_base: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal
    saldo_pendiente: Decimal
    id_reserva_origen: Optional[int] = None


class VentaDetalleItemOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_venta: int
    tipo_item: str = "producto"
    id_variante: Optional[int] = None
    id_servicio_taller: Optional[int] = None
    id_bicicleta_serializada: Optional[int] = None
    id_orden_taller_item: Optional[int] = None
    descripcion_snapshot: str
    cantidad: Decimal
    precio_lista: Decimal
    precio_final: Decimal
    costo_unitario_aplicado: Optional[Decimal] = None
    subtotal: Decimal
    bonificado: bool = False
    bonificacion_unitaria: Decimal = Decimal("0")

    motivo_bonificacion: Optional[str] = None

    motivo_precio_manual: Optional[str] = None

    precio_unitario_original: Decimal | None = None
    precio_unitario_final: Decimal | None = None
    id_oferta: int | None = None
    precio_catalogo_original: Decimal | None = None
    descuento_oferta_unitario: Decimal = Decimal("0")
    oferta_nombre_snapshot: str | None = None

class VentaDeudaAbiertaResumenOutput(BaseModel):
    id: int
    saldo_actual: Decimal
    estado: str
    origen_tipo: str
    origen_id: int


class VentaResumenFinancieroOutput(BaseModel):
    credito_aplicado_real: Decimal = Decimal("0.00")
    credito_generado_devolucion: Decimal = Decimal("0.00")
    deuda_cancelada_por_devolucion: Decimal = Decimal("0.00")
    cobertura_no_cobrada: Decimal = Decimal("0.00")


class VentaSituacionFinancieraOutput(BaseModel):
    tiene_deuda: bool
    deuda_abierta: Optional[VentaDeudaAbiertaResumenOutput] = None
    total_final: Decimal = Decimal("0.00")
    total_pagado_confirmado: Decimal = Decimal("0.00")
    saldo_pendiente: Decimal = Decimal("0.00")
    monto_cubierto_sin_pago_real: Decimal = Decimal("0.00")
    resumen: VentaResumenFinancieroOutput = Field(
        default_factory=VentaResumenFinancieroOutput
    )

class VentaDetalleOutput(BaseModel):
    venta: VentaDetalleCabeceraOutput
    items: List[VentaDetalleItemOutput]
    situacion_financiera: VentaSituacionFinancieraOutput

class VentaDevolucionSerializadaInput(BaseModel):
    id_bicicleta_serializada: int = Field(gt=0)
    motivo: str = Field(min_length=3, max_length=500)
    id_usuario: int = Field(gt=0)
    modo_devolucion: str = Field(default="credito_comercial")


class VentaDevolucionSerializadaOutput(BaseModel):
    ok: bool
    venta_id: int
    devolucion_id: int
    id_bicicleta_serializada: int
    estado_bicicleta: str

class VentaDevolucionInput(BaseModel):
    motivo: str
    id_usuario: int
    modo_devolucion: str = Field(default="credito_comercial")


class VentaDevolucionOutput(BaseModel):
    ok: bool
    venta_id: int
    credito_generado: Decimal

class VentaDevolucionItemInput(BaseModel):
    id_venta_item: int
    cantidad: Decimal = Field(gt=0)


class VentaDevolucionParcialInput(BaseModel):
    items: List[VentaDevolucionItemInput]
    motivo: str
    id_usuario: int
    modo_devolucion: str = Field(default="credito_comercial")

class VentaDevolucionParcialOutput(BaseModel):
    ok: bool
    venta_id: int
    credito_generado: Decimal

class VentaSimulacionInput(BaseModel):
    id_cliente: Optional[int] = None
    tipo_precio: TipoPrecioVenta = "minorista"
    items: List[VentaItemCreateInput]
    pagos: List[VentaPagoCreateInput] = Field(default_factory=list)
    sugerir_saldo_con_medio_pago: SugerirSaldoConMedioPagoInput | None = None
    usar_credito: bool = False
    monto_credito_a_aplicar: Optional[Decimal] = None


class VentaSimulacionOut(BaseModel):
    subtotal_base: Decimal
    descuento_total: Decimal
    recargo_total: Decimal
    total_final: Decimal

    total_base_asignada: Decimal
    total_pagos_cargados: Decimal

    saldo_base_estimado: Decimal
    saldo_estimado: Decimal

    credito_disponible: Decimal = Decimal("0")
    credito_aplicado: Decimal = Decimal("0")
    credito_base_cubierta: Decimal = Decimal("0")
    credito_descuento_aplicado: Decimal = Decimal("0")
    total_a_cobrar: Decimal
    saldo_credito_restante: Decimal = Decimal("0")

    monto_base_sugerido_para_saldar: Decimal | None = None
    monto_sugerido_para_saldar: Decimal | None = None

    reglas_aplicadas: list = Field(default_factory=list)
    tramos_pago: list = Field(default_factory=list)
