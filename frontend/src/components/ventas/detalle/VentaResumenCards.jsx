import EstadoVentaBadge from "../EstadoVentaBadge";
import { MetricCard, useBreakpoint } from "../../ui";

export default function VentaResumenCards({
  venta,
  totalFinal,
  totalPagadoReal,
  cubiertoNoPago,
  saldoPendiente,
  formatMoney,
}) {
  const { isMobile } = useBreakpoint();

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
        gap: isMobile ? "8px" : "12px",
      }}
    >
      <MetricCard label="Total final" value={formatMoney(totalFinal)} />

      <MetricCard
        label="Cobrado bruto"
        value={formatMoney(totalPagadoReal)}
        tone="success"
      />

      <MetricCard
        label="Cobertura no cobrada"
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
