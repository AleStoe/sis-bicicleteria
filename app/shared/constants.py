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
VENTA_ESTADO_DEVUELTA_PARCIAL = "devuelta_parcial"
VENTA_ESTADO_DEVUELTA = "devuelta"

VENTA_ESTADOS_REPORTING = (
    VENTA_ESTADO_PAGADA_PARCIAL,
    VENTA_ESTADO_PAGADA_TOTAL,
    VENTA_ESTADO_ENTREGADA,
    VENTA_ESTADO_DEVUELTA_PARCIAL,
    VENTA_ESTADO_DEVUELTA,
)

ORIGEN_VENTA = "venta"
MODO_DEVOLUCION_CREDITO_COMERCIAL = "credito_comercial"
MODO_DEVOLUCION_REVERSION_PAGO_EXTERNO = "reversion_pago_externo"

MODOS_DEVOLUCION_VALIDOS = {
    MODO_DEVOLUCION_CREDITO_COMERCIAL,
    MODO_DEVOLUCION_REVERSION_PAGO_EXTERNO,
}

# =========================
# PAGOS
# =========================
PAGO_ESTADO_CONFIRMADO = "confirmado"
PAGO_ESTADO_REVERTIDO = "revertido"
PAGO_ESTADO_DEVUELTO_EXTERNO = "devuelto_externo"
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
CREDITO_MOVIMIENTO_RESTAURACION_VENTA = "ajuste"

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
ORDEN_TALLER_EVENTO_ITEM_QUITADO_BORRADOR = "item_quitado_borrador"

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
AUDITORIA_ACCION_PAGO_DEVUELTO_EXTERNO = "pago_devuelto_externo"

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
PERMISO_GESTIONAR_USUARIOS = "gestionar_usuarios"
PERMISO_ABRIR_CAJA = "abrir_caja"
PERMISO_REGISTRAR_PAGO = "registrar_pago"
PERMISO_REGISTRAR_EGRESO = "registrar_egreso"
PERMISO_GESTIONAR_GASTOS = "gestionar_gastos"
PERMISO_GESTIONAR_CAPITAL_RETIROS = "gestionar_capital_retiros"
PERMISO_CREAR_VENTA = "crear_venta"
PERMISO_MODIFICAR_PRECIO_VENTA = "modificar_precio_venta"
PERMISO_APLICAR_CREDITO_VENTA = "aplicar_credito_venta"
PERMISO_GESTIONAR_DEVOLUCIONES = "gestionar_devoluciones"
PERMISO_VER_RENTABILIDAD = "ver_rentabilidad"
PERMISO_GESTIONAR_TALLER = "gestionar_taller"
PERMISO_GESTIONAR_AGENDA_TALLER = "gestionar_agenda_taller"
PERMISO_GESTIONAR_POSTVENTA = "gestionar_postventa"
PERMISO_GESTIONAR_GARANTIAS = "gestionar_garantias"
PERMISO_GESTIONAR_CATALOGO = "gestionar_catalogo"
PERMISO_GESTIONAR_PRECIOS = "gestionar_precios"
PERMISO_GESTIONAR_OFERTAS = "gestionar_ofertas"
PERMISO_CONFIGURACION_COMERCIAL = "configuracion_comercial"
PERMISO_VER_AUDITORIA = "ver_auditoria"
PERMISO_GESTIONAR_BACKUPS = "gestionar_backups"

AUDITORIA_ENTIDAD_BACKUP = "backup"
AUDITORIA_ACCION_BACKUP_GENERADO = "backup_generado"
AUDITORIA_ACCION_BACKUP_DESCARGADO = "backup_descargado"

CREDITO_MOVIMIENTO_REINTEGRO = "reintegro"

AUDITORIA_ACCION_CREDITO_REINTEGRADO = "credito_reintegrado"

TIPO_MOVIMIENTO_USO_TALLER = "uso_taller"

TIPO_MOVIMIENTO_REVERSION_USO_TALLER = "reversion_uso_taller"

ORDEN_TALLER_EVENTO_ITEM_EJECUCION_REVERTIDA = "item_ejecucion_revertida"

ORDEN_TALLER_EVENTO_ITEM_CANCELADO = "item_cancelado"

AUDITORIA_ACCION_LOGIN_EXITOSO = "login_exitoso"
AUDITORIA_ACCION_LOGIN_FALLIDO = "login_fallido"

AUDITORIA_ENTIDAD_GASTO = "gasto"
AUDITORIA_ACCION_GASTO_CREADO = "gasto_creado"
AUDITORIA_ACCION_GASTO_ANULADO = "gasto_anulado"
AUDITORIA_ACCION_GASTO_CORREGIDO = "gasto_corregido"

AUDITORIA_ENTIDAD_USUARIO = "usuario"
AUDITORIA_ACCION_USUARIO_CREADO = "usuario_creado"
AUDITORIA_ACCION_USUARIO_EDITADO = "usuario_editado"
AUDITORIA_ACCION_USUARIO_ACTIVADO = "usuario_activado"
AUDITORIA_ACCION_USUARIO_DESACTIVADO = "usuario_desactivado"
AUDITORIA_ACCION_USUARIO_PASSWORD_RESETEADO = "usuario_password_reseteado"
AUDITORIA_ACCION_USUARIO_PASSWORD_PROPIA_CAMBIADA = (
    "usuario_password_propia_cambiada"
)

AUDITORIA_ACCION_CAJA_ABIERTA = "abrir_caja"
AUDITORIA_ENTIDAD_CAPITAL_RETIRO = "capital_retiro"
AUDITORIA_ACCION_CAPITAL_MOVIMIENTO_CREADO = "capital_movimiento_creado"
AUDITORIA_ACCION_CAPITAL_MOVIMIENTO_ANULADO = "capital_movimiento_anulado"
