import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarPagos, revertirPago } from "../services/pagosService";

const ID_USUARIO = 1;

export default function PagosPage() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    cargarPagos();
  }, []);

  async function cargarPagos() {
    try {
      setLoading(true);
      setError("");
      const data = await listarPagos();
      setPagos(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pagos");
    } finally {
      setLoading(false);
    }
  }

  const pagosFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const base = pagos || [];
    if (!q) return base;

    return base.filter((p) => {
      const texto = [
        p.id,
        p.origen_tipo,
        p.origen_id,
        p.medio_pago,
        p.estado,
        p.nota,
        p.id_cliente,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [pagos, filtro]);

  async function handleRevertirPago(pago) {
    const motivo = window.prompt("Motivo de reversión del pago:");
    if (!motivo || !motivo.trim()) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await revertirPago(pago.id, {
        motivo: motivo.trim(),
        id_usuario: ID_USUARIO,
      });

      await cargarPagos();
      setMensaje(`Pago #${pago.id} revertido correctamente`);
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setGuardando(false);
    }
  }

  function renderOrigen(pago) {
    if (pago.origen_tipo === "venta") {
      return <Link to={`/ventas/${pago.origen_id}`}>Venta #{pago.origen_id}</Link>;
    }

    return `${pago.origen_tipo} #${pago.origen_id}`;
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando pagos...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Pagos</h1>
          <p style={mutedStyle}>Control global de pagos, reversión y trazabilidad.</p>
        </div>
        <button onClick={cargarPagos} disabled={guardando}>Refrescar</button>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={cardStyle}>
        <div style={toolbarStyle}>
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por origen, medio, estado, cliente, nota..."
            style={inputStyle}
          />
          <div style={mutedStyle}>{pagosFiltrados.length} pago(s)</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Origen</th>
                <th style={thStyle}>Medio</th>
                <th style={thStyle}>Monto</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Usuario</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.length === 0 ? (
                <tr><td colSpan="9" style={tdStyle}>No hay pagos para mostrar.</td></tr>
              ) : (
                pagosFiltrados.map((pago) => (
                  <tr key={pago.id}>
                    <td style={tdStyle}>#{pago.id}</td>
                    <td style={tdStyle}>{formatDate(pago.fecha)}</td>
                    <td style={tdStyle}>{pago.id_cliente ? `#${pago.id_cliente}` : "-"}</td>
                    <td style={tdStyle}>{renderOrigen(pago)}</td>
                    <td style={tdStyle}>{pago.medio_pago}</td>
                    <td style={tdStyle}>{formatMoney(pago.monto_total_cobrado)}</td>
                    <td style={tdStyle}>{pago.estado}</td>
                    <td style={tdStyle}>#{pago.id_usuario}</td>
                    <td style={tdStyle}>
                      {pago.estado === "confirmado" && pago.origen_tipo === "venta" ? (
                        <button disabled={guardando} onClick={() => handleRevertirPago(pago)}>
                          Revertir
                        </button>
                      ) : (
                        <span style={mutedStyle}>Sin acciones</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const toolbarStyle = { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto", gap: "12px", alignItems: "center", marginBottom: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1050px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", borderTop: "1px solid #eee", verticalAlign: "top" };
