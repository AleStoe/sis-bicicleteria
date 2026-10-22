import { formatMoney } from "../../utils/formatters";

export default function PagoVentaResumen({
  totalFinal = 0,
  saldo,
  estadoVenta,
  totalConfirmado,
  creditoAplicadoReal = 0,
  pagosConfirmados,
  pagosRevertidos,
  loading,
  guardando,
  onRefrescar,
}) {
  const total = Number(totalFinal || 0);
  const pendiente = Number(saldo || 0);
  const dineroIngresado = Number(totalConfirmado || 0);
  const creditoUsado = Number(creditoAplicadoReal || 0);
  const yaCubierto = Math.max(total - pendiente, 0);
  const beneficiosAplicados = Math.max(
    yaCubierto - dineroIngresado - creditoUsado,
    0
  );

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
        <Metric
          label="Total venta"
          value={formatMoney(total)}
        />

        <Metric
          label="Ya cubierto"
          value={formatMoney(yaCubierto)}
          tone="ok"
          helper="Pagos, crédito y beneficios aplicados."
        />

        <div style={styles.saldoBox}>
          <span style={styles.mutedSmall}>Falta cobrar</span>

          <strong style={styles.saldoValue}>
            {formatMoney(pendiente)}
          </strong>

          <span style={styles.mutedSmall}>
            Estado: {formatEstadoVenta(estadoVenta)}
          </span>
        </div>
      </div>

      <div style={styles.breakdown}>
        <BreakdownItem label="Pagos reales" value={formatMoney(dineroIngresado)} />
        <BreakdownItem label="Crédito usado" value={formatMoney(creditoUsado)} />
        <BreakdownItem label="Descuentos" value={formatMoney(beneficiosAplicados)} />
        <BreakdownItem label="Pagos cargados" value={pagosConfirmados.length} />
        {pagosRevertidos.length > 0 && (
          <BreakdownItem label="Revertidos" value={pagosRevertidos.length} tone="warn" />
        )}
      </div>
    </>
  );
}

function formatEstadoVenta(estado) {
  const labels = {
    creada: "Pendiente",
    pagada_parcial: "Pago parcial",
    pagada_total: "Pagada",
    entregada: "Entregada",
    anulada: "Anulada",
    devuelta: "Devuelta",
    devuelta_parcial: "Devuelta parcial",
  };

  return labels[estado] || estado || "-";
}

function BreakdownItem({ label, value, tone }) {
  return (
    <div style={styles.breakdownItem}>
      <span>{label}</span>
      <strong style={tone === "warn" ? styles.warnText : null}>{value}</strong>
    </div>
  );
}

function Metric({ label, value, tone, helper }) {
  const style =
    tone === "ok"
      ? styles.metricOk
      : tone === "warn"
        ? styles.metricWarn
        : tone === "info"
          ? styles.metricInfo
        : styles.metric;

  return (
    <div style={style}>
      <span style={styles.mutedSmall}>{label}</span>
      <strong>{value}</strong>
      {helper && <small style={styles.helper}>{helper}</small>}
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
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
    marginBottom: 10,
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

  helper: {
    color: "#667085",
    fontSize: 11,
    lineHeight: 1.25,
    fontWeight: 650,
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

  metricInfo: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 6,
    background: "#eff6ff",
    color: "#1d4ed8",
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

  breakdown: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },

  breakdownItem: {
    border: "1px solid #eaecf0",
    borderRadius: 999,
    padding: "7px 10px",
    background: "#f9fafb",
    color: "#475467",
    fontSize: 12,
    fontWeight: 750,
    display: "flex",
    gap: 6,
    alignItems: "center",
  },

  warnText: {
    color: "#b54708",
  },
};
