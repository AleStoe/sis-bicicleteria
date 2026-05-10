export default function CheckoutResumenPago({
  total,
  pagado,
  pendiente,
  cantidadItems,
  formatMoney,
}) {
  return (
    <>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Checkout</h3>

          <p style={styles.sub}>
            {cantidadItems} item{cantidadItems === 1 ? "" : "s"} en el carrito
          </p>
        </div>

        <strong style={styles.total}>{formatMoney(total)}</strong>
      </div>

      <div style={styles.statusGrid}>
        <div style={styles.paidBox}>
          <span>Pagado</span>
          <strong>{formatMoney(pagado)}</strong>
        </div>

        <div style={pendiente > 0 ? styles.pendingBox : styles.okBox}>
          <span>{pendiente > 0 ? "Pendiente" : "Venta saldada"}</span>
          <strong>{formatMoney(pendiente)}</strong>
        </div>
      </div>
    </>
  );
}

const baseStatusBox = {
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 4,
};

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
  },
  sub: {
    margin: "4px 0 0",
    color: "#667085",
    fontSize: 13,
  },
  total: {
    fontSize: 26,
    color: "#0b5bd3",
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  paidBox: {
    ...baseStatusBox,
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
  },
  pendingBox: {
    ...baseStatusBox,
    background: "#fff1f0",
    border: "1px solid #fecdca",
    color: "#b42318",
  },
  okBox: {
    ...baseStatusBox,
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
  },
};