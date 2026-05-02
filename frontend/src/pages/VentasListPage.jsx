import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarVentas } from "../services/ventasService";

export function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

export function EstadoVentaBadge({ estado }) {
  const color = colorEstado(estado);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: "999px",
        fontWeight: "bold",
        fontSize: "13px",
        background: "#f3f4f6",
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {estado}
    </span>
  );
}

function colorEstado(estado) {
  switch (estado) {
    case "creada":
      return "#b26a00";
    case "pagada_parcial":
      return "#8a6d00";
    case "pagada_total":
      return "#1565c0";
    case "entregada":
      return "#137333";
    case "anulada":
      return "#b42318";
    default:
      return "#444";
  }
}

export default function VentasListPage() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");

  useEffect(() => {
    cargarVentas();
  }, []);

  async function cargarVentas() {
    try {
      setLoading(true);
      setError("");
      const data = await listarVentas();
      setVentas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ventas");
    } finally {
      setLoading(false);
    }
  }

  const ventasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return ventas.filter((venta) => {
      const coincideEstado = estadoFiltro === "todos" || venta.estado === estadoFiltro;
      const texto = [venta.id, venta.cliente_nombre, venta.sucursal_nombre, venta.estado]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const coincideBusqueda = !q || texto.includes(q);

      return coincideEstado && coincideBusqueda;
    });
  }, [ventas, busqueda, estadoFiltro]);

  const resumen = useMemo(() => {
    return ventasFiltradas.reduce(
      (acc, venta) => {
        acc.cantidad += 1;
        acc.total += Number(venta.total_final || 0);
        acc.saldo += Number(venta.saldo_pendiente || 0);
        return acc;
      },
      { cantidad: 0, total: 0, saldo: 0 }
    );
  }, [ventasFiltradas]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando ventas...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Ventas</h1>
          <p style={mutedStyle}>Listado alineado al contrato actual del backend.</p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarVentas}>Refrescar</button>
          <Link to="/ventas/nueva" style={linkBtnStyle}>Nueva venta</Link>
        </div>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={summaryGridStyle}>
        <SummaryCard label="Ventas" value={resumen.cantidad} />
        <SummaryCard label="Total filtrado" value={formatMoney(resumen.total)} />
        <SummaryCard label="Saldo pendiente" value={formatMoney(resumen.saldo)} />
      </section>

      <section style={cardStyle}>
        <div style={filtersStyle}>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, estado, sucursal o ID"
            style={inputStyle}
          />
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los estados</option>
            <option value="creada">creada</option>
            <option value="pagada_parcial">pagada_parcial</option>
            <option value="pagada_total">pagada_total</option>
            <option value="entregada">entregada</option>
            <option value="anulada">anulada</option>
          </select>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Listado</h2>
        </div>

        {ventasFiltradas.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay ventas para mostrar.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Sucursal</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {ventasFiltradas.map((venta) => (
                  <tr key={venta.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{venta.id}</td>
                    <td style={tdStyle}>{formatDate(venta.fecha)}</td>
                    <td style={tdStyle}>{venta.cliente_nombre}</td>
                    <td style={tdStyle}>{venta.sucursal_nombre}</td>
                    <td style={tdStyle}><EstadoVentaBadge estado={venta.estado} /></td>
                    <td style={tdStyle}>{formatMoney(venta.total_final)}</td>
                    <td style={tdStyle}>{formatMoney(venta.saldo_pendiente)}</td>
                    <td style={tdStyle}>
                      <Link to={`/ventas/${venta.id}`} style={{ fontWeight: "bold", textDecoration: "none" }}>
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#667085", fontSize: "13px", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" };
const filtersStyle = { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 220px", gap: "12px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "980px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
