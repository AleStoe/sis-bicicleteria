export default function CheckoutTotalesSimulacion({
  simulacion,
  formatMoney,
  simulando,
}) {
  if (!simulacion) return null;

  return (
    <div style={styles.box}>
      <Row
        label="Subtotal base"
        value={formatMoney(simulacion.subtotal_base)}
      />

      <Row
        label="Descuento aplicado"
        value={`- ${formatMoney(simulacion.descuento_total)}`}
        tone="success"
      />

      <Row
        label="Recargo aplicado"
        value={formatMoney(simulacion.recargo_total)}
        tone="warning"
      />

      <div style={styles.separator} />

      <Row
        label="Total final"
        value={formatMoney(simulacion.total_final)}
        strong
      />

      {simulando && (
        <small style={styles.loading}>
          Recalculando simulación...
        </small>
      )}
    </div>
  );
}

function Row({ label, value, tone, strong = false }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>

      <strong
        style={{
          color:
            tone === "success"
              ? "#067647"
              : tone === "warning"
                ? "#b54708"
                : "#111827",
          fontSize: strong ? 18 : 15,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const styles = {
  box: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    display: "grid",
    gap: 10,
    background: "#f9fafb",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },

  label: {
    color: "#667085",
    fontSize: 14,
  },

  separator: {
    height: 1,
    background: "#eaecf0",
  },

  loading: {
    color: "#667085",
    fontSize: 12,
  },
};