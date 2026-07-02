import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listarOrdenesTaller, obtenerDashboardTaller } from "../services/tallerService";
import { formatDate, formatMoney, formatNumber } from "../utils/formatters";
import {
  Button,
  Card,
  EmptyState,
  MetricCard,
  OperationalStatusBadge,
  PageHeader,
  ResponsiveMetricsGrid,
  useBreakpoint,
} from "../components/ui";
import { CalendarDays, Plus, RefreshCw, Search } from "lucide-react";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";

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

const TABLERO_ESTADOS = [
  { value: "ingresada", label: "Ingresadas" },
  { value: "presupuestada", label: "Presupuestadas" },
  { value: "esperando_aprobacion", label: "Aprobacion" },
  { value: "esperando_repuestos", label: "Repuestos" },
  { value: "en_reparacion", label: "En reparacion" },
  { value: "terminada", label: "Terminadas" },
  { value: "lista_para_retirar", label: "Listas retiro" },
];

export default function TallerListPage() {
  const searchRef = useRef(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState("activas");
  const [busqueda, setBusqueda] = useState("");
  const isMobile = useBreakpoint();

  useEffect(() => {
    cargarOrdenes(estadoFiltro);
  }, [estadoFiltro]);

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

  async function cargarOrdenes(filtroActual = estadoFiltro) {
    try {
      setLoading(true);
      setError("");

      const [ordenesData, dashboardData] = await Promise.all([
        listarOrdenesTaller(paramsDesdeFiltro(filtroActual)),
        obtenerDashboardTaller(),
      ]);

      setOrdenes(ordenesData || []);
      setDashboard(dashboardData || null);
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
    const data = dashboard || {};

    return {
      activas: Number(data.pendientes || 0),
      ingresadas: Number(data.ingresadas || 0),
      enReparacion: Number(data.en_reparacion || 0),
      listas: Number(data.listas_para_retirar || 0),
      esperandoRepuestos: Number(data.esperando_repuestos || 0),
      atrasadas: Number(data.atrasadas || 0),
      paraManana: Number(data.para_manana || 0),
      urgentes: Number(data.urgentes || 0),
      totalImporte: Number(data.total_importe_pendiente || 0),
    };
  }, [dashboard]);

  const tablero = useMemo(() => {
    const grupos = Object.fromEntries(
      TABLERO_ESTADOS.map((estado) => [estado.value, []])
    );

    ordenesFiltradas.forEach((orden) => {
      if (grupos[orden.estado]) {
        grupos[orden.estado].push(orden);
      }
    });

    return grupos;
  }, [ordenesFiltradas]);

  const mostrarTablero = estadoFiltro === "activas";

  if (loading) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Cargando taller..."
        description="Estamos actualizando las órdenes activas."
      />
    );
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title="Taller"
        subtitle="Órdenes activas, reparación, repuestos y retiro de bicicletas."
        style={{ marginBottom: 0 }}
        actions={(
          <>
            <Button type="button" variant="outline" onClick={() => cargarOrdenes(estadoFiltro)}>
              <RefreshCw size={16} aria-hidden="true" />
              Refrescar
            </Button>
            <Link to="/taller/nueva" style={styles.primaryLink}>
              <Plus size={17} aria-hidden="true" />
              Nueva orden
            </Link>
          </>
        )}
      />

      {error && <div style={styles.error}>Error: {error}</div>}

      <ResponsiveMetricsGrid minWidth={145} mobileColumns={2}>
        <MetricCard label="Pendientes" value={resumen.activas} />
        <MetricCard label="Ingresadas" value={resumen.ingresadas} tone="primary" />
        <MetricCard label="En reparación" value={resumen.enReparacion} tone="primary" />
        <MetricCard label="Listas retiro" value={resumen.listas} tone="success" />
        <MetricCard label="Esperando repuestos" value={resumen.esperandoRepuestos} tone="warning" />
        <MetricCard label="Total taller" value={formatMoney(resumen.totalImporte)} />
      </ResponsiveMetricsGrid>

      <Card bodyStyle={styles.filtersCard} style={{ boxShadow: shadows.sm }}>
        <div style={{ ...styles.searchBox, ...(isMobile ? styles.searchBoxMobile : {}) }}>
          <Search size={18} color={colors.textMuted} aria-hidden="true" />
          <input
            ref={searchRef}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por orden, cliente, bici o problema..."
            style={styles.searchInput}
          />
          {!isMobile && <kbd style={styles.kbd}>/</kbd>}
        </div>

        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={{ ...styles.select, ...(isMobile ? styles.selectMobile : {}) }}>
          {ESTADOS.map((estado) => (
            <option key={estado.value} value={estado.value}>{estado.label}</option>
          ))}
        </select>
      </Card>

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <Card
          title="Órdenes"
          subtitle={`${ordenesFiltradas.length} resultado(s) · filtro: ${labelEstadoFiltro(estadoFiltro)}`}
          bodyStyle={{ padding: 0 }}
        >
          {ordenesFiltradas.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No hay órdenes para mostrar"
              description="Probá otro estado o cambiá el texto de búsqueda."
              style={{ margin: spacing.lg }}
            />
          ) : mostrarTablero ? (
            <TallerBoard tablero={tablero} />
          ) : (
            <div style={{ ...styles.ordersGrid, ...(isMobile ? styles.ordersGridMobile : {}) }}>
              {ordenesFiltradas.map((orden) => (
                <OrdenCard key={orden.id} orden={orden} />
              ))}
            </div>
          )}
        </Card>

        {!isMobile && <aside style={styles.sidePanel}>
          <Card title="Modo taller">
            <p style={styles.sideMuted}>La vista abre en órdenes activas porque lo importante es no perder bicicletas pendientes.</p>
            <div style={styles.sideSteps}>
              <span>1. Ingresar bici</span>
              <span>2. Presupuestar repuestos/trabajo</span>
              <span>3. Aprobar y ejecutar</span>
              <span>4. Dejar lista para retirar</span>
            </div>
          </Card>
        </aside>}
      </main>
    </div>
  );
}

