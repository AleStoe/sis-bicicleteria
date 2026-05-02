import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarDeudas } from "../services/deudasService";

export function formatMoney(value) {
  const number = Number(value || 0);
  return number.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

export function EstadoDeudaBadge({ estado }) {
  const colors = {
    abierta: { background: "#fff7e6", color: "#ad6800", border: "#ffd591" },
    cerrada: { background: "#e8fff0", color: "#146c2e", border: "#b7ebc6" },
    cancelada: { background: "#fff1f0", color: "#b42318", border: "#f4c7c3" },
  };

  const style = colors[estado] || { background: "#f2f4f7", color: "#344054", border: "#d0d5dd" };

  return (
    <span style={{ ...badgeStyle, ...style }}>
      {estado || "-"}
    </span>
  );
}

export default function DeudasListPage() {
  const [deudas, setDeudas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ estado: "abierta", id_cliente: "" });

  useEffect(() => {
    cargarDeudas();
  }, []);

  async function cargarDeudas(params = filtros) {
    try {
      setLoading(true);
      setError("");
      const data = await listarDeudas(params);
      setDeudas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las deudas");
    } finally {
      setLoading(false);
    }
  }

  function aplicarFiltros(e) {
    e.preventDefault();
    cargarDeudas(filtros);
  }

  function limpiarFiltros() {
    const next = { estado: "", id_cliente: "" };
    setFiltros(next);
    cargarDeudas(next);
  }

  const resumen = useMemo(() => {
    const abiertas = deudas.filter((d) => d.estado === "abierta");
    const saldoAbierto = abiertas.reduce((acc, d) => acc + Number(d.saldo_actual || 0), 0);
    return {
      cantidad: deudas.length,
      abiertas: abiertas.length,
      saldoAbierto,
    };
  }, [deudas]);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Deudas / Cuenta corriente</h1>
          <p style={mutedStyle}>Control de saldos pendientes por cliente.</p>
        </div>

        <button onClick={() => cargarDeudas()} disabled={loading}>Refrescar</button>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={summaryGridStyle}>
        <SummaryCard label="Deudas listadas" value={resumen.cantidad} />
        <SummaryCard label="Abiertas" value={resumen.abiertas} />
        <SummaryCard label="Saldo abierto" value={formatMoney(resumen.saldoAbierto)} />
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Filtros</h2>
        <form onSubmit={aplicarFiltros} style={filtersStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Estado</span>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros((p) => ({ ...p, estado: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Todos</option>
              <option value="abierta">Abierta</option>
              <option value="cerrada">Cerrada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>ID cliente</span>
            <input
              value={filtros.id_cliente}
              onChange={(e) => setFiltros((p) => ({ ...p, id_cliente: e.target.value }))}
              placeholder="Ej: 12"
              style={inputStyle}
            />
          </label>

          <button type="submit" disabled={loading} style={{ alignSelf: "end" }}>Aplicar</button>
          <button type="button" disabled={loading} onClick={limpiarFiltros} style={{ alignSelf: "end" }}>Limpiar</button>
        </form>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Listado</h2>
        </div>

        {loading ? (
          <div style={{ padding: "18px" }}>Cargando deudas...</div>
        ) : deudas.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay deudas para los filtros seleccionados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Origen</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Recargo</th>
                  <th style={thStyle}>Observación</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {deudas.map((deuda) => (
                  <tr key={deuda.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{deuda.id}</td>
                    <td style={tdStyle}>
                      <strong>{deuda.cliente_nombre || `Cliente #${deuda.id_cliente}`}</strong>
                      <div style={mutedSmallStyle}>ID #{deuda.id_cliente}</div>
                    </td>
                    <td style={tdStyle}>{deuda.origen_tipo} #{deuda.origen_id}</td>
                    <td style={tdStyle}><strong>{formatMoney(deuda.saldo_actual)}</strong></td>
                    <td style={tdStyle}><EstadoDeudaBadge estado={deuda.estado} /></td>
                    <td style={tdStyle}>{deuda.genera_recargo ? `${deuda.tasa_recargo || "-"}%` : "No"}</td>
                    <td style={tdStyle}>{deuda.observacion || "-"}</td>
                    <td style={tdStyle}>
                      <Link to={`/deudas/${deuda.id}`} style={linkBtnStyle}>Ver detalle</Link>
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
      <div style={{ fontSize: "24px", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const mutedSmallStyle = { color: "#667085", fontSize: "13px", marginTop: "4px" };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const filtersStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", alignItems: "end" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1000px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white", display: "inline-block" };
const badgeStyle = { display: "inline-block", padding: "4px 10px", borderRadius: "999px", border: "1px solid", fontSize: "13px", fontWeight: 700 };
