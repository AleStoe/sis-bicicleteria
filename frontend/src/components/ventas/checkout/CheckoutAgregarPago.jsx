const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "tarjeta", label: "Tarjeta" },
];

export default function CheckoutAgregarPago({
  medioPago,
  setMedioPago,
  monto,
  setMonto,
  cobrarTotal,
  agregarPago,
  errorLocal,
}) {
  return (
    <div style={styles.payBox}>
      <div style={styles.payTitle}>Agregar pago</div>

      <div style={styles.paymentControls}>
        <select
          value={medioPago}
          onChange={(e) => setMedioPago(e.target.value)}
          style={styles.select}
        >
          {MEDIOS_PAGO.map((medio) => (
            <option key={medio.value} value={medio.value}>
              {medio.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.amountRow}>
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto"
          style={styles.input}
        />

        <button
          type="button"
          onClick={cobrarTotal}
          style={styles.secondary}
        >
          Total
        </button>

        <button
          type="button"
          onClick={agregarPago}
          style={styles.addBtn}
        >
          Agregar
        </button>
      </div>

      {errorLocal && (
        <div style={styles.localError}>
          {errorLocal}
        </div>
      )}
    </div>
  );
}

const styles = {
  payBox: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    background: "#f9fafb",
    marginBottom: 12,
  },

  payTitle: {
    fontWeight: 900,
    marginBottom: 8,
    color: "#344054",
  },

  paymentControls: {
    marginBottom: 10,
  },

  select: {
    width: "100%",
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 14,
    background: "white",
  },

  amountRow: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 100px",
    gap: 8,
  },

  input: {
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 15,
  },

  secondary: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },

  addBtn: {
    border: "none",
    background: "#0b5bd3",
    color: "white",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },

  localError: {
    marginTop: 8,
    background: "#fff1f0",
    border: "1px solid #fecdca",
    color: "#b42318",
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
  },
};