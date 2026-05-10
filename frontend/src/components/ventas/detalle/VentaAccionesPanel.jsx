import { Link } from "react-router-dom";

export default function VentaAccionesPanel({
  venta,
  procesando,
  puedeEntregar,
  puedeAnular,
  puedeDevolver,
  onEntregar,
  onAnular,
  onDevolverCompleta,
}) {
  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Acciones operativas</h2>
          <p style={subtitleStyle}>
            Operaciones disponibles según el estado actual de la venta.
          </p>
        </div>

        <Link to={`/ventas/${venta.id}/cobro`} style={primaryLinkActionStyle}>
          Cobrar venta
        </Link>
      </div>

      <div style={actionGridStyle}>
        <button
          onClick={onEntregar}
          disabled={!puedeEntregar || procesando}
          style={puedeEntregar ? primaryActionStyle : disabledActionStyle}
        >
          Entregar venta
        </button>

        <button
          onClick={onAnular}
          disabled={!puedeAnular || procesando}
          style={puedeAnular ? dangerActionStyle : disabledActionStyle}
        >
          Anular venta
        </button>

        <button
          onClick={onDevolverCompleta}
          disabled={!puedeDevolver || procesando}
          style={puedeDevolver ? warnActionStyle : disabledActionStyle}
        >
          Devolver venta completa
        </button>
      </div>

      <div style={smallNoteStyle}>
        Las devoluciones no revierten pagos: devuelven stock y generan crédito al cliente.
      </div>
    </section>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
  marginBottom: "16px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "14px",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: "20px",
};

const subtitleStyle = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};

const primaryActionStyle = {
  border: "none",
  background: "#12a15f",
  color: "white",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerActionStyle = {
  border: "1px solid #fecdca",
  background: "#fff1f0",
  color: "#b42318",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const warnActionStyle = {
  border: "1px solid #f3dc97",
  background: "#fff8e1",
  color: "#8a6d00",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const disabledActionStyle = {
  border: "1px solid #d0d5dd",
  background: "#f2f4f7",
  color: "#98a2b3",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "not-allowed",
};

const primaryLinkActionStyle = {
  display: "inline-block",
  textDecoration: "none",
  textAlign: "center",
  border: "none",
  background: "#1f6feb",
  color: "white",
  borderRadius: "10px",
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const smallNoteStyle = {
  marginTop: "12px",
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "12px",
  borderRadius: "8px",
  color: "#344054",
};