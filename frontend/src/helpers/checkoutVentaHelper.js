export function getClienteNombre(draft) {
  if (!draft) return "Cliente";
  return draft.cliente?.nombre || `Cliente #${draft.clienteId}`;
}

export function calcularCantidadItems(items = []) {
  return items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
}

export function calcularResumenCheckout({ draft, checkoutEstado }) {
  const pagosPanel = checkoutEstado?.pagosDraft || [];

  const basePagosCubierta = pagosPanel.reduce(
    (acc, pago) => acc + Number(pago.monto_base || 0),
    0
  );

  const clientePagoTotal = pagosPanel.reduce(
    (acc, pago) =>
      acc + Number(pago.monto_total_cobrado ?? pago.monto_base ?? 0),
    0
  );

  const creditoAplicado = Number(checkoutEstado?.creditoAplicado || 0);
  const creditoDisponible = Number(checkoutEstado?.creditoDisponible || 0);
  const saldoCreditoRestante = Number(checkoutEstado?.saldoCreditoRestante || 0);

  const baseCubierta = basePagosCubierta + creditoAplicado;

  const saldoBasePendiente = Number(
    checkoutEstado?.pendienteActual ??
      checkoutEstado?.totalACobrar ??
      Math.max(Number(draft?.total || 0) - baseCubierta, 0)
  );

  return {
    pagosPanel,
    basePagosCubierta,
    creditoAplicado,
    creditoDisponible,
    saldoCreditoRestante,
    baseCubierta,
    clientePagoTotal,
    saldoBasePendiente,
    ventaSaldada: saldoBasePendiente <= 0,
  };
}

export function normalizarMedioPago(medio) {
  const labels = {
    efectivo: "💵 Efectivo",
    transferencia: "🏦 Transferencia",
    tarjeta: "💳 Tarjeta",
    mercadopago: "📲 MercadoPago",
  };

  return labels[medio] || medio || "Pago";
}

export function describirPago(pago) {
  if (pago?.medio_pago === "tarjeta") {
    const cuotas = pago.cuotas ? `${pago.cuotas} cuota(s)` : "tarjeta";
    return `${normalizarMedioPago(pago.medio_pago)} · ${cuotas}`;
  }

  return normalizarMedioPago(pago?.medio_pago);
}

export function getPagoAccent(pago) {
  if (Number(pago?.recargo_aplicado || 0) > 0) return "#f59e0b";
  if (Number(pago?.descuento_aplicado || 0) > 0) return "#22c55e";

  const colors = {
    efectivo: "#22c55e",
    transferencia: "#38bdf8",
    tarjeta: "#f59e0b",
    mercadopago: "#60a5fa",
  };

  return colors[pago?.medio_pago] || "#94a3b8";
}

export function getAjustePago(pago) {
  const recargo = Number(pago?.recargo_aplicado || 0);
  const descuento = Number(pago?.descuento_aplicado || 0);

  if (recargo > 0) {
    return { label: "Financiacion", value: recargo, tone: "warning" };
  }

  if (descuento > 0) {
    return { label: "Descuento", value: descuento, tone: "success" };
  }

  return null;
}

export function getNumeroCuadroItem(item) {
  return (
    item?.numero_cuadro ||
    item?.numero_cuadro_serializada ||
    item?.bicicleta_serializada?.numero_cuadro ||
    item?.serializada?.numero_cuadro ||
    item?.bicicleta?.numero_cuadro ||
    null
  );
}

export function itemRequiereCuadro(item) {
  return Boolean(
    item?.id_bicicleta_serializada ||
      item?.modo_venta_serializada === "serializada" ||
      item?.serializable
  );
}
