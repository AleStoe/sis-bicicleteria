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

function Section({ title, children }) {
  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside style={sidebarStyle}>
      <h2 style={titleStyle}>Sis Bicicletería</h2>

      <nav style={navWrapStyle}>
        <Section title="Ventas">
          <NavLink to="/ventas/nueva" style={navStyle}>Nueva venta</NavLink>
          <NavLink to="/ventas" style={navStyle}>Ventas</NavLink>
          <NavLink to="/reservas" style={navStyle}>Reservas</NavLink>
          <NavLink to="/deudas" style={navStyle}>Deudas</NavLink>
          <NavLink to="/creditos" style={navStyle}>Créditos</NavLink>
        </Section>

        <Section title="Operación">
          <NavLink to="/taller" style={navStyle}>Taller</NavLink>
          <NavLink to="/stock" style={navStyle}>Stock</NavLink>
          <NavLink to="/serializadas" style={navStyle}>Bicis serializadas</NavLink>
          <NavLink to="/mercaderia/alta" style={navStyle}>Alta mercadería</NavLink>
          <NavLink to="/mercaderia/bicicletas/alta" style={navStyle}> Alta bicicletas</NavLink>
        </Section>

        <Section title="Administración">
          <NavLink to="/caja" style={navStyle}>Caja</NavLink>
          <NavLink to="/pagos" style={navStyle}>Pagos</NavLink>
          <NavLink to="/precios" style={navStyle}>Precios</NavLink>
          <NavLink to="/catalogo" style={navStyle}>Catálogo</NavLink>
          <NavLink to="/proveedores" style={navStyle}>Proveedores</NavLink>
          <NavLink to="/clientes" style={navStyle}>Clientes</NavLink>
        </Section>

        <Section title="Control">
          <NavLink to="/auditoria" style={navStyle}>Auditoría</NavLink>
        </Section>
      </nav>
    </aside>
  );
}

const sidebarStyle = {
  width: "240px",
  borderRight: "1px solid #ddd",
  padding: "20px",
  boxSizing: "border-box",
  overflowY: "auto",
};

const titleStyle = {
  marginTop: 0,
  marginBottom: "20px",
  fontSize: "20px",
};

const navWrapStyle = {
  display: "grid",
  gap: "20px",
};

const sectionTitleStyle = {
  fontSize: "11px",
  fontWeight: 900,
  color: "#667085",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  marginBottom: "2px",
};