import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarClientes } from "../services/clientesService";
import {
  listarCreditosCliente,
  listarCreditosDisponiblesCliente,
} from "../services/creditosService";

export default function CreditosListPage() {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [soloDisponibles, setSoloDisponibles] = useState(true);
  const [creditos, setCreditos] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingCreditos, setLoadingCreditos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarClientes();
  }, []);

  async function cargarClientes() {
    try {
      setLoadingClientes(true);
      setError("");

      const data = await listarClientes({ solo_activos: true });
      setClientes(data || []);

      const primerClienteNoGenerico = (data || []).find((cliente) => Number(cliente.id) !== 1);
      if (primerClienteNoGenerico) {
        setClienteId(String(primerClienteNoGenerico.id));
        await cargarCreditos(String(primerClienteNoGenerico.id), soloDisponibles);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes");
    } finally {
      setLoadingClientes(false);
    }
  }

  async function cargarCreditos(id = clienteId, disponibles = soloDisponibles) {
    if (!id) {
      setCreditos([]);
      return;
    }

    try {
      setLoadingCreditos(true);
      setError("");

      const data = disponibles
        ? await listarCreditosDisponiblesCliente(id)
        : await listarCreditosCliente(id);

      setCreditos(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los créditos");
      setCreditos([]);
    } finally {
      setLoadingCreditos(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await cargarCreditos(clienteId, soloDisponibles);
  }

  function handleSoloDisponiblesChange(value) {
    setSoloDisponibles(value);
    cargarCreditos(clienteId, value);
  }

  const totalSaldo = creditos.reduce((acc, credito) => acc + Number(credito.saldo_actual || 0), 0);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Créditos</h1>
          <p style={mutedStyle}>
            Saldos a favor de clientes generados por anulaciones, devoluciones o ajustes.
          </p>
        </div>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={cardStyle}>
        <form onSubmit={handleSubmit} style={filtersStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Cliente</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              style={inputStyle}
              disabled={loadingClientes}
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} #{cliente.id}
                </option>
              ))}
            </select>
          </label>

          <label style={checkStyle}>
            <input
              type="checkbox"
              checked={soloDisponibles}
              onChange={(e) => handleSoloDisponiblesChange(e.target.checked)}
            />
            Solo créditos disponibles
          </label>

          <button type="submit" disabled={!clienteId || loadingCreditos}>
            {loadingCreditos ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </section>

      <section style={summaryGridStyle}>
        <div style={metricStyle}>
          <span style={mutedStyle}>Créditos encontrados</span>
          <strong style={metricValueStyle}>{creditos.length}</strong>
        </div>

        <div style={metricStyle}>
          <span style={mutedStyle}>Saldo total mostrado</span>
          <strong style={metricValueStyle}>{formatMoney(totalSaldo)}</strong>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <h2 style={{ margin: 0 }}>Listado</h2>
        </div>

        {loadingCreditos ? (
          <div style={{ padding: "18px" }}>Cargando créditos...</div>
        ) : creditos.length === 0 ? (
          <div style={{ padding: "18px" }}>
            No hay créditos para el cliente seleccionado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Origen</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Observación</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {creditos.map((credito) => (
                  <tr key={credito.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{credito.id}</td>
                    <td style={tdStyle}>#{credito.id_cliente}</td>
                    <td style={tdStyle}>
                      {credito.origen_tipo} #{credito.origen_id}
                    </td>
                    <td style={tdStyle}>{formatMoney(credito.saldo_actual)}</td>
                    <td style={tdStyle}>
                      <EstadoCreditoBadge estado={credito.estado} />
                    </td>
                    <td style={tdStyle}>{credito.observacion || "-"}</td>
                    <td style={tdStyle}>
                      <Link to={`/creditos/${credito.id}`} style={linkBtnStyle}>
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

export function EstadoCreditoBadge({ estado }) {
  const colors = {
    abierto: { bg: "#ecfdf3", color: "#067647" },
    aplicado_parcial: { bg: "#fffaeb", color: "#b54708" },
    aplicado_total: { bg: "#f2f4f7", color: "#475467" },
  };

  const style = colors[estado] || { bg: "#eef4ff", color: "#175cd3" };

  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        borderRadius: "999px",
        padding: "4px 8px",
        fontSize: "13px",
        fontWeight: "bold",
        whiteSpace: "nowrap",
      }}
    >
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

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const filtersStyle = { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto auto", gap: "14px", alignItems: "end" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const checkStyle = { display: "flex", alignItems: "center", gap: "8px", paddingBottom: "9px" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" };
const metricStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", display: "grid", gap: "6px" };
const metricValueStyle = { fontSize: "24px" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 10px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white", display: "inline-block" };
