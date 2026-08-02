import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarVentas } from "../services/ventasService";
import { formatDateTime, formatMoney } from "../utils/formatters";
import {
  Button,
  Card,
  EmptyState,
  Input,
  MetricCard,
  OperationalStatusBadge,
  PageHeader,
  Select,
  Table,
} from "../components/ui";

const MOBILE_BREAKPOINT = 760;

const ESTADOS_VENTA = [
  "creada",
  "pagada_parcial",
  "pagada_total",
  "entregada",
  "anulada",
];

const PERIODOS_VENTA = [
  { value: "todos", label: "Todo el historial" },
  { value: "hoy", label: "Hoy" },
  { value: "ultimos_7", label: "Ultimos 7 dias" },
  { value: "ultimos_30", label: "Ultimos 30 dias" },
  { value: "este_mes", label: "Este mes" },
];

const VENTAS_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "fecha", label: "Fecha" },
  { key: "cliente", label: "Cliente" },
  { key: "items", label: "Items" },
  { key: "origen", label: "Origen" },
  { key: "estado", label: "Estado" },
  { key: "total", label: "Total" },
  { key: "cobrado", label: "Cobrado" },
  { key: "saldo", label: "Saldo" },
  { key: "accion", label: "Acción" },
];

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

export function EstadoVentaBadge({ estado }) {
  return <OperationalStatusBadge domain="venta" status={estado} />;
}

