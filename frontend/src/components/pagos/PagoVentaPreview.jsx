import { formatMoney } from "../../utils/formatters";

export default function PagoVentaPreview({ preview, simulando }) {
  if (simulando) {
    return <div style={styles.info}>Simulando tramo...</div>;
  }

  if (!preview) return null;

  return (
    <div style={styles.box}>
      <div style={styles.main}>
        <span style={styles.mainLabel}>Cobrado real</span>
        <strong style={styles.mainAmount}>
          {formatMoney(preview.monto_total_cobrado)}
        </strong>
      </div>

      <div style={styles.grid}>
        <Mini label="Base" value={formatMoney(preview.monto_base_aplicado)} />
        <Mini
          label="Descuento"
          value={`- ${formatMoney(preview.descuento_aplicado)}`}
          tone="success"
        />
        <Mini
          label="Recargo"
          value={`+ ${formatMoney(preview.recargo_aplicado)}`}
          tone="warning"
        />
        <Mini
          label="Saldo restante"
          value={formatMoney(preview.saldo_restante_estimado)}
        />
      </div>
    </div>
  );
}

function Mini({ label, value, tone }) {
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

  box: {
    display: "grid",
    gap: 10,
    marginBottom: 12,
  },

  main: {
    border: "1px solid #abefc6",
    borderRadius: 14,
    padding: 14,
    background: "#ecfdf3",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  mainLabel: {
    color: "#067647",
    fontSize: 14,
    fontWeight: 900,
  },

  mainAmount: {
    color: "#067647",
    fontSize: 24,
    whiteSpace: "nowrap",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 8,
  },

  mini: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    background: "#f9fafb",
    display: "grid",
    gap: 4,
  },

  label: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 700,
  },
};