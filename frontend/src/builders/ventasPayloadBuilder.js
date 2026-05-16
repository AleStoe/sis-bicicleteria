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
    items: items.map((item) => ({
      id_variante: Number(item.id_variante),
      cantidad: String(item.cantidad),
      id_bicicleta_serializada:
        item.modo_venta_serializada === "serializada" &&
        item.id_bicicleta_serializada
          ? Number(item.id_bicicleta_serializada)
          : null,

      precio_unitario_manual: item.precio_unitario_manual
        ? String(item.precio_unitario_manual)
        : null,

      bonificado: Boolean(item.bonificado),

      motivo_precio_manual: item.motivo_precio_manual || null,
      motivo_bonificacion: item.motivo_bonificacion || null,
    })),
    pagos,
    observaciones: observaciones?.trim() || null,
    usar_credito: pagos.length === 0 ? usarCredito : false,
    monto_credito_a_aplicar: null,
  };
}