import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarVentas } from "../services/ventasService";
import { formatDateTime, formatMoney } from "../utils/formatters";
import {
  Badge,
  Button,
  Card,
  Input,
  MetricCard,
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

const VENTAS_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "fecha", label: "Fecha" },
  { key: "cliente", label: "Cliente" },
  { key: "sucursal", label: "Sucursal" },
  { key: "estado", label: "Estado" },
  { key: "total", label: "Total" },
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
  return <Badge variant={getEstadoVentaVariant(estado)}>{estado}</Badge>;
}

function getEstadoVentaVariant(estado) {
  switch (estado) {
    case "entregada":
      return "success";
    case "anulada":
      return "danger";
    case "pagada_total":
      return "default";
    case "pagada_parcial":
      return "warning";
    case "creada":
      return "primary";
    default:
      return "default";
  }
}

export default function VentasListPage() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
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

    return ventas.filter((venta) => {
      const coincideEstado =
        estadoFiltro === "todos" || venta.estado === estadoFiltro;

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

      return coincideEstado && coincideBusqueda;
    });
  }, [ventas, busqueda, estadoFiltro]);

  const resumen = useMemo(() => {
    return ventasFiltradas.reduce(
      (acc, venta) => {
        acc.cantidad += 1;
        acc.total += Number(venta.total_final || 0);
        acc.saldo += Number(venta.saldo_pendiente || 0);

        return acc;
      },
      { cantidad: 0, total: 0, saldo: 0 }
    );
  }, [ventasFiltradas]);

  if (loading) {
    return <div style={{ padding: "24px" }}>Cargando ventas...</div>;
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
        <MetricCard label="Ventas" value={resumen.cantidad} />
        <MetricCard
          label="Total filtrado"
          value={formatMoney(resumen.total)}
          tone="primary"
        />
        <MetricCard
          label="Saldo pendiente"
          value={formatMoney(resumen.saldo)}
          tone={Number(resumen.saldo) > 0 ? "warning" : "success"}
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
        </div>
      </Card>

      <Card
        title="Listado"
        subtitle={`${ventasFiltradas.length} venta(s) encontradas`}
      >
        {isMobile ? (
          <VentasMobileList ventas={ventasFiltradas} />
        ) : (
          <Table
            columns={VENTAS_COLUMNS}
            data={ventasFiltradas}
            emptyMessage="No hay ventas para mostrar."
            renderRow={(venta) => (
              <>
                <td style={tdStyle}>#{venta.id}</td>
                <td style={tdStyle}>{formatDateTime(venta.fecha)}</td>
                <td style={tdStyle}>{venta.cliente_nombre || "-"}</td>
                <td style={tdStyle}>{venta.sucursal_nombre || "-"}</td>
                <td style={tdStyle}>
                  <EstadoVentaBadge estado={venta.estado} />
                </td>
                <td style={tdStyle}>{formatMoney(venta.total_final)}</td>
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
                  <Link to={`/ventas/${venta.id}`} style={styles.linkAction}>
                    Ver detalle
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

function VentasMobileList({ ventas }) {
  if (!ventas.length) {
    return <div style={styles.emptyMobile}>No hay ventas para mostrar.</div>;
  }

  return (
    <div style={styles.mobileList}>
      {ventas.map((venta) => {
        const saldo = Number(venta.saldo_pendiente || 0);

        return (
          <article key={venta.id} style={styles.ventaCard}>
            <div style={styles.ventaHeader}>
              <div>
                <span style={styles.eyebrow}>Venta #{venta.id}</span>
                <strong style={styles.cliente}>
                  {venta.cliente_nombre || "Sin cliente"}
                </strong>
                <div style={styles.mutedSmall}>{formatDateTime(venta.fecha)}</div>
              </div>

              <EstadoVentaBadge estado={venta.estado} />
            </div>

            <div style={styles.amountGrid}>
              <div style={styles.amountBox}>
                <span>Total</span>
                <strong>{formatMoney(venta.total_final)}</strong>
              </div>

              <div style={styles.amountBox}>
                <span>Saldo</span>
                <strong style={{ color: saldo > 0 ? "#b45309" : "#067647" }}>
                  {formatMoney(venta.saldo_pendiente)}
                </strong>
              </div>
            </div>

            <div style={styles.mobileFields}>
              <MobileField label="Sucursal" value={venta.sucursal_nombre || "-"} />
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
    gridTemplateColumns: "minmax(260px, 1fr) 240px",
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
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
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
