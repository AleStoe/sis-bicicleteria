import { Link } from "react-router-dom";
import { EstadoVentaBadge } from "../../../pages/VentasListPage";

export default function VentaHeader({
  venta,
  procesando,
  onRefrescar,
}) {
  return (
    <header style={headerStyle}>
      <div>
        <div style={titleRowStyle}>
          <h1 style={titleStyle}>Venta #{venta.id}</h1>
          <EstadoVentaBadge estado={venta.estado} />
        </div>

        <p style={mutedStyle}>
          {venta.cliente_nombre} · {venta.sucursal_nombre}
        </p>
      </div>

      <div style={actionsStyle}>
        <button onClick={onRefrescar} disabled={procesando} style={secondaryBtnStyle}>
          Refrescar
        </button>

        <Link to="/ventas" style={secondaryLinkStyle}>
          Volver
        </Link>
      </div>
    </header>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const titleRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: "30px",
};

const mutedStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryLinkStyle = {
  textDecoration: "none",
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
};