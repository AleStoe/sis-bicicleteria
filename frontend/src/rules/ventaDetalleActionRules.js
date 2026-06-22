const ESTADOS_FINALES = new Set(["anulada", "devuelta"]);
const ESTADOS_ANULABLES = new Set(["creada", "pagada_parcial", "pagada_total"]);
const ESTADOS_COBRABLES = new Set(["creada", "pagada_parcial", "pagada_total"]);
const ESTADOS_DEVOLVIBLES = new Set(["entregada", "devuelta_parcial"]);

export function normalizarSaldo(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

export function ventaTieneDeudaFormal(situacionFinanciera) {
  return Boolean(
    situacionFinanciera?.tiene_deuda ||
      situacionFinanciera?.deuda_abierta ||
      situacionFinanciera?.deuda_formal
  );
}

export function puedeCobrarVenta(venta, situacionFinanciera) {
  if (!venta || ESTADOS_FINALES.has(venta.estado)) return false;
  if (venta.estado === "entregada") return false;
  if (ventaTieneDeudaFormal(situacionFinanciera)) return false;

  return (
    ESTADOS_COBRABLES.has(venta.estado) &&
    normalizarSaldo(venta.saldo_pendiente) > 0
  );
}

export function ventaHabilitadaParaEntrega(venta, situacionFinanciera) {
  if (!venta || ESTADOS_FINALES.has(venta.estado)) return false;

  const saldo = normalizarSaldo(venta.saldo_pendiente);
  const pagada = venta.estado === "pagada_total" && saldo <= 0;
  const entregadaConDeudaFormal =
    venta.estado === "entregada" && saldo > 0 && ventaTieneDeudaFormal(situacionFinanciera);

  return pagada || entregadaConDeudaFormal;
}

export function puedeEntregarVenta(venta, situacionFinanciera) {
  if (!venta || venta.estado === "entregada") return false;
  return ventaHabilitadaParaEntrega(venta, situacionFinanciera);
}

export function puedeAnularVenta(venta) {
  if (!venta) return false;
  return ESTADOS_ANULABLES.has(venta.estado);
}

export function puedeDevolverVenta(venta) {
  if (!venta) return false;
  return ESTADOS_DEVOLVIBLES.has(venta.estado);
}

export function puedeRevertirPago(pago, usuarioActual) {
  if (!pago || pago.estado !== "confirmado") return false;

  const rol = usuarioActual?.rol;
  return rol === "administrador" || rol === "encargado";
}

export function obtenerAccionesVentaDetalle(venta, situacionFinanciera) {
  return {
    puedeCobrar: puedeCobrarVenta(venta, situacionFinanciera),
    puedeEntregar: puedeEntregarVenta(venta, situacionFinanciera),
    puedeAnular: puedeAnularVenta(venta),
    puedeDevolver: puedeDevolverVenta(venta),
    estaCerradaOperativamente:
      normalizarSaldo(venta?.saldo_pendiente) <= 0 && venta?.estado === "entregada",
  };
}
