export default function CheckoutResumenPago({
  total,
  pagado,
  pendiente,
  cantidadItems,
  formatMoney,
  montoCobroSugerido,
  medioPago,
}) {
  const estaSaldada = Number(pendiente || 0) <= 0;
  const tieneSugerencia = montoCobroSugerido != null && !estaSaldada;

  return (
    <div style={styles.box}>
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>Resumen de cobro</span>
          <h3 style={styles.title}>
            {estaSaldada ? "Venta cubierta" : "Falta cobrar"}
          </h3>
          <p style={styles.sub}>
            {cantidadItems} item{cantidadItems === 1 ? "" : "s"} en la venta.
          </p>
        </div>

        <div style={estaSaldada ? styles.pillOk : styles.pillPending}>
          {estaSaldada ? "Cubierta" : "Pendiente"}
        </div>
      </div>

      <div style={styles.totalLine}>
        <span>Total venta</span>
        <strong>{formatMoney(total)}</strong>
      </div>

      <div style={styles.totalLine}>
        <span>Pagos cargados</span>
        <strong>{formatMoney(pagado)}</strong>
      </div>

      <div style={estaSaldada ? styles.amountOk : styles.amountPending}>
        <span>{estaSaldada ? "Listo para finalizar" : "Falta cobrar"}</span>
        <strong>{formatMoney(Math.max(Number(pendiente || 0), 0))}</strong>
      </div>

      {tieneSugerencia && (
        <div style={styles.cashHint}>
          <span>Cliente paga con {getMedioLabel(medioPago)}</span>
          <strong>{formatMoney(montoCobroSugerido)}</strong>
          <small>Calculado automáticamente según reglas comerciales.</small>
        </div>
      )}
    </div>
  );
}

function getMedioLabel(medio) {
  const labels = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    mercadopago: "MercadoPago",
  };

  return labels[medio] || "el medio seleccionado";
}

const styles = {
  box: {
    border: "1px solid #dbe2ea",
    borderRadius: 16,
    padding: 14,
    background: "white",
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  kicker: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 2,
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  sub: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  pillPending: {
    borderRadius: 999,
    padding: "6px 9px",
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fdba74",
    fontSize: 11,
    fontWeight: 1000,
  },
  pillOk: {
    borderRadius: 999,
    padding: "6px 9px",
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #86efac",
    fontSize: 11,
    fontWeight: 1000,
  },
  totalLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "7px 0",
    borderTop: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },
  amountPending: {
    marginTop: 8,
    borderRadius: 14,
    padding: "12px 14px",
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  amountOk: {
    marginTop: 8,
    borderRadius: 14,
    padding: "12px 14px",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  cashHint: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    display: "grid",
    gap: 2,
    textAlign: "center",
    fontSize: 13,
    fontWeight: 800,
  },
};