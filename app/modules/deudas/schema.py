from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class DeudaCrearInput(BaseModel):
    id_cliente: int = Field(..., gt=0)
    id_venta: int = Field(..., gt=0)
    monto_inicial: Decimal = Field(..., gt=0)
    observacion: Optional[str] = None
    id_usuario: int = Field(..., gt=0)


class DeudaPagoInput(BaseModel):
    # Compatibilidad legacy: monto se interpreta como monto_base.
    # Flujo nuevo: enviar monto_base o monto_cobrado_objetivo.
    monto: Optional[Decimal] = Field(default=None, gt=0)
    monto_base: Optional[Decimal] = Field(default=None, gt=0)
    monto_cobrado_objetivo: Optional[Decimal] = Field(default=None, gt=0)
    medio_pago: str
    cuotas: Optional[int] = Field(default=None, gt=0)
    entidad: Optional[str] = None
    nota: Optional[str] = None
    id_usuario: int = Field(..., gt=0)

    @model_validator(mode="after")
    def validar_monto_pago(self):
        cantidades = [
            self.monto is not None,
            self.monto_base is not None,
            self.monto_cobrado_objetivo is not None,
        ]

        if sum(cantidades) == 0:
            raise ValueError(
                "Debe informar monto_base, monto_cobrado_objetivo o monto"
            )

        if self.monto is not None and self.monto_base is not None:
            raise ValueError(
                "No enviar monto y monto_base juntos. monto queda solo por compatibilidad legacy"
            )

        if self.monto_cobrado_objetivo is not None and (
            self.monto is not None or self.monto_base is not None
        ):
            raise ValueError(
                "No enviar monto_cobrado_objetivo junto con monto_base/monto"
            )

        return self


class DeudaOut(BaseModel):
    id: int
    id_cliente: int
    origen_tipo: str
    origen_id: int
    saldo_actual: Decimal
    estado: str
    genera_recargo: bool
    tasa_recargo: Optional[Decimal] = None
    proximo_vencimiento: Optional[str] = None
    observacion: Optional[str] = None


class DeudaMovimientoOut(BaseModel):
    id: int
    id_deuda: int
    tipo_movimiento: str
    monto: Decimal
    origen_tipo: Optional[str] = None
    origen_id: Optional[int] = None
    nota: Optional[str] = None
    id_usuario: int
    usuario_nombre: Optional[str] = None
    usuario_username: Optional[str] = None


class DeudaDetalleOut(BaseModel):
    deuda: dict
    movimientos: list[dict]
