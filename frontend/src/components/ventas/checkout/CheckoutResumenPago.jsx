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
          <span style={styles.kicker}>Cobro POS</span>
          <h3 style={styles.title}>
            {estaSaldada ? "Venta saldada" : "Falta cubrir la venta"}
          </h3>

          <p style={styles.sub}>
            {cantidadItems} item{cantidadItems === 1 ? "" : "s"} en el carrito.
          </p>
        </div>

        <div style={estaSaldada ? styles.pillOk : styles.pillPending}>
          {estaSaldada ? "OK" : "Pendiente"}
        </div>
      </div>

      <div style={estaSaldada ? styles.heroOk : styles.heroPending}>
        <span>{estaSaldada ? "Listo para finalizar" : "Base pendiente"}</span>

        <strong>{estaSaldada ? formatMoney(0) : formatMoney(pendiente)}</strong>

        <small>
          {estaSaldada
            ? "Ya cargaste los pagos necesarios."
            : "Elegí medio de pago y tocá “Completar saldo”."}
        </small>
      </div>

      {tieneSugerencia && (
        <div style={styles.cashHint}>
          <span>Con el medio seleccionado, cobrale al cliente</span>
          <strong>{formatMoney(montoCobroSugerido)}</strong>
          <small>{getMedioLabel(medioPago)} · cálculo automático según reglas comerciales.</small>
        </div>
      )}

      <div style={styles.miniGrid}>
        <Mini label="Precio lista" value={formatMoney(total)} />
        <Mini label="Pagos cargados" value={formatMoney(pagado)} />
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={styles.mini}>
      <span>{label}</span>
      <strong>{value}</strong>
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

  return labels[medio] || "Medio seleccionado";
}

const styles = {
  box: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    background: "#f8fafc",
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  kicker: {
    display: "block",
    color: "#f97316",
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 2,
  },
  title: {
    margin: 0,
    fontSize: 23,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  sub: {
    margin: "4px 0 0",
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },
  pillPending: {
    borderRadius: 999,
    padding: "7px 10px",
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    fontSize: 12,
    fontWeight: 1000,
  },
  pillOk: {
    borderRadius: 999,
    padding: "7px 10px",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #86efac",
    fontSize: 12,
    fontWeight: 1000,
  },
  heroPending: {
    borderRadius: 18,
    padding: 18,
    background: "#0f172a",
    color: "white",
    display: "grid",
    gap: 5,
    textAlign: "center",
  },
  heroOk: {
    borderRadius: 18,
    padding: 18,
    background: "#047857",
    color: "white",
    display: "grid",
    gap: 5,
    textAlign: "center",
  },
  cashHint: {
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #86efac",
    display: "grid",
    gap: 3,
    textAlign: "center",
  },
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  },
  mini: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: 14,
    padding: 11,
    display: "grid",
    gap: 4,
  },
};
