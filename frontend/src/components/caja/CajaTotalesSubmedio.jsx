import { MetricCard, useBreakpoint } from "../ui";

export default function CajaTotalesSubmedio({ totales, formatCurrency }) {
  const isMobile = useBreakpoint();

  return (
    <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
      <MetricCard
        label="Neto de movimientos en efectivo"
        value={formatCurrency(totales.efectivo)}
        tone={Number(totales.efectivo) < 0 ? "danger" : "success"}
      />
      <MetricCard
        label="Transferencia"
        value={formatCurrency(totales.transferencia)}
      />
      <MetricCard
        label="Mercado Pago"
        value={formatCurrency(totales.mercadopago)}
      />
      <MetricCard label="Tarjeta" value={formatCurrency(totales.tarjeta)} />
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  gridMobile: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
};
