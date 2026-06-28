import EstadoVentaBadge from "../EstadoVentaBadge";
import { MetricCard, useBreakpoint } from "../../ui";

export default function VentaResumenCards({
  venta,
  situacionFinanciera,
  totalFinal,
  totalPagadoReal,
  cubiertoNoPago,
  saldoPendiente,
  formatMoney,
}) {
  const { isMobile } = useBreakpoint();
  const resumen = situacionFinanciera?.resumen || {};
  const pagosDeudaCobrado = Number(resumen.pagos_deuda_cobrado || 0);
  const tieneCobroPorDeuda = pagosDeudaCobrado > 0;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
        gap: isMobile ? "8px" : "12px",
      }}
    >
      <MetricCard label="Total venta" value={formatMoney(totalFinal)} />

      <MetricCard
        label={tieneCobroPorDeuda ? "Cobrado real total" : "Cobrado real"}
        value={formatMoney(totalPagadoReal)}
        tone="success"
      />

      <MetricCard
        label="Cubierto sin caja"
        value={formatMoney(cubiertoNoPago)}
        tone={cubiertoNoPago > 0 ? "warning" : "default"}
      />

      <MetricCard
        label="Falta cobrar"
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
