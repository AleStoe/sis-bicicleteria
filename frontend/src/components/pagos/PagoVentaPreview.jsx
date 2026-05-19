export default function PagoVentaPreview({ preview, simulando, formatMoney }) {
  if (simulando) {
    return <div style={styles.info}>Simulando tramo...</div>;
  }

  if (!preview) return null;

  return (
    <div style={styles.preview}>
      <Mini label="Base" value={formatMoney(preview.monto_base_aplicado)} />
      <Mini label="Descuento" value={`- ${formatMoney(preview.descuento_aplicado)}`} tone="success" />
      <Mini label="Recargo" value={`+ ${formatMoney(preview.recargo_aplicado)}`} tone="warning" />
      <Mini label="Cobrado real" value={formatMoney(preview.monto_total_cobrado)} strong />
      <Mini label="Saldo restante" value={formatMoney(preview.saldo_restante_estimado)} />
    </div>
  );
}

function Mini({ label, value, tone, strong = false }) {
  return (
    <div style={styles.mini}>
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
  info: {
    color: "#667085",
    fontSize: 13,
    margin: "8px 0 12px",
  },

  preview: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },

  mini: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 12,
    background: "#f9fafb",
    display: "grid",
    gap: 5,
  },

  label: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 700,
  },
};