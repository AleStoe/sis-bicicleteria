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
    <div>
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1fr) 240px",
            gap: "12px",
          }}
        >
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
                <Link
                  to={`/ventas/${venta.id}`}
                  style={{
                    fontWeight: 700,
                    textDecoration: "none",
                    color: "#2563eb",
                  }}
                >
                  Ver detalle
                </Link>
              </td>
            </>
          )}
        />
      </Card>
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
