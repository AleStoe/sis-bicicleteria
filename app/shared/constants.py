from decimal import Decimal

VENTA_ESTADO_CREADA = "creada"
VENTA_ESTADO_PAGADA_PARCIAL = "pagada_parcial"
VENTA_ESTADO_PAGADA_TOTAL = "pagada_total"
VENTA_ESTADO_ENTREGADA = "entregada"
VENTA_ESTADO_ANULADA = "anulada"

CREDITO_ESTADO_ABIERTO = "abierto"
CREDITO_ESTADO_APLICADO_PARCIAL = "aplicado_parcial"
CREDITO_ESTADO_APLICADO_TOTAL = "aplicado_total"

CREDITO_MOVIMIENTO_GENERADO = "credito_generado"
CREDITO_MOVIMIENTO_APLICACION_VENTA = "aplicacion_a_venta"

ORIGEN_VENTA = "venta"

MEDIOS_PAGO_VALIDOS = {
    "efectivo",
    "transferencia",
    "mercadopago",
    "tarjeta",
}

ORIGENES_PAGO_VALIDOS = {
    "venta",
    "reserva",
    "orden_taller",
    "deuda_cliente",
}

DECIMAL_ZERO = Decimal("0")

PAGO_ESTADO_REVERTIDO = "revertido"

# TALLER

ORDEN_TALLER_ESTADO_INGRESADA = "ingresada"
ORDEN_TALLER_ESTADO_PRESUPUESTADA = "presupuestada"
ORDEN_TALLER_ESTADO_EN_REPARACION = "en_reparacion"
ORDEN_TALLER_ESTADO_TERMINADA = "terminada"

ORDEN_TALLER_EVENTO_CREADA = "creada"
ORDEN_TALLER_EVENTO_CAMBIO_ESTADO = "cambio_estado"