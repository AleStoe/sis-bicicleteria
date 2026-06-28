export const CONSUMIDOR_FINAL_ID = 1;

export function esConsumidorFinal(clienteId, cliente = null) {
  const nombre = String(cliente?.nombre || "").trim().toUpperCase();
  return Number(clienteId) === CONSUMIDOR_FINAL_ID || nombre === "CONSUMIDOR FINAL";
}

export function getItemsConPrecioManual(items = []) {
  return (items || []).filter((item) => item.precio_unitario_manual && !item.bonificado);
}

export function getItemsBonificados(items = []) {
  return (items || []).filter((item) => item.bonificado);
}

export function describirItems(items = [], limite = 3) {
  const nombres = items
    .slice(0, limite)
    .map((item) => item.descripcion || item.producto_nombre || item.nombre || `Item #${item.id_variante || item.id || ""}`.trim())
    .filter(Boolean);

  const restantes = Math.max(0, items.length - nombres.length);
  return restantes > 0 ? `${nombres.join(", ")} y ${restantes} mas` : nombres.join(", ");
}

export function calcularDeudaAbiertaCliente(deudas = [], clienteId) {
  const deudasCliente = (deudas || []).filter((deuda) => {
    const esCliente = Number(deuda.id_cliente) === Number(clienteId);
    const abierta = deuda.estado === "abierta";
    const saldo = Number(deuda.saldo_actual || deuda.saldo_pendiente || 0);
    return esCliente && abierta && saldo > 0;
  });

  const saldo = deudasCliente.reduce(
    (acc, deuda) => acc + Number(deuda.saldo_actual || deuda.saldo_pendiente || 0),
    0
  );

  return {
    deudas: deudasCliente,
    saldo,
    tieneDeuda: saldo > 0,
  };
}
