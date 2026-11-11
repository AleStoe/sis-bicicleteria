import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Download,
  RefreshCw,
  Search,
  Target,
  MessageSquareText,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  MetricCard,
  PageHeader,
  ResponsiveMetricsGrid,
  useBreakpoint,
} from "../components/ui";
import SearchField from "../components/ui/SearchField";
import ClientesCrmAgendaPanel from "../components/clientes/ClientesCrmAgendaPanel";
import ClientesCrmOportunidadesPanel from "../components/clientes/ClientesCrmOportunidadesPanel";
import ClientesCrmComunicacionesPanel from "../components/clientes/ClientesCrmComunicacionesPanel";
import { obtenerPanelCrmClientes } from "../services/clientesService";
import { formatMoney, formatPercent } from "../utils/formatters";
import { colors, radius, spacing, typography } from "../theme";

const DESKTOP_PAGE_SIZE = 50;
const MOBILE_PAGE_SIZE = 15;

const VISTAS = [
  { id: "todos", label: "Todos", countKey: "todos" },
  { id: "recientes", label: "Nuevos", countKey: "recientes" },
  { id: "recurrentes", label: "Recurrentes", countKey: "recurrentes" },
  { id: "inactivos", label: "Inactivos", countKey: "inactivos" },
  { id: "deuda", label: "Con deuda", countKey: "deuda" },
  { id: "credito", label: "Con credito", countKey: "credito" },
  { id: "taller", label: "Taller", countKey: "taller" },
  { id: "alto_valor", label: "Alto valor", countKey: "alto_valor" },
  { id: "sin_actividad", label: "Sin actividad", countKey: "sin_actividad" },
];

const badgeVariant = {
  danger: "danger",
  warning: "warning",
  success: "success",
  info: "default",
  neutral: "default",
};

export default function ClientesCrmPage() {
  const [modo, setModo] = useState("clientes");
  return (
    <div style={styles.page}>
      <div style={styles.modeBar}>
        <button type="button" onClick={() => setModo("clientes")} style={{ ...styles.modeButton, ...(modo === "clientes" ? styles.modeButtonActive : {}) }}><Users size={17} /> Clientes</button>
        <button type="button" onClick={() => setModo("seguimientos")} style={{ ...styles.modeButton, ...(modo === "seguimientos" ? styles.modeButtonActive : {}) }}><CalendarCheck size={17} /> Seguimientos</button>
        <button type="button" onClick={() => setModo("oportunidades")} style={{ ...styles.modeButton, ...(modo === "oportunidades" ? styles.modeButtonActive : {}) }}><Target size={17} /> Oportunidades</button>
        <button type="button" onClick={() => setModo("comunicaciones")} style={{ ...styles.modeButton, ...(modo === "comunicaciones" ? styles.modeButtonActive : {}) }}><MessageSquareText size={17} /> Comunicaciones</button>
      </div>
      {modo === "seguimientos" ? <ClientesCrmAgendaPanel /> : modo === "oportunidades" ? <ClientesCrmOportunidadesPanel /> : modo === "comunicaciones" ? <ClientesCrmComunicacionesPanel /> : <ClientesCrmListado />}
    </div>
  );
}

