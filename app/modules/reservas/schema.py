from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


MedioPago = Literal["efectivo", "transferencia", "mercadopago", "tarjeta"]
TipoReserva = Literal["comun"]
EstadoReserva = Literal["activa", "vencida", "cancelada", "convertida_en_venta"]
MedioPagoReserva = Literal[
    "efectivo",
    "transferencia",
    "mercadopago",
    "tarjeta",
]

class ReservaItemCreateInput(BaseModel):
    id_variante: int = Field(gt=0)
    id_bicicleta_serializada: int | None = Field(default=None, gt=0)
    cantidad: Decimal = Field(gt=0)
    precio_estimado: Decimal = Field(ge=0)

    @model_validator(mode="after")
    def validar_serializada(self):
        if self.id_bicicleta_serializada is not None and self.cantidad != Decimal("1"):
            raise ValueError(
                "Un item con bicicleta serializada debe tener cantidad = 1"
            )
        return self


class ReservaPagoInicialInput(BaseModel):
    registrar: bool = False
    medio_pago: MedioPagoReserva | None = None

    # Camino correcto V2: base comercial de la seña.
    monto_base: Decimal | None = Field(default=None, gt=0)

    # Compatibilidad temporal V1.
    monto: Decimal | None = Field(default=None, gt=0)

    cuotas: int | None = Field(default=None, gt=0)
    entidad: str | None = Field(default=None, max_length=80)
    id_tarjeta_plan: int | None = Field(default=None, gt=0)

    nota: str | None = None

    @model_validator(mode="after")
    def validar_pago_inicial(self):
        if not self.registrar:
            return self

        if self.medio_pago is None:
            raise ValueError("Debe informar medio_pago para registrar la seña")

        if self.monto_base is None and self.monto is None:
            raise ValueError("Debe informar monto_base para registrar la seña")

        if self.medio_pago == "tarjeta":
            if self.cuotas is None and self.id_tarjeta_plan is None:
                raise ValueError("La seña con tarjeta requiere cuotas o plan de tarjeta")

        if self.medio_pago != "tarjeta" and self.id_tarjeta_plan is not None:
            raise ValueError("Solo una seña con tarjeta puede usar id_tarjeta_plan")

        return self

    @property
    def base(self) -> Decimal | None:
        return self.monto_base if self.monto_base is not None else self.monto


class ReservaCreateInput(BaseModel):
    id_cliente: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    id_usuario: int = Field(gt=0)
    fecha_vencimiento: object | None = None
    nota: str | None = Field(default=None, max_length=500)
    items: list[ReservaItemCreateInput] = Field(min_length=1)
    pago_inicial: ReservaPagoInicialInput | None = None


class ReservaVencerInput(BaseModel):
    detalle: str | None = Field(default=None, max_length=500)
    id_usuario: int = Field(gt=0)


class ReservaCancelarInput(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)
    sena_perdida: bool
    id_usuario: int = Field(gt=0)


class ReservaCreateOutput(BaseModel):
    ok: bool
    reserva_id: int
    estado: str
    total_estimado: Decimal
    sena_total: Decimal
    saldo_estimado: Decimal


class ReservaEstadoOutput(BaseModel):
    ok: bool
    reserva_id: int
    estado: EstadoReserva


class ReservaResumenOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha_reserva: object
    id_cliente: int
    cliente_nombre: str
    id_sucursal: int
    sucursal_nombre: str
    tipo_reserva: str
    estado: str
    fecha_vencimiento: object | None = None
    sena_total: Decimal
    saldo_estimado: Decimal
    sena_baja: bool


class ReservaDetalleItemOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_reserva: int
    id_variante: int
    id_bicicleta_serializada: int | None = None
    descripcion_snapshot: str
    cantidad: Decimal
    precio_estimado: Decimal
    subtotal_estimado: Decimal


class ReservaEventoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    tipo_evento: str
    detalle: str | None = None
    id_usuario: int
    usuario_nombre: str | None = None
    usuario_username: str | None = None

class ReservaPagoOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: object
    medio_pago: str
    monto_total_cobrado: Decimal
    estado: str
    nota: str | None = None
    id_usuario: int
    usuario_nombre: str | None = None
    usuario_username: str | None = None


class ReservaDetalleCabeceraOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha_reserva: object
    id_cliente: int
    cliente_nombre: str
    id_sucursal: int
    sucursal_nombre: str
    tipo_reserva: str
    estado: str
    fecha_vencimiento: object | None = None
    sena_total: Decimal
    saldo_estimado: Decimal
    sena_perdida: bool
    nota: str | None = None


class ReservaDetalleOutput(BaseModel):
    reserva: ReservaDetalleCabeceraOutput
    items: list[ReservaDetalleItemOutput]
    eventos: list[ReservaEventoOutput]
    pagos: list[ReservaPagoOutput]

class ReservaConvertirInput(BaseModel):
    id_usuario: int
    observaciones: str | None = None

class ReservaConvertirOutput(BaseModel):
    ok: bool
    reserva_id: int
    venta_id: int
    estado_reserva: str