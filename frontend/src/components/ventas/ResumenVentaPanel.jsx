function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export default function ResumenVentaPanel({ total }) {
  return (
    <section style={summaryStyle}>
      <div style={summaryLineStyle}>
        <span>Subtotal</span>
        <strong>{formatMoney(total)}</strong>
      </div>
      <div style={summaryLineStyle}>
        <span>Descuento</span>
        <strong>{formatMoney(0)}</strong>
      </div>
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
