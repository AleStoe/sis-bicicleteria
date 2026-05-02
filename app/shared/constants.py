from decimal import Decimal

# =========================
# DECIMALES / GENERALES
# =========================
DECIMAL_ZERO = Decimal("0")

# =========================
# VENTAS
# =========================
VENTA_ESTADO_CREADA = "creada"
VENTA_ESTADO_PAGADA_PARCIAL = "pagada_parcial"
VENTA_ESTADO_PAGADA_TOTAL = "pagada_total"
VENTA_ESTADO_ENTREGADA = "entregada"
VENTA_ESTADO_ANULADA = "anulada"

ORIGEN_VENTA = "venta"

# =========================
# PAGOS
# =========================
PAGO_ESTADO_CONFIRMADO = "confirmado"
PAGO_ESTADO_REVERTIDO = "revertido"

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

# =========================
# CAJA
# =========================
CAJA_ESTADO_ABIERTA = "abierta"
CAJA_ESTADO_CERRADA = "cerrada"

CAJA_MOVIMIENTO_INGRESO = "ingreso"
CAJA_MOVIMIENTO_EGRESO = "egreso"
CAJA_MOVIMIENTO_AJUSTE = "ajuste"

CAJA_ORIGEN_EGRESO_MANUAL = "egreso_manual"
CAJA_ORIGEN_AJUSTE_MANUAL = "ajuste_manual"
CAJA_ORIGEN_PAGO = "pago"

# =========================
# STOCK
# =========================
STOCK_MOVIMIENTO_INGRESO = "ingreso"
STOCK_MOVIMIENTO_VENTA = "venta"
STOCK_MOVIMIENTO_ENTREGA = "entrega"
STOCK_MOVIMIENTO_RESERVA = "reserva"
STOCK_MOVIMIENTO_CANCELACION_VENTA = "cancelacion_venta"
STOCK_MOVIMIENTO_CANCELACION_RESERVA = "cancelacion_reserva"
STOCK_MOVIMIENTO_DEVOLUCION = "devolucion"
STOCK_MOVIMIENTO_DEVOLUCION_VENTA = "devolucion_venta"
STOCK_MOVIMIENTO_AJUSTE = "ajuste"

ORIGEN_RESERVA = "reserva"
ORIGEN_ORDEN_TALLER = "orden_taller"
ORIGEN_AJUSTE_MANUAL = "ajuste_manual"
ORIGEN_DEVOLUCION_VENTA = "devolucion_venta"

# =========================
# CREDITOS
# =========================
CREDITO_ESTADO_ABIERTO = "abierto"
CREDITO_ESTADO_APLICADO_PARCIAL = "aplicado_parcial"
CREDITO_ESTADO_APLICADO_TOTAL = "aplicado_total"

CREDITO_MOVIMIENTO_GENERADO = "credito_generado"
CREDITO_MOVIMIENTO_APLICACION_VENTA = "aplicacion_a_venta"

# =========================
# DEUDAS
# =========================
DEUDA_ESTADO_ABIERTA = "abierta"
DEUDA_ESTADO_CERRADA = "cerrada"
DEUDA_ESTADO_ANULADA = "anulada"

DEUDA_MOVIMIENTO_CARGO = "cargo"
DEUDA_MOVIMIENTO_PAGO = "pago"
DEUDA_MOVIMIENTO_RECARGO = "recargo"
DEUDA_MOVIMIENTO_AJUSTE = "ajuste"
DEUDA_MOVIMIENTO_REVERSION = "reversion"

ORIGEN_DEUDA_CLIENTE = "deuda_cliente"

# =========================
# TALLER
# =========================
ORDEN_TALLER_ESTADO_INGRESADA = "ingresada"
ORDEN_TALLER_ESTADO_PRESUPUESTADA = "presupuestada"
ORDEN_TALLER_ESTADO_EN_REPARACION = "en_reparacion"
ORDEN_TALLER_ESTADO_TERMINADA = "terminada"

ORDEN_TALLER_EVENTO_CREADA = "creada"
ORDEN_TALLER_EVENTO_CAMBIO_ESTADO = "cambio_estado"
ORDEN_TALLER_EVENTO_AGREGADO_ITEM = "agregado_item"

# =========================
# AUDITORIA - ENTIDADES
# =========================
AUDITORIA_ENTIDAD_VENTA = "venta"
AUDITORIA_ENTIDAD_PAGO = "pago"
AUDITORIA_ENTIDAD_CAJA = "caja"
AUDITORIA_ENTIDAD_STOCK = "stock"
AUDITORIA_ENTIDAD_RESERVA = "reserva"
AUDITORIA_ENTIDAD_CREDITO = "credito"
AUDITORIA_ENTIDAD_DEUDA = "deuda"

# =========================
# AUDITORIA - ACCIONES
# =========================
AUDITORIA_ACCION_VENTA_CREADA = "venta_creada"
AUDITORIA_ACCION_VENTA_ENTREGADA = "venta_entregada"
AUDITORIA_ACCION_VENTA_ANULADA = "anular_venta"
AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA = "entrega_venta_con_deuda"

AUDITORIA_ACCION_PAGO_REGISTRADO = "pago_registrado"
AUDITORIA_ACCION_PAGO_REVERTIDO = "revertir_pago"

AUDITORIA_ACCION_CAJA_EGRESO = "egreso_caja"
AUDITORIA_ACCION_CAJA_CERRADA = "cerrar_caja"
AUDITORIA_ACCION_CAJA_AJUSTE = "ajuste_caja"

AUDITORIA_ACCION_STOCK_AJUSTE = "ajuste_stock"

AUDITORIA_ACCION_RESERVA_CANCELADA = "cancelar_reserva"

AUDITORIA_ACCION_CREDITO_GENERADO = "credito_generado"
AUDITORIA_ACCION_CREDITO_APLICADO = "credito_aplicado"

AUDITORIA_ACCION_DEUDA_GENERADA = "deuda_generada"
AUDITORIA_ACCION_DEUDA_PAGO_REGISTRADO = "deuda_pago_registrado"

# =========================
# AUTHZ - ROLES
# =========================
ROL_ADMINISTRADOR = "administrador"
ROL_OPERADOR = "operador"
ROL_MECANICO = "mecanico"

# =========================
# AUTHZ - PERMISOS LOGICOS
# =========================
PERMISO_ANULAR_VENTA = "anular_venta"
PERMISO_ENTREGAR_CON_DEUDA = "entregar_con_deuda"
PERMISO_REVERTIR_PAGO = "revertir_pago"
PERMISO_AJUSTAR_STOCK = "ajustar_stock"
PERMISO_CERRAR_CAJA = "cerrar_caja"
PERMISO_CANCELAR_RESERVA = "cancelar_reserva"

AUDITORIA_ENTIDAD_VENTA_DEVOLUCION = "venta_devolucion"
AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA = "venta_devolucion_creada"

PERMISO_AJUSTAR_CAJA = "ajustar_caja"
PERMISO_GENERAR_DEUDA = "generar_deuda"
PERMISO_REINTEGRAR_CREDITO = "reintegrar_credito"

CREDITO_MOVIMIENTO_REINTEGRO = "reintegro"

AUDITORIA_ACCION_CREDITO_REINTEGRADO = "credito_reintegrado"

TIPO_MOVIMIENTO_USO_TALLER = "uso_taller"

TIPO_MOVIMIENTO_REVERSION_USO_TALLER = "reversion_uso_taller"

ORDEN_TALLER_EVENTO_ITEM_EJECUCION_REVERTIDA = "item_ejecucion_revertida"