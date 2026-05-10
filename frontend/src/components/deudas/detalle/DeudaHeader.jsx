import { Link } from "react-router-dom";

export default function DeudaHeader({ deuda, onRefresh }) {
  return (
    <div style={headerStyle}>
      <div>
        <h1 style={{ margin: 0 }}>Deuda #{deuda.id}</h1>

        <p style={mutedStyle}>
          {deuda.cliente_nombre || `Cliente #${deuda.id_cliente}`}
          {deuda.cliente_dni ? ` · DNI ${deuda.cliente_dni}` : ""}
          {deuda.cliente_telefono ? ` · Tel ${deuda.cliente_telefono}` : ""}
        </p>

        <p style={subMutedStyle}>
          Origen: {deuda.origen_tipo} #{deuda.origen_id}
        </p>
      </div>

      <div style={actionsStyle}>
        <button onClick={onRefresh}>Refrescar</button>
        <Link to="/deudas" style={linkBtnStyle}>
          Volver
        </Link>
      </div>
    </div>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const mutedStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const subMutedStyle = {
  margin: "4px 0 0",
  color: "#98a2b3",
  fontSize: "14px",
};

const linkBtnStyle = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  color: "#111827",
  background: "white",
};