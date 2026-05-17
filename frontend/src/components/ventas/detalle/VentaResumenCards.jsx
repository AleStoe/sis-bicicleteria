import EstadoVentaBadge from "../EstadoVentaBadge";
import { MetricCard } from "../../ui";

export default function VentaResumenCards({
  venta,
  totalFinal,
  totalPagadoReal,
  cubiertoNoPago,
  saldoPendiente,
  formatMoney,
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "12px",
      }}
    >
      <MetricCard label="Total venta" value={formatMoney(totalFinal)} />

      <MetricCard
        label="Pagado real"
        value={formatMoney(totalPagadoReal)}
        tone="success"
      />

      <MetricCard
        label="Crédito / ajuste"
        value={formatMoney(cubiertoNoPago)}
        tone={cubiertoNoPago > 0 ? "warning" : "default"}
      />

      <MetricCard
        label="Saldo pendiente"
        value={formatMoney(saldoPendiente)}
        tone={saldoPendiente > 0 ? "danger" : "success"}
      />

      <MetricCard
        label="Estado"
        value={<EstadoVentaBadge estado={venta.estado} />}
      />
    </section>
  );
}
