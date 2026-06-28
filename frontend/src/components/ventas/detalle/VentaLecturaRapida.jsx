import { Card, OperationalStatusBadge, useBreakpoint } from "../../ui";

export default function VentaLecturaRapida({
  venta,
  items = [],
  situacionFinanciera,
  totalFinal,
  totalPagadoReal,
  saldoPendiente,
  formatMoney,
}) {
  const { isMobile } = useBreakpoint();
  const visibles = items.slice(0, 3);
  const restantes = Math.max(items.length - visibles.length, 0);
  const resumen = situacionFinanciera?.resumen || {};
  const pagosDeudaCobrado = Number(resumen.pagos_deuda_cobrado || 0);
  const baseCanceladaPorDeuda = Number(resumen.base_cancelada_por_pagos_deuda || 0);
  const cobroPorDeudaDiferencia = pagosDeudaCobrado - baseCanceladaPorDeuda;
  const tieneCobroPorDeuda = pagosDeudaCobrado > 0;

  return (
    <Card
      title="Lectura rapida"
      subtitle="Resumen para entender la venta sin recorrer toda la pantalla."
      bodyStyle={{ padding: isMobile ? 12 : 14 }}
    >
      <div style={{ ...gridStyle, ...(isMobile ? gridMobileStyle : {}) }}>
        <SummaryBlock
          title="Se vendio"
          value={`${items.length} item${items.length === 1 ? "" : "s"}`}
          detail={
            visibles.length
              ? `${visibles.map((item) => item.descripcion_snapshot || `Item #${item.id}`).join(", ")}${
                  restantes > 0 ? ` y ${restantes} mas` : ""
                }`
              : "Sin items cargados"
          }
        />

        <SummaryBlock
          title="Total venta"
          value={formatMoney(totalFinal)}
          detail="Importe final de la operacion."
        />

        <SummaryBlock
          title={tieneCobroPorDeuda ? "Cobrado real total" : "Cobrado real"}
          value={formatMoney(totalPagadoReal)}
          detail={
            tieneCobroPorDeuda
              ? `Incluye ${formatMoney(pagosDeudaCobrado)} cobrado desde deuda asociada.`
              : saldoPendiente > 0
                ? "Todavia queda saldo pendiente."
                : "La venta no tiene saldo por cobrar."
          }
          tone={saldoPendiente > 0 ? "warning" : "success"}
        />

        <SummaryBlock
          title="Falta cobrar"
          value={formatMoney(saldoPendiente)}
          detail={<OperationalStatusBadge domain="venta" status={venta.estado} />}
          tone={saldoPendiente > 0 ? "danger" : "success"}
        />
      </div>

      {tieneCobroPorDeuda && (
        <div style={debtExplanationStyle}>
          <strong>Esta venta se termino de cobrar desde una deuda asociada.</strong>
          <span>
            Total de venta/base: {formatMoney(totalFinal)}. Cobrado por deuda: {formatMoney(pagosDeudaCobrado)}.
            {Math.abs(cobroPorDeudaDiferencia) > 0.01
              ? ` La diferencia contra la base (${formatMoney(Math.abs(cobroPorDeudaDiferencia))}) viene de descuentos o financiacion aplicados al cobrar esa deuda.`
              : " No hubo diferencia entre base cancelada y cobro real."}
          </span>
        </div>
      )}
    </Card>
  );
}

function SummaryBlock({ title, value, detail, tone = "default" }) {
  return (
    <div style={{ ...blockStyle, ...getToneStyle(tone) }}>
      <span style={labelStyle}>{title}</span>
      <strong style={valueStyle}>{value}</strong>
      <div style={detailStyle}>{detail}</div>
    </div>
  );
}

function getToneStyle(tone) {
  if (tone === "success") return { borderColor: "#bbf7d0", background: "#f0fdf4" };
  if (tone === "warning") return { borderColor: "#fde68a", background: "#fffbeb" };
  if (tone === "danger") return { borderColor: "#fecaca", background: "#fff1f0" };
  return {};
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

const gridMobileStyle = {
  gridTemplateColumns: "1fr",
};

const blockStyle = {
  border: "1px solid #eaecf0",
  borderRadius: 12,
  background: "#ffffff",
  padding: 12,
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const labelStyle = {
  color: "#667085",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const valueStyle = {
  color: "#111827",
  fontSize: 18,
  lineHeight: 1.15,
  overflowWrap: "anywhere",
};

const detailStyle = {
  color: "#475467",
  fontSize: 13,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const debtExplanationStyle = {
  marginTop: 12,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 4,
  fontSize: 13,
  lineHeight: 1.4,
};
