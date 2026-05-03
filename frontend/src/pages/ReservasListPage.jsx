import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarReservas } from "../services/reservasService";

const ESTADOS = ["", "activa", "vencida", "cancelada", "convertida_en_venta"];

export default function ReservasListPage() {
  const [reservas, setReservas] = useState([]);
  const [filtros, setFiltros] = useState({
    estado: "activa",
    q: "",
    solo_vencidas: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarReservas();
  }, []);

  async function cargarReservas(e) {
    if (e) e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await listarReservas({
        estado: filtros.solo_vencidas ? undefined : filtros.estado,
        q: filtros.q || undefined,
        solo_vencidas: filtros.solo_vencidas || undefined,
      });

      setReservas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las reservas");
    } finally {
      setLoading(false);
    }
  }

  const totalSenas = reservas.reduce((acc, r) => acc + Number(r.sena_total || 0), 0);
  const totalSaldos = reservas.reduce((acc, r) => acc + Number(r.saldo_estimado || 0), 0);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Reservas</h1>
          <p style={mutedStyle}>Control de reservas, señas, vencimientos y conversión a venta.</p>
        </div>

        <Link to="/reservas/nueva" style={primaryLinkStyle}>
          Nueva reserva
        </Link>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={cardStyle}>
        <form onSubmit={cargarReservas} style={filtersStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Estado</span>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros((p) => ({ ...p, estado: e.target.value, solo_vencidas: false }))}
              style={inputStyle}
              disabled={filtros.solo_vencidas}
            >
              {ESTADOS.map((estado) => (
                <option key={estado || "todos"} value={estado}>
                  {estado || "todos"}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Buscar</span>
            <input
              value={filtros.q}
              onChange={(e) => setFiltros((p) => ({ ...p, q: e.target.value }))}
              placeholder="Cliente o nota"
              style={inputStyle}
            />
          </label>

          <label style={checkStyle}>
            <input
              type="checkbox"
              checked={filtros.solo_vencidas}
              onChange={(e) => setFiltros((p) => ({ ...p, solo_vencidas: e.target.checked }))}
            />
            Solo vencidas
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </section>

      <section style={summaryGridStyle}>
        <Metric label="Reservas mostradas" value={reservas.length} />
        <Metric label="Señas" value={formatMoney(totalSenas)} />
        <Metric label="Saldos estimados" value={formatMoney(totalSaldos)} />
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <h2 style={{ margin: 0 }}>Listado</h2>
        </div>

        {loading ? (
          <div style={{ padding: "18px" }}>Cargando reservas...</div>
        ) : reservas.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay reservas para mostrar.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Vencimiento</th>
                  <th style={thStyle}>Seña</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Alerta</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((reserva) => (
                  <tr key={reserva.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{reserva.id}</td>
                    <td style={tdStyle}>{formatDate(reserva.fecha_reserva)}</td>
                    <td style={tdStyle}>{reserva.cliente_nombre} #{reserva.id_cliente}</td>
                    <td style={tdStyle}><EstadoReservaBadge estado={reserva.estado} /></td>
                    <td style={tdStyle}>{reserva.fecha_vencimiento ? formatDate(reserva.fecha_vencimiento) : "-"}</td>
                    <td style={tdStyle}>{formatMoney(reserva.sena_total)}</td>
                    <td style={tdStyle}>{formatMoney(reserva.saldo_estimado)}</td>
                    <td style={tdStyle}>{reserva.sena_baja ? <span style={warningPillStyle}>Seña baja</span> : "-"}</td>
                    <td style={tdStyle}>
                      <Link to={`/reservas/${reserva.id}`} style={linkBtnStyle}>Ver detalle</Link>
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

function Metric({ label, value }) {
  return (
    <div style={metricStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong style={metricValueStyle}>{value}</strong>
    </div>
  );
}

export function EstadoReservaBadge({ estado }) {
  const colors = {
    activa: { bg: "#ecfdf3", color: "#067647" },
    vencida: { bg: "#fffaeb", color: "#b54708" },
    cancelada: { bg: "#fff1f0", color: "#b42318" },
    convertida_en_venta: { bg: "#eef4ff", color: "#175cd3" },
  };

  const style = colors[estado] || { bg: "#f2f4f7", color: "#475467" };

  return (
    <span style={{
      background: style.bg,
      color: style.color,
      borderRadius: "999px",
      padding: "4px 8px",
      fontSize: "13px",
      fontWeight: "bold",
      whiteSpace: "nowrap",
    }}>
      {estado}
    </span>
  );
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const primaryLinkStyle = { textDecoration: "none", background: "#0b5bd3", color: "white", padding: "10px 14px", borderRadius: "10px", fontWeight: "bold" };
const filtersStyle = { display: "grid", gridTemplateColumns: "190px minmax(260px,1fr) auto auto", gap: "14px", alignItems: "end" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const checkStyle = { display: "flex", alignItems: "center", gap: "8px", paddingBottom: "9px" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "16px", marginBottom: "16px" };
const metricStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", display: "grid", gap: "6px" };
const metricValueStyle = { fontSize: "24px" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1000px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 10px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white", display: "inline-block" };
const warningPillStyle = { background: "#fffaeb", color: "#b54708", borderRadius: "999px", padding: "4px 8px", fontWeight: "bold", fontSize: "13px" };
