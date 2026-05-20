import { formatMoney } from "../../utils/formatters";

export default function PagoVentaResumen({
  saldo,
  estadoVenta,
  totalConfirmado,
  pagosConfirmados,
  pagosRevertidos,
  loading,
  guardando,
  onRefrescar,
}) {
  return (
    <>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Cobro</h2>
          <p style={styles.muted}>
            Registrá pagos y controlá el saldo de la venta.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefrescar}
          disabled={loading || guardando}
          style={styles.secondaryButton}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div style={styles.heroGrid}>
        <div style={styles.saldoBox}>
          <span style={styles.mutedSmall}>Saldo pendiente</span>

          <strong style={styles.saldoValue}>
            {formatMoney(saldo)}
          </strong>

          <span style={styles.mutedSmall}>
            Estado: {estadoVenta || "-"}
          </span>
        </div>

        <Metric
          label="Pagado"
          value={formatMoney(totalConfirmado)}
          tone="ok"
        />

        <Metric
          label="Pagos"
          value={pagosConfirmados.length}
        />

        <Metric
          label="Revertidos"
          value={pagosRevertidos.length}
          tone={pagosRevertidos.length ? "warn" : ""}
        />
      </div>
    </>
  );
}

function Metric({ label, value, tone }) {
  const style =
    tone === "ok"
      ? styles.metricOk
      : tone === "warn"
        ? styles.metricWarn
        : styles.metric;

  return (
    <div style={style}>
      <span style={styles.mutedSmall}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: 22,
  },

  muted: {
    margin: "6px 0 0",
    color: "#667085",
    fontSize: 14,
  },

  mutedSmall: {
    color: "#667085",
    fontSize: 13,
  },

  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#111827",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(230px, 1.4fr) repeat(3, minmax(130px, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  saldoBox: {
    border: "1px solid #fecdca",
    borderRadius: 14,
    padding: 14,
    background: "#fff1f0",
    color: "#b42318",
    display: "grid",
    gap: 6,
  },

  saldoValue: {
    fontSize: 30,
    lineHeight: 1,
  },

  metric: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 6,
    background: "#f9fafb",
    color: "#344054",
  },

  metricOk: {
    border: "1px solid #abefc6",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 6,
    background: "#ecfdf3",
    color: "#067647",
  },

  metricWarn: {
    border: "1px solid #f3dc97",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 6,
    background: "#fff8e1",
    color: "#8a6d00",
  },
};