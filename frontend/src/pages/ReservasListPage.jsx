import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarReservas } from "../services/reservasService";
import { formatDate, formatMoney } from "../utils/formatters";
import useMediaQuery from "../hooks/useMediaQuery";

const ESTADOS = ["", "activa", "vencida", "cancelada", "convertida_en_venta"];

export default function ReservasListPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const metricas = useMemo(() => {
    const activas = reservas.filter((r) => r.estado === "activa").length;
    const vencenPronto = reservas.filter((r) => estaPorVencer(r.fecha_vencimiento, r.estado)).length;

    return {
      cantidad: reservas.length,
      activas,
      baseSenada: reservas.reduce((acc, r) => acc + Number(r.sena_total || 0), 0),
      saldoBase: reservas.reduce((acc, r) => acc + Number(r.saldo_estimado || 0), 0),
      vencenPronto,
    };
  }, [reservas]);

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <div style={isMobile ? headerMobileStyle : headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : undefined }}>Reservas</h1>
          <p style={mutedStyle}>Control de reservas, base señada, vencimientos y conversión a venta.</p>
        </div>

        <Link to="/reservas/nueva" style={{ ...primaryLinkStyle, ...(isMobile ? fullWidthStyle : {}) }}>
          Nueva reserva
        </Link>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={cardStyle}>
        <form onSubmit={cargarReservas} style={isMobile ? filtersMobileStyle : filtersStyle}>
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

          <button type="submit" disabled={loading} style={{ ...secondaryBtnStyle, ...(isMobile ? fullWidthStyle : {}) }}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </section>

      <section style={isMobile ? summaryGridMobileStyle : summaryGridStyle}>
        <Metric label="Reservas mostradas" value={metricas.cantidad} />
        <Metric label="Activas" value={metricas.activas} />
        <Metric label="Base señada" value={formatMoney(metricas.baseSenada)} />
        <Metric label="Saldo base pendiente" value={formatMoney(metricas.saldoBase)} />
        <Metric label="Vencen pronto" value={metricas.vencenPronto} />
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Listado</h2>
            <p style={mutedStyle}>La base señada puede diferir del dinero cobrado si hubo descuento o recargo por medio de pago.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "18px" }}>Cargando reservas...</div>
        ) : reservas.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay reservas para mostrar.</div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Vencimiento</th>
                  <th style={thStyle}>Vence en</th>
                  <th style={thStyle}>Base señada</th>
                  <th style={thStyle}>Saldo base</th>
                  <th style={thStyle}>Seña</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((reserva) => {
                  const vencimiento = describirVencimiento(reserva.fecha_vencimiento, reserva.estado);
                  const porcentajeSenado = calcularPorcentajeSenado(reserva);

                  return (
                    <tr key={reserva.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={tdStyle}>#{reserva.id}</td>
                      <td style={tdStyle}>{formatDate(reserva.fecha_reserva)}</td>
                      <td style={tdStyle}>
                        <strong>{reserva.cliente_nombre}</strong>
                        <div style={mutedStyle}>Cliente #{reserva.id_cliente}</div>
                      </td>
                      <td style={tdStyle}><EstadoReservaBadge estado={reserva.estado} /></td>
                      <td style={tdStyle}>{reserva.fecha_vencimiento ? formatDate(reserva.fecha_vencimiento) : "-"}</td>
                      <td style={tdStyle}>
                        <VencimientoBadge {...vencimiento} />
                      </td>
                      <td style={tdStyle}>{formatMoney(reserva.sena_total)}</td>
                      <td style={tdStyle}>{formatMoney(reserva.saldo_estimado)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <span>{porcentajeSenado}% señado</span>
                          {reserva.sena_baja ? <span style={warningPillStyle}>Seña baja</span> : null}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <Link to={`/reservas/${reserva.id}`} style={linkBtnStyle}>Ver detalle</Link>
                      </td>
                    </tr>
                  );
                })}
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
      <span style={mutedMetricStyle}>{label}</span>
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

function VencimientoBadge({ label, variant }) {
  const variants = {
    none: { bg: "#f2f4f7", color: "#475467" },
    ok: { bg: "#ecfdf3", color: "#067647" },
    soon: { bg: "#fffaeb", color: "#b54708" },
    today: { bg: "#fff7ed", color: "#c2410c" },
    overdue: { bg: "#fff1f0", color: "#b42318" },
    closed: { bg: "#eef4ff", color: "#175cd3" },
  };

  const style = variants[variant] || variants.none;

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
      {label}
    </span>
  );
}

function describirVencimiento(fecha, estado) {
  if (estado !== "activa") return { label: "-", variant: "closed" };
  if (!fecha) return { label: "Sin vencimiento", variant: "none" };

  const ahora = new Date();
  const vencimiento = new Date(fecha);

  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioVencimiento = new Date(vencimiento.getFullYear(), vencimiento.getMonth(), vencimiento.getDate());
  const dias = Math.round((inicioVencimiento - inicioHoy) / 86400000);

  if (dias < 0) return { label: "Vencida", variant: "overdue" };
  if (dias === 0) return { label: "Hoy", variant: "today" };
  if (dias === 1) return { label: "Mañana", variant: "soon" };
  if (dias <= 3) return { label: `En ${dias} días`, variant: "soon" };
  return { label: `En ${dias} días`, variant: "ok" };
}

function estaPorVencer(fecha, estado) {
  if (estado !== "activa" || !fecha) return false;

  const ahora = new Date();
  const vencimiento = new Date(fecha);
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioVencimiento = new Date(vencimiento.getFullYear(), vencimiento.getMonth(), vencimiento.getDate());
  const dias = Math.round((inicioVencimiento - inicioHoy) / 86400000);

  return dias >= 0 && dias <= 3;
}

function calcularPorcentajeSenado(reserva) {
  const sena = Number(reserva.sena_total || 0);
  const saldo = Number(reserva.saldo_estimado || 0);
  const total = sena + saldo;

  if (!total) return 0;

  return Math.round((sena / total) * 100);
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const pageMobileStyle = { padding: "12px", overflowX: "hidden" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" };
const headerMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "16px" };
const mutedStyle = { color: "#667085", margin: "6px 0 0", fontSize: "13px" };
const mutedMetricStyle = { color: "#667085", margin: 0, fontSize: "13px" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const primaryLinkStyle = { textDecoration: "none", background: "#0b5bd3", color: "white", padding: "10px 14px", borderRadius: "10px", fontWeight: "bold", textAlign: "center" };
const filtersStyle = { display: "grid", gridTemplateColumns: "190px minmax(260px,1fr) auto auto", gap: "14px", alignItems: "end" };
const filtersMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: "12px", alignItems: "stretch" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const checkStyle = { display: "flex", alignItems: "center", gap: "8px", paddingBottom: "9px" };
const secondaryBtnStyle = { padding: "10px 14px", borderRadius: "10px", border: "1px solid #d0d5dd", background: "white", fontWeight: "bold", cursor: "pointer" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "16px", marginBottom: "16px" };
const summaryGridMobileStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" };
const metricStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", display: "grid", gap: "6px" };
const metricValueStyle = { fontSize: "22px" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" };
const tableWrapperStyle = { overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1120px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", color: "#475467" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 10px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white", display: "inline-block" };
const warningPillStyle = { background: "#fffaeb", color: "#b54708", borderRadius: "999px", padding: "4px 8px", fontWeight: "bold", fontSize: "13px", width: "fit-content" };
const fullWidthStyle = { width: "100%" };
