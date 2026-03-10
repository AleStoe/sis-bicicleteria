import { Link } from "react-router-dom";

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
        <Link to="/ventas/nueva">Nueva venta</Link>
        <Link to="/ventas">Ventas</Link>
        <Link to="/stock">Stock</Link>
      </nav>
    </aside>
  );
}