function TallerBoard({ tablero }) {
  return (
    <div style={styles.boardScroll}>
      <div style={styles.boardGrid}>
        {TABLERO_ESTADOS.map((columna) => {
          const ordenes = tablero[columna.value] || [];

          return (
            <section key={columna.value} style={styles.boardColumn}>
              <div style={styles.boardColumnHeader}>
                <div>
                  <EstadoBadge estado={columna.value} />
                  <div style={styles.boardColumnTitle}>{columna.label}</div>
                </div>
                <strong style={styles.boardCount}>{ordenes.length}</strong>
              </div>

              <div style={styles.boardColumnBody}>
                {ordenes.length === 0 ? (
                  <div style={styles.boardEmpty}>Sin ordenes</div>
                ) : (
                  ordenes.map((orden) => (
                    <TableroOrdenCard key={orden.id} orden={orden} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TableroOrdenCard({ orden }) {
  const esPostventa = orden.es_service_postventa === true;
  const prioridadAlta = orden.prioridad === "urgente";

  return (
    <Link to={`/taller/${orden.id}`} style={styles.boardCard}>
      <div style={styles.boardCardTop}>
        <strong>OT #{orden.id}</strong>
        <div style={styles.boardBadges}>
          {prioridadAlta && <span style={styles.urgentBadge}>Urgente</span>}
          {esPostventa && <span style={styles.postventaBadge}>Postventa</span>}
        </div>
      </div>

      <div style={styles.boardProblem}>
        {orden.problema_reportado || "Sin problema reportado"}
      </div>

      <div style={styles.boardMeta}>
        <span>{nombreClienteOrden(orden)}</span>
        <span>{descripcionBicicletaOrden(orden)}</span>
        {orden.fecha_prometida && <span>Prometida: {formatDate(orden.fecha_prometida)}</span>}
      </div>

      <div style={styles.boardFooter}>
        <span>{esPostventa ? "No aplica cobro" : formatMoney(orden.saldo_pendiente)}</span>
        <span>Ver</span>
      </div>
    </Link>
  );
}

function OrdenCard({ orden }) {
  const esFinal = ESTADOS_FINALES.has(orden.estado);
  const isMobile = useBreakpoint();
  const esPostventa = orden.es_service_postventa === true;

  return (
    <article style={{ ...(esFinal ? styles.orderCardMuted : styles.orderCard), ...(isMobile ? styles.orderCardMobile : {}) }}>
      <div style={{ ...styles.orderTop, ...(isMobile ? styles.orderTopMobile : {}) }}>
        <div>
          <div style={styles.orderNumberRow}>
            <p style={styles.orderNumber}>Orden #{orden.id}</p>
            {esPostventa && <span style={styles.postventaBadge}>Postventa</span>}
          </div>
          <h3 style={{ ...styles.orderProblem, ...(isMobile ? styles.orderProblemMobile : {}) }}>{orden.problema_reportado || "Sin problema reportado"}</h3>
        </div>
        <EstadoBadge estado={orden.estado} />
      </div>

      <div style={{ ...styles.orderMetaGrid, ...(isMobile ? styles.orderMetaGridMobile : {}) }}>
        <Info label="Fecha" value={formatDate(orden.fecha_ingreso)} />
        <Info label="Cliente" value={nombreClienteOrden(orden)} />
        <Info label="Bicicleta" value={descripcionBicicletaOrden(orden)} />
        <Info label={esPostventa ? "Cobro" : "Presupuesto"} value={resumenTotalOrden(orden)} />
      </div>

      <div style={{ ...styles.orderFooter, ...(isMobile ? styles.orderFooterMobile : {}) }}>
        <span style={styles.smallMuted}>
          {esPostventa ? "Service bonificado" : `Saldo: ${formatMoney(orden.saldo_pendiente)}`}
        </span>
        <Link to={`/taller/${orden.id}`} style={{ ...styles.detailButton, ...(isMobile ? styles.detailButtonMobile : {}) }}>Ver orden</Link>
      </div>
    </article>
  );
}

export function EstadoBadge({ estado }) {
  return <OperationalStatusBadge domain="taller" status={estado} />;
}

function Info({ label, value }) {
  const isMobile = useBreakpoint();
  return (
    <div style={{ ...styles.infoBox, ...(isMobile ? styles.infoBoxMobile : {}) }}>
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
  if (orden.es_service_postventa === true) return "No aplica";

  const total = Number(orden.total_final || 0);
  if (total <= 0) return "Sin presupuesto";
  return formatMoney(total);
}

function paramsDesdeFiltro(filtro) {
  if (filtro === "activas") {
    return { solo_pendientes: true };
  }

  if (filtro === "para_manana") {
    return { vista: "para_manana", solo_pendientes: false };
  }

  if (filtro === "atrasadas") {
    return { vista: "atrasadas", solo_pendientes: false };
  }

  if (filtro === "todas") {
    return { solo_pendientes: false };
  }

  return { estado: filtro, solo_pendientes: false };
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
  page: {
    minHeight: "100vh",
    display: "grid",
    gap: spacing.xl,
    color: colors.text,
    fontFamily: typography.fontFamily,
  },
  primaryLink: {
    minHeight: controls.minHeight,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: controls.padding,
    background: colors.primary,
    color: colors.surface,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    boxShadow: shadows.sm,
  },
  error: {
    background: colors.dangerSoft,
    color: colors.dangerDark,
    border: `1px solid ${colors.danger}`,
    borderRadius: radius.md,
    padding: spacing.md,
    fontWeight: typography.label.fontWeight,
  },
  filtersCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: spacing.md,
    alignItems: "center",
  },
  searchBox: {
    minHeight: controls.minHeight,
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "0 12px",
    background: colors.surfaceMuted,
  },
  searchInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    outline: "none",
    padding: "10px 0",
    fontSize: typography.body.fontSize,
    color: colors.text,
    minWidth: 0,
  },
  kbd: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    padding: "3px 7px",
    color: colors.textMuted,
    background: colors.surface,
    fontWeight: typography.label.fontWeight,
  },
  select: {
    width: "100%",
    minHeight: controls.minHeight,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: colors.surface,
    padding: controls.padding,
    fontWeight: typography.label.fontWeight,
    color: colors.text,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 330px",
    gap: spacing.lg,
    alignItems: "start",
  },
  boardScroll: { overflowX: "auto", padding: spacing.lg, WebkitOverflowScrolling: "touch" },
  boardGrid: { display: "grid", gridTemplateColumns: "repeat(7, minmax(245px, 1fr))", gap: spacing.md, minWidth: 1780 },
  boardColumn: { background: colors.surfaceMuted, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, minHeight: 360, display: "grid", gridTemplateRows: "auto 1fr" },
  boardColumnHeader: { padding: spacing.md, borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "start", gap: spacing.sm },
  boardColumnTitle: { marginTop: 7, color: colors.text, fontWeight: typography.label.fontWeight, fontSize: typography.small.fontSize },
  boardCount: { minWidth: 28, height: 28, borderRadius: radius.pill, background: colors.surface, border: `1px solid ${colors.borderSoft}`, display: "grid", placeItems: "center", color: colors.textStrong },
  boardColumnBody: { padding: 10, display: "grid", alignContent: "start", gap: 10 },
  boardEmpty: { border: `1px dashed ${colors.border}`, background: colors.surface, color: colors.textMuted, borderRadius: radius.md, padding: spacing.md, fontWeight: typography.label.fontWeight, textAlign: "center" },
  boardCard: { textDecoration: "none", color: colors.textStrong, background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: spacing.md, display: "grid", gap: spacing.sm, boxShadow: shadows.sm },
  boardCardTop: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" },
  boardBadges: { display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" },
  urgentBadge: { background: colors.dangerSoft, color: colors.dangerDark, border: `1px solid ${colors.danger}`, borderRadius: radius.pill, padding: "4px 7px", fontSize: 10, fontWeight: typography.label.fontWeight, textTransform: "uppercase" },
  boardProblem: { fontWeight: typography.sectionTitle.fontWeight, lineHeight: 1.25 },
  boardMeta: { display: "grid", gap: 4, color: colors.textMuted, fontSize: typography.small.fontSize, fontWeight: typography.label.fontWeight },
  boardFooter: { display: "flex", justifyContent: "space-between", gap: spacing.sm, borderTop: `1px solid ${colors.borderSoft}`, paddingTop: spacing.sm, color: colors.text, fontWeight: typography.label.fontWeight, fontSize: typography.small.fontSize },
  ordersGrid: { display: "grid", gap: spacing.md, padding: spacing.lg },
  orderCard: { border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, background: colors.surface, padding: spacing.lg, display: "grid", gap: spacing.md, boxShadow: shadows.sm },
  orderCardMuted: { border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, background: colors.surfaceMuted, padding: spacing.lg, display: "grid", gap: spacing.md, opacity: 0.82 },
  orderTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  orderNumberRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  orderNumber: { margin: 0, color: colors.primary, fontSize: typography.small.fontSize, fontWeight: typography.label.fontWeight, textTransform: "uppercase" },
  postventaBadge: { background: colors.successSoft, color: colors.successDark, border: `1px solid ${colors.success}`, borderRadius: radius.pill, padding: "4px 8px", fontSize: typography.small.fontSize, fontWeight: typography.label.fontWeight, textTransform: "uppercase" },
  orderProblem: { margin: "4px 0 0", fontSize: 18, lineHeight: 1.3 },
  orderMetaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 },
  orderFooter: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10 },
  smallMuted: { color: colors.textMuted, fontWeight: typography.label.fontWeight },
  detailButton: { textDecoration: "none", border: "none", background: colors.topbar, color: colors.surface, borderRadius: radius.md, padding: controls.padding, fontWeight: typography.button.fontWeight },
  sidePanel: { position: "sticky", top: 16 },
  sideMuted: { color: colors.textMuted, margin: 0, lineHeight: typography.body.lineHeight },
  sideSteps: { display: "grid", gap: spacing.sm, marginTop: spacing.lg, color: colors.text, fontWeight: typography.label.fontWeight },
  infoBox: { background: colors.surfaceMuted, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: spacing.sm, display: "grid", gap: 4, color: colors.textMuted },
  badge: { borderRadius: 999, padding: "7px 10px", fontWeight: 1000, fontSize: 12, whiteSpace: "nowrap", border: "1px solid transparent" },
  badgeTones: { ok: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }, info: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }, warning: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }, orange: { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }, violet: { background: "#f5f3ff", color: "#6d28d9", borderColor: "#ddd6fe" }, danger: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }, muted: { background: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" } },
  empty: { padding: 22, color: "#64748b", fontWeight: 900 },
  state: { padding: 24, fontWeight: 900 },
  pageMobile: { padding: 10, overflowX: "hidden" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 14, padding: 18, borderRadius: 22, marginBottom: 12 },
  titleMobile: { fontSize: 30 },
  subtitleMobile: { fontSize: 15, lineHeight: 1.35 },
  heroActionsMobile: { display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", gap: 10 },
  heroButtonMobile: { width: "100%", textAlign: "center", padding: "13px 10px", boxSizing: "border-box" },
  metricsGridMobile: { gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
  metricMobile: { padding: 12, borderRadius: 16, minWidth: 0 },
  filtersCardMobile: { gridTemplateColumns: "1fr", padding: 12, borderRadius: 18, gap: 10, marginBottom: 12 },
  searchBoxMobile: { minHeight: 48, padding: "0 12px" },
  selectMobile: { minHeight: 48 },
  layoutMobile: { gridTemplateColumns: "1fr", gap: 12 },
  panelMobile: { borderRadius: 18 },
  ordersGridMobile: { padding: 12, gap: 10 },
  orderCardMobile: { borderRadius: 16, padding: 12 },
  orderTopMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 8 },
  orderProblemMobile: { fontSize: 16 },
  orderMetaGridMobile: { gridTemplateColumns: "1fr 1fr", gap: 8 },
  orderFooterMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 9, alignItems: "stretch" },
  detailButtonMobile: { display: "block", textAlign: "center", padding: "12px 14px" },
  infoBoxMobile: { padding: 9, borderRadius: 12, minWidth: 0 },
};
