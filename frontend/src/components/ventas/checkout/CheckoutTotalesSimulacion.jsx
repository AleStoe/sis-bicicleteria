import { formatMoney } from "../../../utils/formatters";

export default function CheckoutTotalesSimulacion({ simulacion, simulando }) {
  if (!simulacion) return null;

  const descuento = Number(simulacion.descuento_total || 0);
  const recargo = Number(simulacion.recargo_total || 0);

  return (
    <details style={styles.details}>
      <summary style={styles.summary}>
        Ver detalle de precio lista / ajustes
        {simulando && <span style={styles.loading}>Recalculando...</span>}
      </summary>

      <div style={styles.box}>
        <Row label="Precio lista" value={formatMoney(simulacion.subtotal_base)} strong />

        {descuento > 0 && (
          <Row label="Descuentos por medio/regla" value={`- ${formatMoney(descuento)}`} tone="success" />
        )}

        {recargo > 0 && (
          <Row label="Financiacion" value={`+ ${formatMoney(recargo)}`} tone="warning" />
        )}

        <Row label="Precio final estimado" value={formatMoney(simulacion.total_final)} strong tone="primary" />

        <div style={styles.separator} />

        <Row label="Base asignada" value={formatMoney(simulacion.total_base_asignada ?? 0)} />
        <Row label="Pagos cargados" value={formatMoney(simulacion.total_pagos_cargados ?? 0)} />
        <Row label="Saldo estimado" value={formatMoney(simulacion.saldo_estimado ?? 0)} />
      </div>
    </details>
  );
}

function Row({ label, value, tone, strong }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <strong
        style={{
          ...styles.value,
          ...(strong ? styles.strongValue : {}),
          ...(tone === "success" ? styles.success : {}),
          ...(tone === "warning" ? styles.warning : {}),
          ...(tone === "primary" ? styles.primary : {}),
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const styles = {
  details: {
    border: "1px solid #eaecf0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    background: "#ffffff",
  },
  summary: {
    cursor: "pointer",
    color: "#344054",
    fontSize: 13,
    fontWeight: 950,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },
  loading: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 800,
  },
  box: {
    display: "grid",
    gap: 9,
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #eaecf0",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  label: {
    color: "#667085",
    fontSize: 13,
  },
  value: {
    color: "#111827",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  strongValue: {
    fontSize: 15,
  },
  separator: {
    height: 1,
    background: "#eaecf0",
    margin: "2px 0",
  },
  success: { color: "#079455" },
  warning: { color: "#b54708" },
  primary: { color: "#0b5bd3" },
};