function ClientesCrmListado() {
  const navigate = useNavigate();
  const isMobile = useBreakpoint();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState("todos");
  const [tipoCliente, setTipoCliente] = useState("");
  const [rubro, setRubro] = useState("");
  const [orden, setOrden] = useState("reciente");
  const [soloActivos, setSoloActivos] = useState(true);
  const [pagina, setPagina] = useState(0);
  const requestRef = useRef(0);
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;

  useEffect(() => {
    setPagina(0);
  }, [busqueda, vista, tipoCliente, rubro, orden, soloActivos]);

  useEffect(() => {
    const timer = setTimeout(() => cargar(), busqueda.trim() ? 300 : 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, vista, tipoCliente, rubro, orden, soloActivos, pagina]);

  function filtros(extra = {}) {
    return {
      q: busqueda.trim() || undefined,
      vista,
      tipo_cliente: tipoCliente || undefined,
      rubro: rubro || undefined,
      orden,
      solo_activos: soloActivos,
      limit: pageSize,
      offset: pagina * pageSize,
      ...extra,
    };
  }

  async function cargar() {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    try {
      setBuscando(true);
      setError("");
      const resultado = await obtenerPanelCrmClientes(filtros());
      if (requestId === requestRef.current) setData(resultado);
    } catch (err) {
      if (requestId === requestRef.current) setError(err.message || "No se pudo cargar el panel CRM");
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setBuscando(false);
      }
    }
  }

  async function exportarCsv() {
    try {
      setExportando(true);
      setError("");
      const resultado = await obtenerPanelCrmClientes(filtros({ limit: 500, offset: 0 }));
      const encabezados = [
        "Cliente",
        "Telefono",
        "Tipo",
        "Ultima actividad",
        "Dias sin actividad",
        "Operaciones 12 meses",
        "Ventas 12 meses",
        "Ganancia 12 meses",
        "Rubro principal",
        "Deuda",
        "Credito",
        "Segmentos",
        "Accion sugerida",
      ];
      const filas = (resultado.items || []).map((cliente) => [
        cliente.nombre,
        cliente.telefono || "",
        renderTipo(cliente.tipo_cliente),
        cliente.ultima_actividad_fecha || "",
        cliente.dias_desde_ultima_actividad ?? "",
        cliente.operaciones_365,
        cliente.ventas_365,
        cliente.ganancia_365 ?? "",
        cliente.rubro_principal?.nombre || "",
        cliente.deuda_vigente,
        cliente.credito_vigente,
        (cliente.segmentos || []).map((segmento) => segmento.nombre).join(" | "),
        cliente.accion_sugerida?.label || "",
      ]);
      descargarCsv(`clientes-crm-${vista}.csv`, [encabezados, ...filas]);
    } catch (err) {
      setError(err.message || "No se pudo exportar el listado CRM");
    } finally {
      setExportando(false);
    }
  }

  if (loading && !data) {
    return <EmptyState icon={Users} title="Preparando CRM..." description="Calculando actividad y segmentos de clientes." />;
  }

  const resumen = data?.resumen_vistas || {};
  const items = data?.items || [];
  const totalPaginas = Math.max(Math.ceil(Number(data?.total || 0) / pageSize), 1);

  return (
    <div style={styles.page}>
      <PageHeader
        title="CRM de clientes"
        subtitle={`Actividad comercial de los ultimos 12 meses · ${formatDateOnly(data?.periodo?.fecha_desde)} al ${formatDateOnly(data?.periodo?.fecha_hasta)}`}
        actions={(
          <>
            <Button type="button" variant="outline" onClick={cargar} disabled={buscando}>
              <RefreshCw size={16} /> {buscando ? "Actualizando..." : "Refrescar"}
            </Button>
            <Link to="/clientes/nuevo" style={styles.primaryLink}><UserPlus size={16} /> Nuevo cliente</Link>
          </>
        )}
      />

      {error && <div style={styles.error}>Error: {error}</div>}

      <ResponsiveMetricsGrid minWidth={165} mobileColumns={2}>
        <MetricCard label="Clientes analizados" value={resumen.todos || 0} />
        <MetricCard label="Recurrentes" value={resumen.recurrentes || 0} tone="success" />
        <MetricCard label="Inactivos" value={resumen.inactivos || 0} tone={(resumen.inactivos || 0) > 0 ? "warning" : "default"} />
        <MetricCard label="Con deuda" value={resumen.deuda || 0} tone={(resumen.deuda || 0) > 0 ? "danger" : "default"} />
        <MetricCard label="Frecuentes de taller" value={resumen.taller || 0} tone="primary" />
        <MetricCard label="Sin actividad" value={resumen.sin_actividad || 0} />
      </ResponsiveMetricsGrid>

      <Card title="Encontrar oportunidades" subtitle="Elegí una vista rápida y afiná la búsqueda con los filtros.">
        {isMobile ? (
          <div style={styles.mobileViewPicker}>
            <FilterSelect label="Vista rápida" value={vista} onChange={setVista}>
              {VISTAS.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.label} ({resumen[opcion.countKey] || 0})
                </option>
              ))}
            </FilterSelect>
          </div>
        ) : (
          <div style={styles.viewPicker}>
            <span style={styles.viewPickerLabel}>Vista rápida</span>
            <div style={styles.views} role="tablist" aria-label="Vistas CRM">
              {VISTAS.map((opcion) => {
                const active = vista === opcion.id;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setVista(opcion.id)}
                    style={{ ...styles.viewButton, ...(active ? styles.viewButtonActive : {}) }}
                  >
                    <span>{opcion.label}</span>
                    <strong style={{ ...styles.viewCount, ...(active ? styles.viewCountActive : {}) }}>
                      {resumen[opcion.countKey] || 0}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={isMobile ? styles.filtersMobile : styles.filters}>
          <SearchField
            value={busqueda}
            onChange={setBusqueda}
            onSearch={cargar}
            placeholder="Nombre, telefono, documento o bicicleta"
            style={{ ...styles.search, ...(isMobile ? styles.searchMobile : {}) }}
            inputStyle={styles.searchInput}
          />
          <FilterSelect label="Tipo" value={tipoCliente} onChange={setTipoCliente}>
            <option value="">Todos</option>
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
          </FilterSelect>
          <FilterSelect label="Rubro principal" value={rubro} onChange={setRubro}>
            <option value="">Todos</option>
            {(data?.rubros_disponibles || []).map((item) => (
              <option key={item.clave} value={item.clave}>{item.nombre}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Ordenar" value={orden} onChange={setOrden}>
            <option value="reciente">Actividad reciente</option>
            <option value="inactividad">Mayor inactividad</option>
            <option value="actividad">Mas operaciones</option>
            <option value="valor">Mayor venta</option>
            <option value="nombre">Nombre A-Z</option>
          </FilterSelect>
          <label style={{ ...styles.toggle, ...(soloActivos ? styles.toggleActive : {}) }}>
            <input type="checkbox" checked={soloActivos} onChange={(event) => setSoloActivos(event.target.checked)} />
            Solo activos
          </label>
          <Button type="button" variant="outline" onClick={exportarCsv} disabled={exportando || !data?.total}>
            <Download size={16} /> {exportando ? "Exportando..." : "Descargar CSV"}
          </Button>
        </div>
      </Card>

      <section style={styles.resultsSection}>
        <div style={styles.resultsHeader}>
          <div>
            <h2 style={styles.resultsTitle}>Clientes</h2>
            <span style={styles.muted}>{data?.total || 0} resultado(s) con los filtros actuales</span>
          </div>
          <Link to="/clientes" style={styles.listLink}>Ver listado administrativo</Link>
        </div>

        {!items.length ? (
          <EmptyState icon={Search} title="No hay clientes para esta vista" description="Probá ampliar los filtros o elegir otra vista." />
        ) : isMobile ? (
          <div style={styles.mobileList}>
            {items.map((cliente) => <ClienteCrmCard key={cliente.id} cliente={cliente} navigate={navigate} puedeVerRentabilidad={data.puede_ver_rentabilidad} />)}
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Ultima actividad</th>
                  <th style={styles.thNumber}>12 meses</th>
                  <th style={styles.th}>Perfil</th>
                  <th style={styles.thNumber}>Cuenta</th>
                  <th style={styles.th}>Accion sugerida</th>
                  <th style={styles.th}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {items.map((cliente) => (
                  <tr key={cliente.id} style={styles.tr} onDoubleClick={() => navigate(`/clientes/${cliente.id}`)}>
                    <td style={styles.td}>
                      <strong>{cliente.nombre}</strong>
                      <span style={styles.cellMuted}>{cliente.telefono || "Sin telefono"} · #{cliente.id}</span>
                    </td>
                    <td style={styles.td}>
                      <strong>{cliente.ultima_actividad_fecha ? formatDateOnly(cliente.ultima_actividad_fecha) : "Sin actividad"}</strong>
                      <span style={styles.cellMuted}>{cliente.dias_desde_ultima_actividad == null ? "Sin movimientos" : `Hace ${cliente.dias_desde_ultima_actividad} dias`}</span>
                    </td>
                    <td style={styles.tdNumber}>
                      <strong>{formatMoney(cliente.ventas_365)}</strong>
                      <span style={styles.cellMuted}>{cliente.operaciones_365} op. {data.puede_ver_rentabilidad && cliente.ganancia_365 != null ? `· Gan. ${formatMoney(cliente.ganancia_365)}` : ""}</span>
                    </td>
                    <td style={styles.td}>
                      <strong>{cliente.rubro_principal?.nombre || "Sin rubro"}</strong>
                      <Segmentos segmentos={cliente.segmentos} limit={3} />
                    </td>
                    <td style={styles.tdNumber}>
                      <CuentaResumen cliente={cliente} />
                    </td>
                    <td style={styles.td}>
                      <AccionBadge accion={cliente.accion_sugerida} />
                    </td>
                    <td style={styles.td}>
                      <Button type="button" variant="outline" style={styles.openButton} onClick={() => navigate(`/clientes/${cliente.id}`)}>Abrir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data?.total > pageSize && (
          <div style={styles.pagination}>
            <Button type="button" variant="outline" disabled={pagina === 0} onClick={() => setPagina((actual) => Math.max(actual - 1, 0))}>Anterior</Button>
            <span>Pagina {pagina + 1} de {totalPaginas}</span>
            <Button type="button" variant="outline" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((actual) => actual + 1)}>Siguiente</Button>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.select}>{children}</select>
    </label>
  );
}

function Segmentos({ segmentos = [], limit = 4 }) {
  if (!segmentos.length) return <span style={styles.cellMuted}>Sin segmento</span>;
  return (
    <div style={styles.badges}>
      {segmentos.slice(0, limit).map((segmento) => (
        <span key={segmento.clave} title={segmento.motivo}>
          <Badge variant={badgeVariant[segmento.tono] || "default"}>{segmento.nombre}</Badge>
        </span>
      ))}
      {segmentos.length > limit && <Badge>+{segmentos.length - limit}</Badge>}
    </div>
  );
}

function CuentaResumen({ cliente }) {
  const deuda = Number(cliente.deuda_vigente || 0);
  const credito = Number(cliente.credito_vigente || 0);
  if (!deuda && !credito) return <span style={styles.cellMuted}>Sin pendientes</span>;
  return (
    <div style={styles.accountValues}>
      {deuda > 0 && <strong style={{ color: colors.dangerDark }}>Debe {formatMoney(deuda)}</strong>}
      {credito > 0 && <strong style={{ color: colors.successDark }}>Credito {formatMoney(credito)}</strong>}
    </div>
  );
}

function AccionBadge({ accion }) {
  if (!accion) return null;
  if (accion.clave === "sin_urgencia") return null;
  return <Badge variant={badgeVariant[accion.tono] || "default"}>{accion.label}</Badge>;
}

function ClienteCrmCard({ cliente, navigate, puedeVerRentabilidad }) {
  return (
    <article style={styles.mobileCard}>
      <div style={styles.mobileHeader}>
        <div>
          <strong style={styles.mobileName}>{cliente.nombre}</strong>
          <span style={styles.cellMuted}>{cliente.telefono || "Sin telefono"} · #{cliente.id}</span>
        </div>
        <AccionBadge accion={cliente.accion_sugerida} />
      </div>
      <div style={styles.mobileMetrics}>
        <MobileMetric label="Ultima actividad" value={cliente.ultima_actividad_fecha ? formatDateOnly(cliente.ultima_actividad_fecha) : "Sin actividad"} detail={cliente.dias_desde_ultima_actividad == null ? "Sin movimientos" : `Hace ${cliente.dias_desde_ultima_actividad} dias`} />
        <MobileMetric label="Ventas 12 meses" value={formatMoney(cliente.ventas_365)} detail={`${cliente.operaciones_365} operaciones`} />
        {puedeVerRentabilidad && <MobileMetric label="Ganancia" value={formatMoney(cliente.ganancia_365)} detail={cliente.margen_365 == null ? "Sin margen" : formatPercent(cliente.margen_365)} />}
        <MobileMetric label="Taller" value={`${cliente.ordenes_taller_365} OT`} detail={`${cliente.bicicletas_registradas} bicicletas`} />
      </div>
      <div style={styles.mobileSection}>
        <span style={styles.mobileLabel}>Perfil</span>
        <strong>{cliente.rubro_principal?.nombre || "Sin rubro principal"}</strong>
        <Segmentos segmentos={cliente.segmentos} />
      </div>
      <div style={styles.mobileSection}>
        <span style={styles.mobileLabel}>Cuenta</span>
        <CuentaResumen cliente={cliente} />
      </div>
      <Button type="button" variant="primary" onClick={() => navigate(`/clientes/${cliente.id}`)} fullWidth>Abrir cliente</Button>
    </article>
  );
}

function MobileMetric({ label, value, detail }) {
  return (
    <div style={styles.mobileMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function renderTipo(tipo) {
  if (tipo === "mayorista") return "Mayorista";
  if (tipo === "consumidor_final") return "Consumidor final";
  return "Minorista";
}

function formatDateOnly(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

function descargarCsv(nombre, filas) {
  const contenido = filas
    .map((fila) => fila.map((valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const styles = {
  page: { display: "grid", gap: spacing.md },
  modeBar: { display: "inline-flex", justifySelf: "start", maxWidth: "100%", boxSizing: "border-box", overflowX: "auto", gap: 4, padding: 4, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface },
  modeButton: { minHeight: 40, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 13px", border: 0, borderRadius: radius.sm, background: "transparent", color: colors.textMuted, fontWeight: 800, cursor: "pointer" },
  modeButtonActive: { background: colors.primary, color: colors.surface },
  primaryLink: { minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 14px", borderRadius: radius.md, background: colors.primary, color: colors.surface, textDecoration: "none", fontWeight: 800 },
  error: { border: `1px solid ${colors.danger}`, background: colors.dangerSoft, color: colors.dangerDark, borderRadius: radius.md, padding: 12, fontWeight: 700 },
  viewPicker: { display: "grid", gap: 7 },
  viewPickerLabel: { color: colors.textMuted, fontSize: 11, fontWeight: 800, textTransform: "uppercase" },
  views: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4, padding: 4, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceMuted },
  viewButton: { minWidth: 0, minHeight: 38, border: 0, borderRadius: radius.sm, background: "transparent", color: colors.textMuted, padding: "7px 9px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" },
  viewButtonActive: { background: colors.surface, color: colors.primary, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)" },
  viewCount: { minWidth: 24, padding: "2px 6px", borderRadius: 999, background: colors.surface, color: colors.text, textAlign: "center", fontSize: 12 },
  viewCountActive: { background: colors.primarySoft, color: colors.primary },
  mobileViewPicker: { maxWidth: 420 },
  filters: { display: "grid", gridTemplateColumns: "minmax(260px, 1.6fr) repeat(3, minmax(150px, .7fr)) auto auto", gap: 10, alignItems: "end", marginTop: spacing.md },
  filtersMobile: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: spacing.md },
  search: { minHeight: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceMuted },
  searchMobile: { gridColumn: "1 / -1" },
  searchInput: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontSize: 14 },
  field: { display: "grid", gap: 4, color: colors.textMuted, fontSize: 12, fontWeight: 700 },
  select: { width: "100%", minHeight: 42, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, padding: "0 10px", color: colors.text, fontWeight: 700 },
  toggle: { minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 11px", border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.textMuted, fontWeight: 700, whiteSpace: "nowrap" },
  toggleActive: { background: colors.successSoft, borderColor: colors.success, color: colors.successDark },
  resultsSection: { background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, overflow: "hidden" },
  resultsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: spacing.lg, borderBottom: `1px solid ${colors.border}` },
  resultsTitle: { margin: 0, fontSize: typography.sectionTitle.fontSize },
  muted: { color: colors.textMuted, fontSize: 13 },
  listLink: { color: colors.secondary, fontWeight: 800, textDecoration: "none" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1120 },
  th: { padding: "11px 12px", textAlign: "left", color: colors.textMuted, fontSize: 12, borderBottom: `1px solid ${colors.border}` },
  thNumber: { padding: "11px 12px", textAlign: "right", color: colors.textMuted, fontSize: 12, borderBottom: `1px solid ${colors.border}` },
  tr: { cursor: "pointer" },
  td: { padding: "13px 12px", borderBottom: `1px solid ${colors.borderSoft}`, verticalAlign: "top", color: colors.text },
  tdNumber: { padding: "13px 12px", borderBottom: `1px solid ${colors.borderSoft}`, verticalAlign: "top", textAlign: "right", color: colors.text },
  cellMuted: { display: "block", marginTop: 3, color: colors.textMuted, fontSize: 12 },
  badges: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 },
  accountValues: { display: "grid", gap: 3 },
  openButton: { whiteSpace: "nowrap" },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: spacing.md },
  mobileList: { display: "grid", gap: 10, padding: 10, background: colors.background },
  mobileCard: { background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: 12, display: "grid", gap: 12 },
  mobileHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 },
  mobileName: { display: "block", overflowWrap: "anywhere" },
  mobileMetrics: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  mobileMetric: { minWidth: 0, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.sm, padding: 8, display: "grid", gap: 2 },
  mobileSection: { display: "grid", gap: 4, paddingTop: 8, borderTop: `1px solid ${colors.borderSoft}` },
  mobileLabel: { color: colors.textMuted, fontSize: 11, fontWeight: 800, textTransform: "uppercase" },
};
