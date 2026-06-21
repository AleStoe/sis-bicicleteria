import { formatMoney } from "../../utils/formatters";

export default function PagoVentaPreview({ preview, simulando }) {
  if (simulando) {
    return <div style={styles.info}>Simulando tramo...</div>;
  }

  if (!preview) return null;

  const descuento = Number(preview.descuento_aplicado || 0);
  const recargo = Number(preview.recargo_aplicado || 0);
  const hayDescuento = descuento > 0;
  const hayRecargo = recargo > 0;
  const boxStyle = hayRecargo
    ? styles.boxWarning
    : hayDescuento
      ? styles.boxSuccess
      : styles.boxNeutral;

  return (
    <div style={styles.wrapper}>
      <div style={styles.operatorHint}>
        <span style={styles.operatorHintLabel}>
          {hayRecargo ? "Total a financiar ahora" : "Total a cobrar ahora"}
        </span>
        <strong>{formatMoney(preview.monto_total_cobrado)}</strong>
        <small>
          Cubre {formatMoney(preview.monto_base_aplicado)} de la venta.
          {hayDescuento && ` Descuento aplicado: ${formatMoney(descuento)}.`}
          {hayRecargo && ` Recargo aplicado: ${formatMoney(recargo)}.`}
          {` Queda pendiente: ${formatMoney(preview.saldo_restante_estimado)}.`}
        </small>
      </div>

      <div style={boxStyle}>
        <div style={styles.previewTitle}>
          {hayRecargo
            ? "Financiacion aplicada"
            : hayDescuento
              ? "Beneficio aplicado"
              : "Resumen del cobro"}
        </div>

        <Row label="Cubre saldo" value={formatMoney(preview.monto_base_aplicado)} />

        {hayDescuento && (
          <Row label="Descuento" value={`- ${formatMoney(descuento)}`} tone="success" />
        )}

        {hayRecargo && (
          <Row label="Recargo" value={`+ ${formatMoney(recargo)}`} tone="warning" />
        )}

        <Row label="Saldo pendiente luego" value={formatMoney(preview.saldo_restante_estimado)} />

        <div style={styles.previewTotalRow}>
          <span>{hayRecargo ? "Total a financiar ahora" : "Total a cobrar ahora"}</span>
          <strong>{formatMoney(preview.monto_total_cobrado)}</strong>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div style={styles.previewRow}>
      <span>{label}</span>
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

  wrapper: {
    display: "grid",
    gap: 12,
    marginBottom: 12,
  },

  operatorHint: {
    borderRadius: 14,
    padding: 12,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    display: "grid",
    gap: 4,
  },

  operatorHintLabel: {
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#2563eb",
  },

  boxNeutral: {
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 8,
  },

  boxSuccess: {
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    display: "grid",
    gap: 8,
  },

  boxWarning: {
    borderRadius: 14,
    padding: 12,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    display: "grid",
    gap: 8,
  },

  previewTitle: {
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#475569",
  },

  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },

  previewTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(15, 23, 42, 0.12)",
    fontSize: 18,
    fontWeight: 1000,
    color: "#0f172a",
  },
};
