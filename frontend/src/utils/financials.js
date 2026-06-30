export function getOrigenFinancieroLabel(origenTipo, origenId) {
  if (!origenTipo) return "-";

  const labels = {
    venta: "Venta",
    devolucion_venta: "Devolución de venta",
    credito: "Crédito",
    deuda: "Deuda",
    deuda_cliente: "Deuda",
    caja: "Caja",
    pago: "Pago",
    pago_reversion: "Reversión de pago",
    credito_aplicacion_restaurada: "Aplicación de crédito",
  };

  const label = labels[origenTipo] || origenTipo;
  return origenId ? `${label} #${origenId}` : label;
}

export function getMovimientoCreditoLabel(tipo, origenTipo = "") {
  if (tipo === "ajuste" && origenTipo === "credito_aplicacion_restaurada") {
    return "Crédito restaurado";
  }

  const labels = {
    credito_generado: "Crédito generado",
    generado: "Crédito generado",
    aplicacion_a_venta: "Aplicado a venta",
    aplicacion_venta: "Aplicado a venta",
    reintegro: "Reintegrado",
    ajuste: "Ajuste",
    reversion: "Reversión",
  };

  return labels[tipo] || tipo || "-";
}

export function getCreditoContexto(credito = {}) {
  const observacion = String(credito.observacion || "").toLowerCase();

  if (observacion.includes("devolución") || observacion.includes("devolucion")) {
    return {
      titulo: "Crédito comercial por devolución",
      descripcion:
        "Este crédito representa saldo a favor dentro del negocio. Para devoluciones nuevas, el monto debe calcularse sobre el total real reconocido al cliente, no necesariamente sobre precio de lista.",
      tone: "warning",
    };
  }

  if (observacion.includes("anulación") || observacion.includes("anulacion")) {
    return {
      titulo: "Crédito comercial por anulación",
      descripcion:
        "Este crédito corresponde cuando el dinero queda a favor del cliente dentro del negocio. Si la venta tenía tarjeta/MercadoPago confirmado, primero corresponde revertir o cancelar ese pago, no generar crédito automático.",
      tone: "info",
    };
  }

  return {
    titulo: "Crédito comercial disponible",
    descripcion:
      "Saldo a favor del cliente dentro del negocio. Puede aplicarse a ventas futuras o reintegrarse si corresponde.",
    tone: "default",
  };
}

export function getPoliticaCreditoGeneral() {
  return {
    titulo: "Crédito comercial vs reversión de pago",
    descripcion:
      "Efectivo y transferencia suelen quedar como crédito o reintegro manual. Tarjeta, Posnet o MercadoPago normalmente deben resolverse revirtiendo/cancelando el pago en el medio correspondiente antes de anular, para no generar crédito comercial incorrecto.",
  };
}
