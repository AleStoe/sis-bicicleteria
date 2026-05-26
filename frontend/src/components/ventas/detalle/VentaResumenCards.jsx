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
      <MetricCard label="Total final" value={formatMoney(totalFinal)} />

      <MetricCard
        label="Cobrado bruto"
        value={formatMoney(totalPagadoReal)}
        tone="success"
      />

      <MetricCard
        label="Crédito aplicado"
        value={formatMoney(cubiertoNoPago)}
        tone={cubiertoNoPago > 0 ? "success" : "default"}
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
