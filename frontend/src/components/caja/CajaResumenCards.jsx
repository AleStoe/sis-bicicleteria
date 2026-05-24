import { MetricCard } from "../ui";

export default function CajaResumenCards({ detalle, formatCurrency }) {
  return (
    <div style={styles.grid}>
      <MetricCard label="Estado" value={detalle.caja.estado} />
      <MetricCard label="Fecha" value={detalle.caja.fecha} />
      <MetricCard
        label="Apertura"
        value={formatCurrency(detalle.caja.monto_apertura)}
      />
      <MetricCard
        label="Efectivo teórico"
        value={formatCurrency(detalle.efectivo_teorico)}
        emphasize
        tone="primary"
      />
      <MetricCard label="Caja" value={`#${detalle.caja.id}`} />
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
};
