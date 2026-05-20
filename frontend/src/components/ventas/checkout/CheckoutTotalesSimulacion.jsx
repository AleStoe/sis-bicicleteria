import { formatMoney } from "../../../utils/formatters";

export default function CheckoutTotalesSimulacion({
  simulacion,
  simulando,
}) {
  if (!simulacion) return null;

  return (
    <div style={styles.box}>
      <div style={styles.mainRow}>
        <div>
          <div style={styles.mainLabel}>Total a cobrar</div>
          <div style={styles.mainHint}>Según pagos cargados</div>
        </div>

        <strong style={styles.mainAmount}>
          {formatMoney(simulacion.total_final)}
        </strong>
      </div>

      <div style={styles.compactGrid}>
        <Mini
          label="Descuento"
          value={`- ${formatMoney(simulacion.descuento_total)}`}
          tone="success"
        />

        <Mini
          label="Recargo"
          value={`+ ${formatMoney(simulacion.recargo_total)}`}
          tone="warning"
        />

        <Mini
          label="Saldo base"
          value={formatMoney(simulacion.saldo_base_estimado ?? 0)}
        />
      </div>

      <details style={styles.details}>
        <summary style={styles.summary}>Ver detalle financiero</summary>

        <div style={styles.detailRows}>
          <Row label="Subtotal base" value={formatMoney(simulacion.subtotal_base)} />

          <Row
            label="Base asignada"
            value={formatMoney(simulacion.total_base_asignada ?? 0)}
          />

          <Row
            label="Pagos cargados"
            value={formatMoney(simulacion.total_pagos_cargados ?? 0)}
          />

          <Row
            label="Saldo estimado"
            value={formatMoney(simulacion.saldo_estimado ?? 0)}
          />
        </div>
      </details>

      {simulando && (
        <small style={styles.loading}>Recalculando simulación...</small>
      )}
    </div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div style={styles.mini}>
      <span style={styles.miniLabel}>{label}</span>

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

function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <strong style={styles.value}>{value}</strong>
    </div>
  );
}

const styles = {
  box: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    display: "grid",
    gap: 12,
    background: "#f9fafb",
  },

  mainRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #eaecf0",
  },

  mainLabel: {
    fontSize: 14,
    color: "#667085",
    fontWeight: 800,
  },

  mainHint: {
    fontSize: 12,
    color: "#98a2b3",
    marginTop: 2,
  },

  mainAmount: {
    fontSize: 24,
    color: "#111827",
    whiteSpace: "nowrap",
  },

  compactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 8,
  },

  mini: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    background: "#ffffff",
    display: "grid",
    gap: 4,
  },

  miniLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 700,
  },

  details: {
    borderTop: "1px solid #eaecf0",
    paddingTop: 8,
  },

  summary: {
    cursor: "pointer",
    color: "#475467",
    fontSize: 13,
    fontWeight: 800,
  },

  detailRows: {
    display: "grid",
    gap: 8,
    marginTop: 10,
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
  },

  loading: {
    color: "#667085",
    fontSize: 12,
  },
};