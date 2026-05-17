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
  agregarPago,
  sugerirMontoParaSaldar,
  previewSaldar,
  formatMoney,
  errorLocal,
  simulando,
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

      {previewSaldar?.monto_sugerido_para_saldar != null && (
        <div style={styles.previewBox}>
          <div style={styles.previewRow}>
            <span>Total lista</span>
            <strong>{formatMoney(previewSaldar.subtotal_base)}</strong>
          </div>

          <div style={styles.previewRow}>
            <span>Descuento estimado</span>
            <strong>
              -{" "}
              {formatMoney(
                Number(previewSaldar.subtotal_base || 0) -
                  Number(previewSaldar.monto_sugerido_para_saldar || 0)
              )}
            </strong>
          </div>

          <div style={styles.previewRowTotal}>
            <span>Total a cobrar</span>
            <strong>
              {formatMoney(previewSaldar.monto_sugerido_para_saldar)}
            </strong>
          </div>
        </div>
      )}

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
          onClick={sugerirMontoParaSaldar}
          disabled={simulando}
          style={styles.saldarBtn}
        >
          {simulando ? "..." : "Saldar"}
        </button>

        <button type="button" onClick={agregarPago} style={styles.addBtn}>
          Agregar
        </button>
      </div>

      <div style={styles.hint}>
        El total, descuentos y saldo se recalculan automáticamente según el medio
        y monto cargado.
      </div>

      {errorLocal && <div style={styles.localError}>{errorLocal}</div>}
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
  previewBox: {
    border: "1px solid #d1fadf",
    background: "#ecfdf3",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    display: "grid",
    gap: 6,
  },
  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    color: "#344054",
  },
  amountRow: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 100px",
    gap: 8,
  },
  input: {
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 15,
  },
  saldarBtn: {
    border: "1px solid #0b5bd3",
    background: "white",
    color: "#0b5bd3",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 900,
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
  hint: {
    marginTop: 8,
    color: "#667085",
    fontSize: 12,
    lineHeight: 1.35,
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
  previewRowTotal: {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 14,
  fontWeight: 900,
  color: "#067647",
  paddingTop: 6,
  borderTop: "1px solid #d1fadf",
},
};