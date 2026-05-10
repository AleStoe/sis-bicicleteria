import { EstadoVentaBadge } from "../../../pages/VentasListPage";

export default function VentaResumenCards({
  venta,
  totalFinal,
  totalPagadoReal,
  cubiertoNoPago,
  saldoPendiente,
  formatMoney,
}) {
  return (
    <section style={heroStyle}>
      <HeroMetric label="Total venta" value={formatMoney(totalFinal)} />
      <HeroMetric label="Pagado real" value={formatMoney(totalPagadoReal)} tone="ok" />
      <HeroMetric
        label="Crédito / ajuste"
        value={formatMoney(cubiertoNoPago)}
        tone={cubiertoNoPago > 0 ? "warn" : ""}
      />
      <HeroMetric
        label="Saldo pendiente"
        value={formatMoney(saldoPendiente)}
        tone={saldoPendiente > 0 ? "danger" : "ok"}
      />

      <div style={heroMetricStyle}>
        <span>Estado</span>
        <EstadoVentaBadge estado={venta.estado} />
      </div>
    </section>
  );
}

function HeroMetric({ label, value, tone }) {
  const style =
    tone === "ok"
      ? heroMetricOkStyle
      : tone === "danger"
        ? heroMetricDangerStyle
        : tone === "warn"
          ? heroMetricWarnStyle
          : heroMetricStyle;

  return (
    <div style={style}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const heroMetricStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  display: "grid",
  gap: "8px",
  color: "#344054",
};

const heroMetricOkStyle = {
  ...heroMetricStyle,
  background: "#ecfdf3",
  borderColor: "#abefc6",
  color: "#067647",
};

const heroMetricDangerStyle = {
  ...heroMetricStyle,
  background: "#fff1f0",
  borderColor: "#fecdca",
  color: "#b42318",
};

const heroMetricWarnStyle = {
  ...heroMetricStyle,
  background: "#fff8e1",
  borderColor: "#f3dc97",
  color: "#8a6d00",
};