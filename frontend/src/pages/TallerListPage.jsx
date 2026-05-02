import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarOrdenesTaller } from "../services/tallerService";

export default function TallerListPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("activas");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarOrdenes();
  }, []);

  async function cargarOrdenes() {
    try {
      setLoading(true);
      setError("");
      const data = await listarOrdenesTaller();
      setOrdenes(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las órdenes de taller");
    } finally {
      setLoading(false);
    }
  }

  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return ordenes.filter((orden) => {
      const estado = orden.estado;
      const esFinal = estado === "retirada" || estado === "cancelada";

      if (estadoFiltro === "activas" && esFinal) return false;
      if (estadoFiltro !== "todas" && estadoFiltro !== "activas" && estado !== estadoFiltro) return false;

      if (!q) return true;

      const texto = [
        orden.id,
        orden.id_cliente,
        orden.id_bicicleta_cliente,
        orden.estado,
        orden.problema_reportado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [ordenes, estadoFiltro, busqueda]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando taller...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Taller</h1>
          <p style={mutedStyle}>Órdenes de reparación y trabajos pendientes</p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarOrdenes}>Refrescar</button>
          <Link to="/taller/nueva" style={primaryLinkStyle}>Nueva orden</Link>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section style={cardStyle}>
        <form style={filtersStyle} onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por orden, cliente, bici o problema"
            style={inputStyle}
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            style={inputStyle}
          >
            <option value="activas">Activas</option>
            <option value="todas">Todas</option>
            <option value="ingresada">Ingresada</option>
            <option value="presupuestada">Presupuestada</option>
            <option value="esperando_aprobacion">Esperando aprobación</option>
            <option value="esperando_repuestos">Esperando repuestos</option>
            <option value="en_reparacion">En reparación</option>
            <option value="terminada">Terminada</option>
            <option value="lista_para_retirar">Lista para retirar</option>
            <option value="retirada">Retirada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </form>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Listado</h2>
        </div>

        {ordenesFiltradas.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay órdenes para mostrar.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>Orden</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Bici</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Problema</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.map((orden) => (
                  <tr key={orden.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{orden.id}</td>
                    <td style={tdStyle}>{formatDate(orden.fecha_ingreso)}</td>
                    <td style={tdStyle}>#{orden.id_cliente}</td>
                    <td style={tdStyle}>#{orden.id_bicicleta_cliente}</td>
                    <td style={tdStyle}><EstadoBadge estado={orden.estado} /></td>
                    <td style={{ ...tdStyle, maxWidth: "360px" }}>{orden.problema_reportado}</td>
                    <td style={tdStyle}>{formatMoney(orden.total_final)}</td>
                    <td style={tdStyle}>
                      <Link to={`/taller/${orden.id}`} style={{ fontWeight: "bold" }}>Ver detalle</Link>
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

export function EstadoBadge({ estado }) {
  return <span style={badgeStyle(estado)}>{estado}</span>;
}

function Alert({ children }) {
  return <div style={alertStyle}>Error: {children}</div>;
}

export function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

function colorEstado(estado) {
  switch (estado) {
    case "ingresada": return "#1565c0";
    case "presupuestada": return "#7a4cc2";
    case "esperando_aprobacion": return "#b26a00";
    case "esperando_repuestos": return "#8a6d00";
    case "en_reparacion": return "#0f766e";
    case "terminada": return "#137333";
    case "lista_para_retirar": return "#166534";
    case "retirada": return "#555";
    case "cancelada": return "#b42318";
    default: return "#444";
  }
}

function badgeStyle(estado) {
  const color = colorEstado(estado);
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontWeight: "bold",
    fontSize: "13px",
    background: "#f3f4f6",
    color,
    border: `1px solid ${color}33`,
    whiteSpace: "nowrap",
  };
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const filtersStyle = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" };
const inputStyle = { minWidth: "260px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd" };
const primaryLinkStyle = { textDecoration: "none", padding: "9px 12px", borderRadius: "10px", color: "white", background: "#111827", fontWeight: "bold" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "980px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
