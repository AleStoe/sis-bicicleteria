export function buildVentaItemPayload(item) {
  return {
    id_variante: Number(item.id_variante),
    cantidad: String(item.cantidad),
    id_bicicleta_serializada:
      item.modo_venta_serializada === "serializada" && item.id_bicicleta_serializada
        ? Number(item.id_bicicleta_serializada)
        : null,
    precio_unitario_manual: item.precio_unitario_manual
      ? String(item.precio_unitario_manual)
      : null,
    bonificado: Boolean(item.bonificado),
    motivo_precio_manual: item.motivo_precio_manual || null,
    motivo_bonificacion: item.motivo_bonificacion || null,
  };
}

export function buildPagoVentaPayload(pago) {
  return {
    medio_pago: pago.medio_pago,
    monto_base: String(pago.monto_base),
    cuotas: pago.cuotas || null,
    entidad: pago.entidad || null,
    nota: pago.nota || null,
  };
}

export function buildVentaSimulacionPayload({
  tipoPrecio,
  items,
  pagos = [],
  sugerirSaldoConMedioPago = null,
}) {
  return {
    tipo_precio: tipoPrecio || "minorista",
    items: items.map(buildVentaItemPayload),
    pagos: pagos.map(buildPagoVentaPayload),
    sugerir_saldo_con_medio_pago: sugerirSaldoConMedioPago,
  };
}

export function buildVentaPayload({
  clienteId,
  sucursalId,
  usuarioId,
  tipoPrecio,
  items,
  pagos = [],
  observaciones,
  usarCredito,
}) {
  return {
    id_cliente: Number(clienteId),
    id_sucursal: sucursalId,
    id_usuario: usuarioId,
    tipo_precio: tipoPrecio,
    items: items.map(buildVentaItemPayload),
    pagos: pagos.map(buildPagoVentaPayload),
    observaciones: observaciones?.trim() || null,
    usar_credito: pagos.length === 0 ? usarCredito : false,
    monto_credito_a_aplicar: null,
  };
}
