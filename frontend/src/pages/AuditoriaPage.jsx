import { useEffect, useMemo, useState } from "react";
import { listarAuditoriaEventos, obtenerAuditoriaEvento } from "../services/auditoriaService";
import { formatDate } from "../utils/formatters";
import useMediaQuery from "../hooks/useMediaQuery";

const LIMITS = [50, 100, 200, 500];
const FILTROS_ENTIDAD = [
  { key: "todo", label: "Todo" },
  { key: "criticos", label: "Críticos" },
  { key: "venta", label: "Ventas" },
  { key: "reserva", label: "Reservas" },
  { key: "orden_taller", label: "Taller" },
  { key: "caja", label: "Caja" },
  { key: "stock", label: "Stock" },
  { key: "pago", label: "Pagos" },
  { key: "deuda", label: "Deudas" },
];

export default function AuditoriaPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1120px)");
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [limit, setLimit] = useState(100);
  const [query, setQuery] = useState("");
  const [filtroEntidad, setFiltroEntidad] = useState("todo");
  const [mostrarMetadata, setMostrarMetadata] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEventos();
  }, [limit]);

  async function cargarEventos() {
    try {
      setLoading(true);
      setError("");

      const data = await listarAuditoriaEventos(limit);
      const lista = data || [];
      setEventos(lista);

      if (lista.length > 0) {
        await seleccionarEvento(lista[0], { silencioso: true });
      } else {
        setEventoSeleccionado(null);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar los eventos de auditoría");
    } finally {
      setLoading(false);
    }
  }

  async function seleccionarEvento(evento, options = {}) {
    try {
      if (!options.silencioso) setLoadingDetalle(true);
      setError("");
      setMostrarMetadata(false);

      const detalle = await obtenerAuditoriaEvento(evento.id);
      setEventoSeleccionado(detalle);
    } catch (err) {
      setError(err.message || "No se pudo cargar el detalle del evento");
      setEventoSeleccionado(evento);
    } finally {
      setLoadingDetalle(false);
    }
  }

  const eventosFiltrados = useMemo(() => {
    const q = normalizarTexto(query);

    return eventos.filter((evento) => {
      const severidad = obtenerSeveridad(evento);
      const entidad = normalizarTexto(evento.entidad);
      const accion = normalizarTexto(evento.accion);
      const origenTipo = normalizarTexto(evento.origen_tipo);
      const detalle = normalizarTexto(evento.detalle);

      const pasaFiltroEntidad = (() => {
        if (filtroEntidad === "todo") return true;
        if (filtroEntidad === "criticos") return severidad.key === "critico";
        if (filtroEntidad === "stock") return entidad.includes("stock") || accion.includes("stock") || origenTipo.includes("stock");
        if (filtroEntidad === "orden_taller") return entidad.includes("taller") || origenTipo.includes("taller") || detalle.includes("taller");
        if (filtroEntidad === "deuda") return entidad.includes("deuda") || origenTipo.includes("deuda") || detalle.includes("deuda");
        return entidad.includes(filtroEntidad) || origenTipo.includes(filtroEntidad) || accion.includes(filtroEntidad);
      })();

      if (!pasaFiltroEntidad) return false;
      if (!q) return true;

      const texto = normalizarTexto([
        evento.id,
        evento.id_usuario,
        evento.id_sucursal,
        evento.entidad,
        evento.entidad_id,
        evento.accion,
        evento.detalle,
        evento.origen_tipo,
        evento.origen_id,
        JSON.stringify(evento.metadata || {}),
      ].filter(Boolean).join(" "));

      return texto.includes(q);
    });
  }, [eventos, query, filtroEntidad]);

  const resumen = useMemo(() => {
    const base = {
      total: eventos.length,
      criticos: 0,
      importantes: 0,
      anulaciones: 0,
      reversiones: 0,
      ajustes: 0,
    };

    eventos.forEach((evento) => {
      const accion = normalizarTexto(evento.accion);
      const detalle = normalizarTexto(evento.detalle);
      const severidad = obtenerSeveridad(evento);

      if (severidad.key === "critico") base.criticos += 1;
      if (severidad.key === "importante") base.importantes += 1;
      if (accion.includes("anul") || detalle.includes("anul")) base.anulaciones += 1;
      if (accion.includes("revert") || detalle.includes("revert")) base.reversiones += 1;
      if (accion.includes("ajuste") || detalle.includes("ajuste")) base.ajustes += 1;
    });

    return base;
  }, [eventos]);

  const eventoActual = eventoSeleccionado;
  const severidadActual = eventoActual ? obtenerSeveridad(eventoActual) : null;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Control operativo</p>
          <h1 style={styles.title}>Auditoría</h1>
          <p style={styles.subtitle}>Quién hizo qué, cuándo y sobre qué operación.</p>
        </div>

        <div style={isMobile ? styles.heroActionsMobile : styles.heroActions}>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={styles.heroSelect}>
            {LIMITS.map((item) => (
              <option key={item} value={item}>Últimos {item}</option>
            ))}
          </select>

          <button type="button" onClick={cargarEventos} style={styles.secondaryHeroButton}>
            ↻ Refrescar
          </button>
        </div>
      </header>

      {error && <div style={styles.error}>Error: {error}</div>}

      <section style={isMobile ? styles.metricsGridMobile : styles.metricsGrid}>
        <Metric label="Eventos cargados" value={resumen.total} tone="dark" />
        <Metric label="Críticos" value={resumen.criticos} tone={resumen.criticos > 0 ? "danger" : "ok"} />
        <Metric label="Importantes" value={resumen.importantes} tone="warning" />
        <Metric label="Anulaciones" value={resumen.anulaciones} tone={resumen.anulaciones > 0 ? "danger" : "muted"} />
        <Metric label="Reversiones" value={resumen.reversiones} tone={resumen.reversiones > 0 ? "danger" : "muted"} />
        <Metric label="Ajustes" value={resumen.ajustes} tone={resumen.ajustes > 0 ? "warning" : "muted"} />
      </section>

      <section style={isMobile ? styles.filterBarMobile : styles.filterBar}>
        <div style={styles.quickFilters}>
          {FILTROS_ENTIDAD.map((filtro) => (
            <button
              key={filtro.key}
              type="button"
              onClick={() => setFiltroEntidad(filtro.key)}
              style={filtroEntidad === filtro.key ? styles.filterButtonActive : styles.filterButton}
            >
              {filtro.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por venta, cliente, usuario, acción, detalle, origen..."
          style={styles.searchInput}
        />
      </section>

      <main style={isNarrow ? styles.layoutMobile : styles.layout}>
        <section style={styles.timelineCard}>
          <div style={styles.timelineHeader}>
            <div>
              <p style={styles.eyebrow}>Timeline</p>
              <h2 style={styles.cardTitle}>Eventos recientes</h2>
            </div>
            <span style={styles.mutedStrong}>Mostrando {eventosFiltrados.length} de {eventos.length}</span>
          </div>

          {loading ? (
            <div style={styles.state}>Cargando auditoría...</div>
          ) : eventosFiltrados.length === 0 ? (
            <div style={styles.state}>No hay eventos para mostrar.</div>
          ) : (
            <div style={styles.timelineList}>
              {eventosFiltrados.map((evento) => {
                const selected = eventoActual?.id === evento.id;
                const severidad = obtenerSeveridad(evento);

                return (
                  <button
                    type="button"
                    key={evento.id}
                    onClick={() => seleccionarEvento(evento)}
                    style={selected ? styles.timelineItemSelected : styles.timelineItem}
                  >
                    <div style={{ ...styles.severityDot, background: severidad.color }} />

                    <div style={styles.timelineBody}>
                      <div style={styles.timelineTopLine}>
                        <strong>{tituloEvento(evento)}</strong>
                        <span style={styles.eventDate}>{formatDate(evento.fecha)}</span>
                      </div>

                      <p style={styles.eventDetail}>{evento.detalle || "Sin detalle"}</p>

                      <div style={styles.eventMetaRow}>
                        <span style={{ ...styles.badge, ...severidad.style }}>{severidad.label}</span>
                        <EntidadBadge entidad={evento.entidad} />
                        <AccionBadge accion={evento.accion} />
                        <span style={styles.miniMeta}>{evento.usuario_nombre || `Usuario #${evento.id_usuario || "-"}`}</span>
                        {evento.origen_tipo && <span style={styles.miniMeta}>Origen {evento.origen_tipo} #{evento.origen_id}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside style={styles.sidePanel}>
          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Detalle del evento</h2>

            {loadingDetalle ? (
              <div style={styles.stateSmall}>Cargando detalle...</div>
            ) : !eventoActual ? (
              <div style={styles.emptySmall}>Seleccioná un evento.</div>
            ) : (
              <div style={styles.detailGrid}>
                <div style={styles.detailHeader}>
                  <span style={{ ...styles.badge, ...(severidadActual?.style || {}) }}>{severidadActual?.label}</span>
                  <strong>Evento #{eventoActual.id}</strong>
                </div>

                <Info label="Fecha" value={formatDate(eventoActual.fecha)} />
                <Info
                  label="Usuario"
                  value={
                    eventoActual?.usuario_nombre
                      ? `${eventoActual.usuario_nombre} (@${eventoActual.usuario_username || "sin usuario"})`
                      : `#${eventoActual?.id_usuario || "-"}`
                  }
                />
                <Info label="Sucursal" value={eventoActual.id_sucursal ? `#${eventoActual.id_sucursal}` : "-"} />
                <Info label="Entidad" value={`${eventoActual.entidad || "-"} #${eventoActual.entidad_id || "-"}`} />
                <Info label="Acción" value={humanizarTexto(eventoActual.accion)} />
                <Info
                  label="Origen"
                  value={eventoActual.origen_tipo ? `${eventoActual.origen_tipo} #${eventoActual.origen_id}` : "-"}
                />

                <div style={styles.detailBox}>
                  <span style={styles.boxLabel}>Detalle operativo</span>
                  <p style={styles.detailParagraph}>{eventoActual.detalle || "Sin detalle"}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarMetadata((prev) => !prev)}
                  style={styles.secondaryButtonFull}
                >
                  {mostrarMetadata ? "Ocultar JSON técnico" : "Ver JSON técnico"}
                </button>

                {mostrarMetadata && (
                  <div style={styles.detailBox}>
                    <span style={styles.boxLabel}>Metadata</span>
                    <pre style={styles.pre}>
                      {eventoActual.metadata ? JSON.stringify(eventoActual.metadata, null, 2) : "Sin metadata"}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Lectura rápida</h2>
            <div style={styles.helpList}>
              <HelpItem tone="danger" title="Crítico" text="Anulaciones, reversiones, ajustes y reintegros." />
              <HelpItem tone="warning" title="Importante" text="Entregas, cobros, cierres, cambios de estado sensibles." />
              <HelpItem tone="ok" title="Normal" text="Creaciones y operaciones informativas." />
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
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

function HelpItem({ tone, title, text }) {
  const tones = {
    danger: { background: "#fff1f0", borderColor: "#fecaca", color: "#991b1b" },
    warning: { background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" },
    ok: { background: "#ecfdf5", borderColor: "#bbf7d0", color: "#047857" },
  };

  return (
    <div style={{ ...styles.helpItem, ...(tones[tone] || {}) }}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function EntidadBadge({ entidad }) {
  const label = humanizarTexto(entidad || "Sin entidad");
  return <span style={{ ...styles.badge, background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}>{label}</span>;
}

function AccionBadge({ accion }) {
  const severidad = obtenerSeveridad({ accion });
  return <span style={{ ...styles.badge, ...severidad.style }}>{humanizarTexto(accion || "Sin acción")}</span>;
}

function obtenerSeveridad(evento) {
  const texto = normalizarTexto([
    evento?.accion,
    evento?.detalle,
    evento?.entidad,
    evento?.origen_tipo,
    JSON.stringify(evento?.metadata || {}),
  ].filter(Boolean).join(" "));

  const critico = [
    "anul",
    "revert",
    "cancel",
    "ajuste",
    "reintegr",
    "devolucion",
    "devolución",
    "cierre_caja",
    "cerrar caja",
  ].some((palabra) => texto.includes(palabra));

  if (critico) {
    return {
      key: "critico",
      label: "Crítico",
      color: "#ef4444",
      style: { background: "#fff1f0", color: "#b42318", borderColor: "#fecaca" },
    };
  }

  const importante = [
    "entreg",
    "pago",
    "cobro",
    "venta_generada",
    "uso_taller",
    "stock",
    "facturada",
    "deuda",
  ].some((palabra) => texto.includes(palabra));

  if (importante) {
    return {
      key: "importante",
      label: "Importante",
      color: "#f59e0b",
      style: { background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" },
    };
  }

  return {
    key: "normal",
    label: "Normal",
    color: "#22c55e",
    style: { background: "#ecfdf5", color: "#047857", borderColor: "#bbf7d0" },
  };
}

function tituloEvento(evento) {
  const accion = humanizarTexto(evento?.accion || "Evento registrado");
  const entidad = humanizarTexto(evento?.entidad || "sistema");
  const entidadId = evento?.entidad_id ? ` #${evento.entidad_id}` : "";

  return `${accion} · ${entidad}${entidadId}`;
}

function humanizarTexto(valor) {
  return String(valor || "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  pageMobile: { padding: 12, overflowX: "hidden" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16, borderRadius: 18 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  heroActionsMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "stretch" },
  heroSelect: { border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  secondaryHeroButton: { border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12, marginBottom: 16 },
  metricsGridMobile: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 14 },
  metric: { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 5, boxShadow: "0 10px 22px rgba(15,23,42,.06)" },
  metricTones: { dark: { color: "#0f172a" }, ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }, warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" }, danger: { color: "#b42318", background: "#fff1f0", borderColor: "#fecaca" }, muted: { color: "#475569", background: "#f8fafc" } },
  filterBar: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 12, marginBottom: 16, alignItems: "center" },
  filterBarMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 14, alignItems: "stretch" },
  quickFilters: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterButton: { border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 999, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  filterButtonActive: { border: "1px solid #f97316", background: "#fff7ed", color: "#c2410c", borderRadius: 999, padding: "9px 12px", fontWeight: 1000, cursor: "pointer" },
  searchInput: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 390px", gap: 16, alignItems: "start" },
  layoutMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" },
  timelineCard: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  timelineHeader: { padding: 18, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  cardTitle: { margin: "3px 0 0", fontSize: 22, letterSpacing: "-.02em" },
  mutedStrong: { color: "#64748b", fontWeight: 900 },
  timelineList: { display: "grid", gap: 0 },
  timelineItem: { width: "100%", border: "none", borderBottom: "1px solid #f1f5f9", background: "white", padding: 16, display: "grid", gridTemplateColumns: "14px minmax(0, 1fr)", gap: 12, textAlign: "left", cursor: "pointer" },
  timelineItemSelected: { width: "100%", border: "none", borderBottom: "1px solid #fed7aa", background: "#fff7ed", padding: 16, display: "grid", gridTemplateColumns: "14px minmax(0, 1fr)", gap: 12, textAlign: "left", cursor: "pointer" },
  severityDot: { width: 10, height: 10, borderRadius: 999, marginTop: 5 },
  timelineBody: { display: "grid", gap: 7, minWidth: 0 },
  timelineTopLine: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  eventDate: { color: "#64748b", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" },
  eventDetail: { margin: 0, color: "#334155", fontWeight: 700, lineHeight: 1.35 },
  eventMetaRow: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" },
  badge: { border: "1px solid transparent", borderRadius: 999, padding: "5px 8px", fontWeight: 1000, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 },
  miniMeta: { borderRadius: 999, padding: "5px 8px", fontWeight: 900, fontSize: 12, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" },
  sidePanel: { display: "grid", gap: 16, position: "sticky", top: 16 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  sideTitle: { margin: "0 0 12px", fontSize: 20 },
  detailGrid: { display: "grid", gap: 10 },
  detailHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 },
  infoBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, display: "grid", gap: 5, color: "#64748b" },
  detailBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 },
  boxLabel: { color: "#64748b", fontSize: 13, fontWeight: 900, display: "block", marginBottom: 6 },
  detailParagraph: { margin: 0, color: "#0f172a", fontWeight: 700, lineHeight: 1.35 },
  pre: { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, maxHeight: 280, overflow: "auto", color: "#334155" },
  secondaryButtonFull: { width: "100%", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", textAlign: "center" },
  helpList: { display: "grid", gap: 10 },
  helpItem: { border: "1px solid", borderRadius: 14, padding: 12, display: "grid", gap: 4, fontWeight: 800 },
  state: { padding: 22, color: "#64748b", fontWeight: 900 },
  stateSmall: { color: "#64748b", fontWeight: 900 },
  emptySmall: { color: "#64748b", fontWeight: 900, background: "#f8fafc", borderRadius: 14, padding: 12 },
};
