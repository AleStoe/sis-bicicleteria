import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarClientes } from "../services/clientesService";
import {
  Button,
  Card,
  EmptyState,
  MetricCard,
  PageHeader,
  ResponsiveMetricsGrid,
} from "../components/ui";
import SearchField from "../components/ui/SearchField";
import { ArrowDownAZ, BarChart3, Clock3, RefreshCw, UserPlus, Users, X } from "lucide-react";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";


const MOBILE_BREAKPOINT = 760;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => setIsMobile(event.matches);

    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);

    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

export default function ClientesListPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [orden, setOrden] = useState("recientes");
  const requestIdRef = useRef(0);

  useEffect(() => {
    const delay = busqueda.trim() ? 300 : 100;
    const timer = setTimeout(() => {
      cargarClientes({ q: busqueda, soloActivosFiltro: soloActivos, ordenFiltro: orden });
    }, delay);

    return () => clearTimeout(timer);
  }, [busqueda, soloActivos, orden]);

  const totalActivos = useMemo(
    () => clientes.filter((cliente) => cliente.activo).length,
    [clientes]
  );

  const totalInactivos = useMemo(
    () => clientes.filter((cliente) => !cliente.activo).length,
    [clientes]
  );

  async function cargarClientes({
    q = busqueda,
    soloActivosFiltro = soloActivos,
    ordenFiltro = orden,
  } = {}) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setBuscando(true);
      setError("");

      const data = await listarClientes({
        q: q.trim() || undefined,
        solo_activos: soloActivosFiltro,
        orden: ordenFiltro,
      });

      if (requestId === requestIdRef.current) {
        setClientes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err.message || "No se pudieron cargar los clientes");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setBuscando(false);
      }
    }
  }

  async function buscar(e) {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await cargarClientes({ q: busqueda, soloActivosFiltro: soloActivos, ordenFiltro: orden });
  }

  function limpiarBusqueda() {
    setBusqueda("");
  }

  function abrirCliente(clienteId) {
    navigate(`/clientes/${clienteId}`);
  }

  if (loading) {
    return <EmptyState icon={Users} title="Cargando clientes..." description="Actualizando cuentas e información de contacto." />;
  }

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <PageHeader
        title="Clientes"
        subtitle="Buscá por nombre, teléfono, DNI, CUIT o razón social."
        actions={(
          <>
            <Button type="button" variant="outline" onClick={cargarClientes} disabled={buscando}>
              <RefreshCw size={16} /> {buscando ? "Buscando..." : "Refrescar"}
            </Button>
            <Link to="/clientes/crm" style={styles.crmLink}><BarChart3 size={16} /> Ver CRM</Link>
            <Link to="/clientes/nuevo" style={styles.primaryLink}><UserPlus size={16} /> Nuevo cliente</Link>
          </>
        )}
      />

      {error && <div style={alertStyle}>Error: {error}</div>}

      <ResponsiveMetricsGrid minWidth={160} mobileColumns={2}>
        <MetricCard label="Total listado" value={clientes.length} />
        <MetricCard label="Activos" value={totalActivos} tone="success" />
        <MetricCard label="Inactivos" value={totalInactivos} tone={totalInactivos > 0 ? "warning" : "default"} />
      </ResponsiveMetricsGrid>

      <Card title="Encontrar cliente" subtitle="Buscá por nombre, teléfono, documento o razón social.">
        <form onSubmit={buscar} style={{ ...filterFormStyle, ...(isMobile ? filterFormMobileStyle : {}) }}>
          <SearchField
            value={busqueda}
            onChange={setBusqueda}
            onSearch={() => cargarClientes({ q: busqueda, soloActivosFiltro: soloActivos, ordenFiltro: orden })}
            placeholder="Ej: Juan, 291..., 30-..., razón social"
            style={{ ...styles.searchBox, ...(isMobile ? styles.searchBoxMobile : {}) }}
            inputStyle={styles.searchInput}
          />

          <label style={{ ...activeFilterStyle, ...(soloActivos ? activeFilterSelectedStyle : {}) }}>
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
              style={activeCheckboxStyle}
            />
            Solo activos
          </label>

          {busqueda && (
            <Button type="button" variant="ghost" onClick={limpiarBusqueda}>
              <X size={16} /> Limpiar
            </Button>
          )}
        </form>
      </Card>

      <section style={tableCardStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={tableTitleStyle}>Listado</h2>
            <span style={hintStyle}>{clientes.length} cliente(s) encontrados</span>
          </div>
          <div style={sortControlStyle} aria-label="Orden del listado">
            <button
              type="button"
              aria-pressed={orden === "recientes"}
              onClick={() => setOrden("recientes")}
              style={{ ...sortButtonStyle, ...(orden === "recientes" ? sortButtonActiveStyle : {}) }}
            >
              <Clock3 size={15} /> Recientes
            </button>
            <button
              type="button"
              aria-pressed={orden === "nombre"}
              onClick={() => setOrden("nombre")}
              style={{ ...sortButtonStyle, ...(orden === "nombre" ? sortButtonActiveStyle : {}) }}
            >
              <ArrowDownAZ size={15} /> A-Z
            </button>
          </div>
        </div>

        {clientes.length === 0 ? (
          <EmptyState icon={Users} title="No hay clientes para mostrar" description="Probá otra búsqueda o incluí clientes inactivos." />
        ) : isMobile ? (
          <ClientesMobileList clientes={clientes} abrirCliente={abrirCliente} orden={orden} />
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Contacto</th>
                  <th style={thStyle}>Fiscal</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Alta</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {clientes.map((cliente, index) => (
                  <tr
                    key={cliente.id}
                    onDoubleClick={() => abrirCliente(cliente.id)}
                    style={rowStyle}
                    title="Doble click para abrir"
                  >
                    <td style={tdStyle}>
                      <strong>{cliente.nombre}</strong>
                      <div style={mutedStyle}>#{cliente.id}</div>
                      {orden === "recientes" && index === 0 && (
                        <span style={latestBadgeStyle}>Último registrado</span>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <div>{cliente.telefono || "-"}</div>
                      <div style={mutedStyle}>DNI: {cliente.dni || "-"}</div>
                    </td>

                    <td style={tdStyle}>
                      <div>{renderCondicionIva(cliente.condicion_iva)}</div>
                      <div style={mutedStyle}>
                        {cliente.cuit || cliente.razon_social
                          ? `${cliente.cuit || "-"} · ${cliente.razon_social || "-"}`
                          : "Sin datos fiscales"}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <span style={badgeTipo(cliente.tipo_cliente)}>
                        {renderTipo(cliente.tipo_cliente)}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div>{formatFechaAlta(cliente.created_at)}</div>
                    </td>

                    <td style={tdStyle}>
                      <span style={cliente.activo ? activeBadgeStyle : inactiveBadgeStyle}>
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <Link to={`/clientes/${cliente.id}`} style={detailLinkStyle}>
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

const styles = {
  crmLink: {
    minHeight: controls.minHeight,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: controls.padding,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    fontWeight: typography.button.fontWeight,
    textDecoration: "none",
  },
  primaryLink: {
    minHeight: controls.minHeight,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: controls.padding,
    borderRadius: radius.md,
    background: colors.primary,
    color: colors.surface,
    fontWeight: typography.button.fontWeight,
    textDecoration: "none",
    boxShadow: shadows.sm,
  },
  searchBox: {
    minHeight: controls.minHeight,
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    padding: "0 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: colors.surfaceMuted,
  },
  searchInput: {
    width: "100%",
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  searchBoxMobile: {
    gridColumn: "1 / -1",
    width: "100%",
    boxSizing: "border-box",
  },
};


function ClientesMobileList({ clientes, abrirCliente, orden }) {
  return (
    <div style={mobileListStyle}>
      {clientes.map((cliente, index) => (
        <article key={cliente.id} style={mobileClientCardStyle}>
          <div style={mobileClientHeaderStyle}>
            <div style={mobileClientTitleWrapStyle}>
              <strong style={mobileClientNameStyle}>{cliente.nombre}</strong>
              <span style={mutedStyle}>Cliente #{cliente.id}</span>
              {orden === "recientes" && index === 0 && (
                <span style={latestBadgeStyle}>Último registrado</span>
              )}
            </div>

            <span style={cliente.activo ? activeBadgeStyle : inactiveBadgeStyle}>
              {cliente.activo ? "Activo" : "Inactivo"}
            </span>
          </div>

          <div style={mobileInfoGridStyle}>
            <MobileInfo label="Teléfono" value={cliente.telefono || "-"} />
            <MobileInfo label="DNI" value={cliente.dni || "-"} />
            <MobileInfo label="Tipo" value={renderTipo(cliente.tipo_cliente)} />
            <MobileInfo label="IVA" value={renderCondicionIva(cliente.condicion_iva)} />
            <MobileInfo label="Alta" value={formatFechaAlta(cliente.created_at)} full />
            <MobileInfo
              label="Fiscal"
              value={
                cliente.cuit || cliente.razon_social
                  ? `${cliente.cuit || "-"} · ${cliente.razon_social || "-"}`
                  : "Sin datos fiscales"
              }
              full
            />
          </div>

          <button
            type="button"
            onClick={() => abrirCliente(cliente.id)}
            style={mobileDetailButtonStyle}
          >
            Ver detalle
          </button>
        </article>
      ))}
    </div>
  );
}

function MobileInfo({ label, value, full = false }) {
  return (
    <div style={{ ...mobileInfoBoxStyle, ...(full ? mobileInfoBoxFullStyle : {}) }}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function renderTipo(tipo) {
  const map = {
    consumidor_final: "Consumidor final",
    minorista: "Minorista",
    mayorista: "Mayorista",
  };

  return map[tipo] || tipo;
}

function renderCondicionIva(condicion) {
  const map = {
    consumidor_final: "Consumidor final",
    responsable_inscripto: "Resp. inscripto",
    monotributo: "Monotributo",
    exento: "Exento",
  };

  return map[condicion] || condicion || "-";
}

function formatFechaAlta(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function colorTipo(tipo) {
  switch (tipo) {
    case "consumidor_final":
      return "#555";
    case "minorista":
      return "#1565c0";
    case "mayorista":
      return "#137333";
    default:
      return "#444";
  }
}

function badgeTipo(tipo) {
  const color = colorTipo(tipo);

  return {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "999px",
    fontWeight: 800,
    fontSize: "12px",
    background: "#f3f4f6",
    color,
    border: `1px solid ${color}33`,
  };
}

const pageStyle = {
  padding: "24px",
  background: "#f6f7fb",
  minHeight: "100vh",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: "28px",
};

const subtitleStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const headerActionsStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const statCardStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "14px",
  display: "grid",
  gap: "5px",
  color: "#667085",
};

const filterCardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
  marginBottom: "16px",
};

const filterFormStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle = {
  minWidth: "340px",
  flex: 1,
  padding: "11px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
};

const activeFilterStyle = {
  minHeight: controls.minHeight,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "0 12px",
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.textMuted,
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};

const activeFilterSelectedStyle = {
  borderColor: "#86efac",
  background: "#f0fdf4",
  color: "#166534",
};

const activeCheckboxStyle = {
  width: "16px",
  height: "16px",
  accentColor: colors.success,
};

const tableCardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  overflow: "hidden",
};

const tableHeaderStyle = {
  padding: "16px 18px",
  borderBottom: "1px solid #eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const tableTitleStyle = {
  margin: 0,
  fontSize: "20px",
};

const hintStyle = {
  display: "inline-block",
  marginTop: "4px",
  color: "#667085",
  fontSize: "13px",
};

const sortControlStyle = {
  display: "inline-grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "3px",
  padding: "3px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
};

const sortButtonStyle = {
  minHeight: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "0 11px",
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};

const sortButtonActiveStyle = {
  background: "white",
  color: "#175cd3",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
};

const latestBadgeStyle = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  marginTop: "6px",
  padding: "3px 7px",
  borderRadius: "6px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "11px",
  fontWeight: 900,
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "980px",
};

const theadStyle = {
  background: "#f9fafb",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e5e7eb",
  color: "#475467",
  fontSize: "13px",
  whiteSpace: "nowrap",
  wordBreak: "normal",
  overflowWrap: "normal",
};

const tdStyle = {
  padding: "12px 14px",
  borderTop: "1px solid #f2f4f7",
  verticalAlign: "top",
};

const rowStyle = {
  cursor: "pointer",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
  marginTop: "3px",
};

const detailLinkStyle = {
  textDecoration: "none",
  fontWeight: 800,
  color: "#175cd3",
};

const primaryLinkStyle = {
  textDecoration: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
};

const primaryBtnStyle = {
  border: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
  cursor: "pointer",
};

const activeBadgeStyle = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  fontWeight: 800,
  fontSize: "12px",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
};

const inactiveBadgeStyle = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  fontWeight: 800,
  fontSize: "12px",
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #fecdca",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "14px",
};

const emptyStyle = {
  padding: "22px",
  color: "#667085",
};

const pageMobileStyle = {
  padding: "10px",
  overflowX: "hidden",
};

const headerMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "12px",
};

const headerActionsMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  width: "100%",
};

const statsGridMobileStyle = {
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const filterFormMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  alignItems: "stretch",
};

const inputMobileStyle = {
  minWidth: 0,
  gridColumn: "1 / -1",
  width: "100%",
  boxSizing: "border-box",
};

const mobileListStyle = {
  display: "grid",
  gap: "10px",
  padding: "12px",
};

const mobileClientCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  background: "white",
  padding: "12px",
  display: "grid",
  gap: "12px",
};

const mobileClientHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
};

const mobileClientTitleWrapStyle = {
  minWidth: 0,
  display: "grid",
  gap: "3px",
};

const mobileClientNameStyle = {
  color: "#101828",
  fontSize: "18px",
  lineHeight: 1.2,
  overflowWrap: "anywhere",
};

const mobileInfoGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};

const mobileInfoBoxStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "9px 10px",
  background: "#f8fafc",
  display: "grid",
  gap: "3px",
  color: "#667085",
  minWidth: 0,
};

const mobileInfoBoxFullStyle = {
  gridColumn: "1 / -1",
};

const mobileDetailButtonStyle = {
  border: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "12px",
  padding: "11px 12px",
  fontWeight: 900,
  cursor: "pointer",
};
