export default function CheckoutResumenPago({
  total,
  pagado,
  pendiente,
  cantidadItems,
  formatMoney,
}) {
  const estaSaldada = Number(pendiente || 0) <= 0;

  return (
    <>
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>Checkout POS</span>
          <h3 style={styles.title}>Cobro de venta</h3>

          <p style={styles.sub}>
            {cantidadItems} item{cantidadItems === 1 ? "" : "s"} ·{" "}
            {estaSaldada ? "venta saldada" : "cargando pagos"}
          </p>
        </div>
      </div>

      <div style={estaSaldada ? styles.statusOk : styles.statusPending}>
        <span>{estaSaldada ? "Venta saldada" : "Estado de cobro"}</span>
        <strong>{estaSaldada ? formatMoney(0) : formatMoney(pendiente)}</strong>
        <small>
          {estaSaldada
            ? "La base de la venta ya quedó cubierta."
            : "Monto base pendiente antes de aplicar el próximo medio."}
        </small>
      </div>
    </>
  );
}

const baseStatus = {
  borderRadius: 16,
  padding: 18,
  display: "grid",
  gap: 6,
  textAlign: "center",
  marginBottom: 12,
};

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
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
    fontSize: 20,
    color: "#0f172a",
  },
  sub: {
    margin: "4px 0 0",
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },
  statusPending: {
    ...baseStatus,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#c2410c",
  },
  statusOk: {
    ...baseStatus,
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#047857",
  },
};