export default function VentasListPage() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const isMobile = useIsMobile();

  useEffect(() => {
    cargarVentas();
  }, []);

  async function cargarVentas() {
    try {
      setLoading(true);
      setError("");

      const data = await listarVentas();
      setVentas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ventas");
    } finally {
      setLoading(false);
    }
  }

  const ventasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const periodo = getPeriodoRange(periodoFiltro);

    return ventas.filter((venta) => {
      const coincideEstado =
        estadoFiltro === "todos" || venta.estado === estadoFiltro;
      const coincidePeriodo = ventaEstaEnPeriodo(venta.fecha, periodo);

      const texto = [
        venta.id,
        venta.cliente_nombre,
        venta.sucursal_nombre,
        venta.estado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = !q || texto.includes(q);

      return coincideEstado && coincidePeriodo && coincideBusqueda;
    });
  }, [ventas, busqueda, estadoFiltro, periodoFiltro]);

  const resumen = useMemo(() => {
    return ventasFiltradas.reduce(
      (acc, venta) => {
        const montos = getVentaMontos(venta);
        const anulada = venta.estado === "anulada";

        acc.cantidad += 1;
        if (anulada) {
          acc.anuladas += 1;
          acc.totalAnulado += montos.total;
          return acc;
        }

        acc.validas += 1;
        acc.total += montos.total;
        acc.cobrado += montos.cobrado;
        acc.saldo += montos.saldo;
        if (venta.estado !== "entregada") {
          acc.pendientesEntrega += 1;
        }

        return acc;
      },
      {
        cantidad: 0,
        validas: 0,
        total: 0,
        cobrado: 0,
        saldo: 0,
        pendientesEntrega: 0,
        anuladas: 0,
        totalAnulado: 0,
      }
    );
  }, [ventasFiltradas]);

  const mostrarSucursal = useMemo(() => {
    const sucursales = new Set(
      (ventas || [])
        .map((venta) => Number(venta.id_sucursal))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    return sucursales.size > 1;
  }, [ventas]);

  const columnasVentas = useMemo(() => {
    if (!mostrarSucursal) return VENTAS_COLUMNS;

    return [
      ...VENTAS_COLUMNS.slice(0, 3),
      { key: "sucursal", label: "Sucursal" },
      ...VENTAS_COLUMNS.slice(3),
    ];
  }, [mostrarSucursal]);

  if (loading) {
    return <EmptyState title="Cargando ventas..." description="Actualizando estados, saldos y entregas." />;
  }

  return (
    <div style={isMobile ? styles.pageMobile : undefined}>
      <PageHeader
        title="Ventas"
        subtitle="Listado de ventas, saldos y estado de entrega/cobro"
        actions={
          <>
            <Button variant="outline" onClick={cargarVentas}>
              Refrescar
            </Button>

            <Link to="/ventas/nueva" style={{ textDecoration: "none" }}>
              <Button>Nueva venta</Button>
            </Link>
          </>
        }
      />

      {error ? <Alert type="error" message={error} /> : null}

      <section style={isMobile ? styles.metricsMobile : styles.metrics}>
        <MetricCard label="Ventas encontradas" value={resumen.cantidad} />
        <MetricCard
          label="Total vendido"
          value={formatMoney(resumen.total)}
          tone="primary"
          footer={`${resumen.validas} venta(s) validas`}
        />
        <MetricCard
          label="Cobrado"
          value={formatMoney(resumen.cobrado)}
          tone="success"
        />
        <MetricCard
          label="Saldo pendiente"
          value={formatMoney(resumen.saldo)}
          tone={Number(resumen.saldo) > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Sin entregar"
          value={resumen.pendientesEntrega}
          tone={resumen.pendientesEntrega > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Anuladas"
          value={resumen.anuladas}
          tone={resumen.anuladas > 0 ? "danger" : "default"}
          footer={resumen.anuladas > 0 ? formatMoney(resumen.totalAnulado) : undefined}
        />
      </section>

      <Card
        title="Filtros"
        subtitle="Buscá por cliente, sucursal, estado o número de venta"
        style={{ marginBottom: "16px" }}
      >
        <div style={isMobile ? styles.filtersMobile : styles.filters}>
          <Input
            label="Buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Cliente, estado, sucursal o ID"
          />

          <Select
            label="Estado"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            {ESTADOS_VENTA.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </Select>

          <Select
            label="Periodo"
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value)}
          >
            {PERIODOS_VENTA.map((periodo) => (
              <option key={periodo.value} value={periodo.value}>
                {periodo.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card
        title="Listado"
        subtitle={`${ventasFiltradas.length} venta(s) encontradas`}
      >
        {isMobile ? (
          <VentasMobileList ventas={ventasFiltradas} mostrarSucursal={mostrarSucursal} />
        ) : (
          <Table
            columns={columnasVentas}
            data={ventasFiltradas}
            emptyMessage="No hay ventas para mostrar."
            renderRow={(venta) => (
              <>
                <td style={tdStyle}>#{venta.id}</td>
                <td style={tdStyle}>{formatDateTime(venta.fecha)}</td>
                <td style={tdStyle}>
                  <ClienteVentaLink venta={venta} />
                </td>
                {mostrarSucursal && <td style={tdStyle}>{venta.sucursal_nombre || "-"}</td>}
                <td style={styles.itemsCell}>
                  <strong>{formatCantidadItems(venta.cantidad_items)}</strong>
                  {venta.tiene_serializadas ? (
                    <span title="Venta con numero de cuadro" aria-label="Venta con numero de cuadro">
                      🚲
                    </span>
                  ) : null}
                </td>
                <td style={tdStyle}>
                  <OrigenVentaBadge origen={venta.origen_venta} />
                </td>
                <td style={tdStyle}>
                  <EstadoVentaBadge estado={venta.estado} />
                </td>
                <td style={tdStyle}>{formatMoney(venta.total_final)}</td>
                <td style={{ ...tdStyle, fontWeight: 800, color: "#067647" }}>
                  {formatMoney(getVentaMontos(venta).cobrado)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 700,
                    color:
                      Number(venta.saldo_pendiente || 0) > 0
                        ? "#b45309"
                        : "#067647",
                  }}
                >
                  {formatMoney(venta.saldo_pendiente)}
                </td>
                <td style={tdStyle}>
                  <Link
                    to={`/ventas/${venta.id}`}
                    style={styles.iconAction}
                    title="Ver detalle"
                    aria-label={`Ver detalle de venta ${venta.id}`}
                  >
                    👁
                  </Link>
                </td>
              </>
            )}
          />
        )}
      </Card>
    </div>
  );
}

function VentasMobileList({ ventas, mostrarSucursal }) {
  if (!ventas.length) {
    return <EmptyState title="No hay ventas para mostrar" description="Probá otro estado o cambiá la búsqueda." />;
  }

  return (
    <div style={styles.mobileList}>
      {ventas.map((venta) => {
        const montos = getVentaMontos(venta);

        return (
          <article key={venta.id} style={styles.ventaCard}>
            <div style={styles.ventaHeader}>
              <div>
                <span style={styles.eyebrow}>Venta #{venta.id}</span>
                <ClienteVentaLink venta={venta} mobile />
                <div style={styles.mutedSmall}>
                  {formatDateTime(venta.fecha)}
                  {venta.tiene_serializadas ? <span title="Venta con numero de cuadro"> · 🚲</span> : null}
                </div>
              </div>

              <EstadoVentaBadge estado={venta.estado} />
            </div>

            <div style={styles.mobileMetaRow}>
              <OrigenVentaBadge origen={venta.origen_venta} />
              <span style={styles.itemsPill}>Items {formatCantidadItems(venta.cantidad_items)}</span>
            </div>

            <div style={styles.amountGrid}>
              <div style={styles.amountBox}>
                <span>Total</span>
                <strong>{formatMoney(montos.total)}</strong>
              </div>

              <div style={styles.amountBox}>
                <span>Cobrado</span>
                <strong style={{ color: "#067647" }}>
                  {formatMoney(montos.cobrado)}
                </strong>
              </div>

              <div style={styles.amountBox}>
                <span>Saldo</span>
                <strong style={{ color: montos.saldo > 0 ? "#b45309" : "#067647" }}>
                  {formatMoney(montos.saldo)}
                </strong>
              </div>
            </div>

            <div style={styles.mobileFields}>
              {mostrarSucursal && <MobileField label="Sucursal" value={venta.sucursal_nombre || "-"} />}
            </div>

            <Link to={`/ventas/${venta.id}`} style={styles.mobilePrimaryAction}>
              Ver detalle
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function getVentaMontos(venta) {
  const total = Number(venta.total_final || 0);
  const saldo = Math.max(0, Number(venta.saldo_pendiente || 0));
  const cobrado = Math.max(0, total - saldo);

  return { total, saldo, cobrado };
}

function getPeriodoRange(periodo) {
  if (periodo === "todos") {
    return null;
  }

  const now = new Date();
  const end = endOfDay(now);

  if (periodo === "hoy") {
    return { start: startOfDay(now), end };
  }

  if (periodo === "ultimos_7") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  if (periodo === "ultimos_30") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 29);
    return { start, end };
  }

  if (periodo === "este_mes") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      end,
    };
  }

  return null;
}

function ventaEstaEnPeriodo(fecha, periodo) {
  if (!periodo) return true;

  const ventaFecha = new Date(fecha);
  if (Number.isNaN(ventaFecha.getTime())) return false;

  return ventaFecha >= periodo.start && ventaFecha <= periodo.end;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatCantidadItems(value) {
  const numero = Number(value || 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.trunc(numero);
}

function ClienteVentaLink({ venta, mobile = false }) {
  const label = venta.cliente_nombre || (venta.id_cliente ? `Cliente #${venta.id_cliente}` : "Sin cliente");

  if (!venta.id_cliente) {
    return <strong style={mobile ? styles.cliente : undefined}>{label}</strong>;
  }

  return (
    <Link
      to={`/clientes/${venta.id_cliente}`}
      style={mobile ? styles.clienteLinkMobile : styles.clienteLink}
      title="Abrir perfil del cliente"
    >
      {label}
    </Link>
  );
}

function OrigenVentaBadge({ origen }) {
  const config = getOrigenVentaConfig(origen);
  return <span style={{ ...styles.originBadge, ...config.style }}>{config.label}</span>;
}

function getOrigenVentaConfig(origen) {
  const key = String(origen || "venta").toLowerCase();

  if (key === "taller") {
    return { label: "Taller", style: { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" } };
  }

  if (key === "reserva") {
    return { label: "Reserva", style: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" } };
  }

  if (key === "postventa") {
    return { label: "Postventa", style: { background: "#ecfdf3", color: "#067647", borderColor: "#abefc6" } };
  }

  return { label: "Venta", style: { background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" } };
}

function MobileField({ label, value }) {
  return (
    <div style={styles.mobileField}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function Alert({ type, message }) {
  const isError = type === "error";

  return (
    <div
      style={{
        background: isError ? "#fff1f0" : "#ecfdf3",
        color: isError ? "#b42318" : "#027a48",
        padding: "12px",
        borderRadius: "10px",
        border: `1px solid ${isError ? "#f4c7c3" : "#abefc6"}`,
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

const tdStyle = {
  padding: "12px 16px",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const styles = {
  pageMobile: {
    overflowX: "hidden",
    paddingBottom: 12,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  metricsMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    marginBottom: "12px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 220px 220px",
    gap: "12px",
  },
  filtersMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },
  linkAction: {
    fontWeight: 700,
    textDecoration: "none",
    color: "#2563eb",
  },
  clienteLink: {
    color: "#1d4ed8",
    fontWeight: 900,
    textDecoration: "none",
  },
  clienteLinkMobile: {
    display: "block",
    marginTop: 3,
    color: "#1d4ed8",
    fontSize: 17,
    fontWeight: 950,
    lineHeight: 1.2,
    textDecoration: "none",
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    display: "inline-grid",
    placeItems: "center",
    textDecoration: "none",
    fontWeight: 1000,
  },
  itemsCell: {
    ...tdStyle,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  originBadge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 950,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  emptyMobile: {
    padding: 16,
    borderRadius: 14,
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 900,
    textAlign: "center",
  },
  mobileList: {
    display: "grid",
    gap: 10,
  },
  ventaCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    background: "white",
    display: "grid",
    gap: 12,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
  },
  ventaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  eyebrow: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cliente: {
    display: "block",
    marginTop: 3,
    fontSize: 17,
    lineHeight: 1.2,
  },
  mutedSmall: {
    color: "#667085",
    fontSize: 13,
    marginTop: 4,
    fontWeight: 750,
  },
  amountGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 8,
  },
  mobileMetaRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  itemsPill: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 11,
    fontWeight: 950,
  },
  amountBox: {
    display: "grid",
    gap: 4,
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  mobileFields: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  mobileField: {
    minWidth: 0,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
    background: "#ffffff",
    display: "grid",
    gap: 3,
  },
  mobilePrimaryAction: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    borderRadius: 12,
    padding: "11px 12px",
    background: "#2563eb",
    color: "white",
    fontWeight: 1000,
  },
};
