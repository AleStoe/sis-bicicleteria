function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

const DESCUENTO_CONTADO_ESTIMADO = 10;

export default function ResumenVentaPanel({ total, mostrarContado = false }) {
  const totalContado = Number(total || 0) * (1 - DESCUENTO_CONTADO_ESTIMADO / 100);

  return (
    <section style={summaryStyle}>
      <div style={summaryLineStyle}>
        <span>Subtotal</span>
        <strong>{formatMoney(total)}</strong>
      </div>
      {mostrarContado && Number(total || 0) > 0 && (
        <div style={cashLineStyle}>
          <div>
            <span>Efectivo / transferencia</span>
            <small>{DESCUENTO_CONTADO_ESTIMADO}% OFF estimado</small>
          </div>
          <strong>{formatMoney(totalContado)}</strong>
        </div>
      )}
      <div style={totalLineStyle}>
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>
    </section>
  );
}

const summaryStyle = {
  borderTop: "1px solid #eaecf0",
  paddingTop: "10px",
  marginBottom: "12px",
};

const summaryLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "7px 0",
  color: "#475467",
};

const totalLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  paddingTop: "10px",
  fontSize: "24px",
  color: "#0b5bd3",
};

const cashLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  margin: "6px 0",
  padding: "10px 12px",
  border: "1px solid #fed7aa",
  borderRadius: 12,
  background: "#fff7ed",
  color: "#c2410c",
  fontWeight: 900,
};
