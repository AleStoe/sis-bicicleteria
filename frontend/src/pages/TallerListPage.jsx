import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listarOrdenesTaller } from "../services/tallerService";
import { formatDate, formatMoney, formatNumber } from "../utils/formatters";

const ESTADOS_ACTIVOS = new Set([
  "ingresada",
  "presupuestada",
  "esperando_aprobacion",
  "esperando_repuestos",
  "en_reparacion",
  "terminada",
  "lista_para_retirar",
]);

const ESTADOS_FINALES = new Set(["retirada", "cancelada"]);

const ESTADOS = [
  { value: "activas", label: "Activas" },
  { value: "ingresada", label: "Ingresadas" },
  { value: "presupuestada", label: "Presupuestadas" },
  { value: "esperando_aprobacion", label: "Esperando aprobación" },
  { value: "esperando_repuestos", label: "Esperando repuestos" },
  { value: "en_reparacion", label: "En reparación" },
  { value: "terminada", label: "Terminadas" },
  { value: "lista_para_retirar", label: "Listas para retirar" },
  { value: "retirada", label: "Retiradas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "todas", label: "Todas" },
];

export default function TallerListPage() {
  const searchRef = useRef(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("activas");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarOrdenes();
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      const esFinal = ESTADOS_FINALES.has(estado);

      if (estadoFiltro === "activas" && esFinal) return false;
      if (estadoFiltro !== "todas" && estadoFiltro !== "activas" && estado !== estadoFiltro) return false;

      if (!q) return true;

      const texto = [
        orden.id,
        orden.cliente_nombre,
        orden.cliente_telefono,
        orden.cliente_dni,
        orden.bicicleta_descripcion,
        orden.bicicleta_marca,
        orden.bicicleta_modelo,
        orden.bicicleta_numero_cuadro,
        orden.estado,
        orden.problema_reportado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [ordenes, estadoFiltro, busqueda]);

  const resumen = useMemo(() => {
    return ordenes.reduce(
      (acc, orden) => {
        acc.total += 1;
        if (ESTADOS_ACTIVOS.has(orden.estado)) acc.activas += 1;
        if (orden.estado === "ingresada") acc.ingresadas += 1;
        if (orden.estado === "en_reparacion") acc.enReparacion += 1;
        if (orden.estado === "lista_para_retirar") acc.listas += 1;
        if (orden.estado === "esperando_repuestos") acc.esperandoRepuestos += 1;
        acc.totalImporte += Number(orden.total_final || 0);
        return acc;
      },
      { total: 0, activas: 0, ingresadas: 0, enReparacion: 0, listas: 0, esperandoRepuestos: 0, totalImporte: 0 }
    );
  }, [ordenes]);

  if (loading) return <div style={styles.state}>Cargando taller...</div>;

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <p style={styles.kicker}>Taller / reparaciones</p>
          <h1 style={styles.title}>Taller</h1>
          <p style={styles.subtitle}>Órdenes activas, reparación, repuestos y retiro de bicicletas.</p>
        </div>

        <div style={styles.heroActions}>
          <button type="button" onClick={cargarOrdenes} style={styles.secondaryHeroButton}>↻ Refrescar</button>
          <Link to="/taller/nueva" style={styles.primaryHeroButton}>＋ Nueva orden</Link>
        </div>
      </header>

      {error && <div style={styles.error}>Error: {error}</div>}

      <section style={styles.metricsGrid}>
        <Metric label="Activas" value={resumen.activas} tone="dark" />
        <Metric label="Ingresadas" value={resumen.ingresadas} tone="info" />
        <Metric label="En reparación" value={resumen.enReparacion} tone="orange" />
        <Metric label="Listas retiro" value={resumen.listas} tone="ok" />
        <Metric label="Esperando repuestos" value={resumen.esperandoRepuestos} tone="warning" />
        <Metric label="Total taller" value={formatMoney(resumen.totalImporte)} tone="muted" />
      </section>

      <section style={styles.filtersCard}>
        <div style={styles.searchBox}>
          <span>🔎</span>
          <input
            ref={searchRef}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por orden, cliente, bici o problema..."
            style={styles.searchInput}
          />
          <kbd style={styles.kbd}>/</kbd>
        </div>

        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={styles.select}>
          {ESTADOS.map((estado) => (
            <option key={estado.value} value={estado.value}>{estado.label}</option>
          ))}
        </select>
      </section>

      <main style={styles.layout}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Órdenes</h2>
              <p style={styles.panelSubtitle}>{ordenesFiltradas.length} resultado(s) · filtro: {labelEstadoFiltro(estadoFiltro)}</p>
            </div>
          </div>

          {ordenesFiltradas.length === 0 ? (
            <div style={styles.empty}>No hay órdenes para mostrar.</div>
          ) : (
            <div style={styles.ordersGrid}>
              {ordenesFiltradas.map((orden) => (
                <OrdenCard key={orden.id} orden={orden} />
              ))}
            </div>
          )}
        </section>

        <aside style={styles.sidePanel}>
          <section style={styles.sideCard}>
            <h2 style={styles.sideTitle}>Modo taller</h2>
            <p style={styles.sideMuted}>La vista abre en órdenes activas porque lo importante es no perder bicicletas pendientes.</p>
            <div style={styles.sideSteps}>
              <span>1. Ingresar bici</span>
              <span>2. Presupuestar repuestos/trabajo</span>
              <span>3. Aprobar y ejecutar</span>
              <span>4. Dejar lista para retirar</span>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function OrdenCard({ orden }) {
  const esFinal = ESTADOS_FINALES.has(orden.estado);

  return (
    <article style={esFinal ? styles.orderCardMuted : styles.orderCard}>
      <div style={styles.orderTop}>
        <div>
          <p style={styles.orderNumber}>Orden #{orden.id}</p>
          <h3 style={styles.orderProblem}>{orden.problema_reportado || "Sin problema reportado"}</h3>
        </div>
        <EstadoBadge estado={orden.estado} />
      </div>

      <div style={styles.orderMetaGrid}>
        <Info label="Fecha" value={formatDate(orden.fecha_ingreso)} />
        <Info label="Cliente" value={nombreClienteOrden(orden)} />
        <Info label="Bicicleta" value={descripcionBicicletaOrden(orden)} />
        <Info label="Presupuesto" value={resumenTotalOrden(orden)} />
      </div>

      <div style={styles.orderFooter}>
        <span style={styles.smallMuted}>Saldo: {formatMoney(orden.saldo_pendiente)}</span>
        <Link to={`/taller/${orden.id}`} style={styles.detailButton}>Ver orden</Link>
      </div>
    </article>
  );
}

export function EstadoBadge({ estado }) {
  const config = ESTADO_CONFIG[estado] || { label: estado || "Sin estado", tone: "muted" };
  return <span style={{ ...styles.badge, ...(styles.badgeTones[config.tone] || {}) }}>{config.label}</span>;
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}


function nombreClienteOrden(orden) {
  return orden.cliente_nombre || `Cliente #${orden.id_cliente}`;
}

function descripcionBicicletaOrden(orden) {
  if (orden.bicicleta_descripcion) return orden.bicicleta_descripcion;

  const partes = [
    orden.bicicleta_marca,
    orden.bicicleta_modelo,
    orden.bicicleta_rodado ? `R${orden.bicicleta_rodado}` : null,
    orden.bicicleta_color,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" ") : `Bicicleta #${orden.id_bicicleta_cliente}`;
}

function resumenTotalOrden(orden) {
  const total = Number(orden.total_final || 0);
  if (total <= 0) return "Sin presupuesto";
  return formatMoney(total);
}

function labelEstadoFiltro(value) {
  return ESTADOS.find((estado) => estado.value === value)?.label || value;
}

const ESTADO_CONFIG = {
  ingresada: { label: "Ingresada", tone: "info" },
  presupuestada: { label: "Presupuestada", tone: "violet" },
  esperando_aprobacion: { label: "Esperando aprobación", tone: "warning" },
  esperando_repuestos: { label: "Esperando repuestos", tone: "warning" },
  en_reparacion: { label: "En reparación", tone: "orange" },
  terminada: { label: "Terminada", tone: "ok" },
  lista_para_retirar: { label: "Lista para retirar", tone: "ok" },
  retirada: { label: "Retirada", tone: "muted" },
  cancelada: { label: "Cancelada", tone: "danger" },
};

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryHeroButton: { textDecoration: "none", border: "none", background: "#f97316", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 12px 24px rgba(249,115,22,.28)" },
  secondaryHeroButton: { border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 },
  metric: { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 5, boxShadow: "0 10px 22px rgba(15,23,42,.06)" },
  metricTones: { dark: { color: "#0f172a" }, ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }, info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }, warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" }, muted: { color: "#475569", background: "#f8fafc" }, orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" } },
  filtersCard: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 12, background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: 14, marginBottom: 16, boxShadow: "0 12px 28px rgba(15,23,42,.06)" },
  searchBox: { display: "flex", alignItems: "center", gap: 10, border: "1px solid #cbd5e1", borderRadius: 14, padding: "0 12px", background: "#f8fafc" },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", padding: "13px 0", fontSize: 15, fontWeight: 700, minWidth: 0 },
  kbd: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "3px 7px", color: "#64748b", background: "white", fontWeight: 900 },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 14, background: "white", padding: "12px 13px", fontWeight: 800, color: "#0f172a" },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 330px", gap: 16, alignItems: "start" },
  panel: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, overflow: "hidden", boxShadow: "0 16px 34px rgba(15,23,42,.08)" },
  panelHeader: { padding: 16, borderBottom: "1px solid #e2e8f0" },
  panelTitle: { margin: 0, fontSize: 22 },
  panelSubtitle: { margin: "4px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13 },
  ordersGrid: { display: "grid", gap: 12, padding: 16 },
  orderCard: { border: "1px solid #e2e8f0", borderRadius: 20, background: "white", padding: 14, display: "grid", gap: 12, boxShadow: "0 8px 18px rgba(15,23,42,.04)" },
  orderCardMuted: { border: "1px solid #e2e8f0", borderRadius: 20, background: "#f8fafc", padding: 14, display: "grid", gap: 12, opacity: 0.82 },
  orderTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  orderNumber: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  orderProblem: { margin: "4px 0 0", fontSize: 18, lineHeight: 1.3 },
  orderMetaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 },
  orderFooter: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10 },
  smallMuted: { color: "#64748b", fontWeight: 800 },
  detailButton: { textDecoration: "none", border: "none", background: "#0f172a", color: "white", borderRadius: 12, padding: "10px 12px", fontWeight: 1000 },
  sidePanel: { position: "sticky", top: 16 },
  sideCard: { background: "#0f172a", color: "white", borderRadius: 22, padding: 18, boxShadow: "0 18px 40px rgba(15,23,42,.22)" },
  sideTitle: { margin: "0 0 8px", fontSize: 24 },
  sideMuted: { color: "#cbd5e1", margin: 0, fontWeight: 700 },
  sideSteps: { display: "grid", gap: 8, marginTop: 16, color: "#e2e8f0", fontWeight: 800 },
  infoBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 10, display: "grid", gap: 4, color: "#64748b" },
  badge: { borderRadius: 999, padding: "7px 10px", fontWeight: 1000, fontSize: 12, whiteSpace: "nowrap", border: "1px solid transparent" },
  badgeTones: { ok: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }, info: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }, warning: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }, orange: { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }, violet: { background: "#f5f3ff", color: "#6d28d9", borderColor: "#ddd6fe" }, danger: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }, muted: { background: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" } },
  empty: { padding: 22, color: "#64748b", fontWeight: 900 },
  state: { padding: 24, fontWeight: 900 },
};
