import { NavLink } from "react-router-dom";

function navStyle({ isActive }) {
  return {
    textDecoration: "none",
    padding: "8px 10px",
    borderRadius: "8px",
    background: isActive ? "#e5e7eb" : "transparent",
    fontWeight: isActive ? "bold" : "normal",
    color: "#111827",
  };
}

export default function Sidebar() {
  return (
    <aside
      style={{
        width: "220px",
        borderRight: "1px solid #ddd",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <h2>Sis Bicicletería</h2>

      <nav style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <NavLink to="/ventas/nueva" style={navStyle}>
          Nueva venta
        </NavLink>

        <NavLink to="/ventas" style={navStyle}>
          Ventas
        </NavLink>

        <NavLink to="/clientes" style={navStyle}>
          Clientes
        </NavLink>

        <NavLink to="/taller" style={navStyle}>
          Taller
        </NavLink>

        <NavLink to="/stock" style={navStyle}>
          Stock
        </NavLink>

        <NavLink to="/caja" style={navStyle}>
          Caja
        </NavLink>
        <NavLink to="/deudas" style={navStyle}>
          Deudas
        </NavLink>
        <NavLink to="/pagos" style={navStyle}>
          Pagos
        </NavLink>
        <NavLink to="/creditos" style={navStyle}>
          Créditos
        </NavLink>
        <NavLink to="/reservas" style={navStyle}>
          Reservas
        </NavLink>
        <NavLink to="/auditoria" style={navStyle}>
          Auditoría
        </NavLink>
      </nav>
    </aside>
  );
}