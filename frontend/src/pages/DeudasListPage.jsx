import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarDeudas } from "../services/deudasService";
import { formatMoney } from "../utils/formatters";
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

const ESTADOS_DEUDA = [
  { value: "", label: "Todos" },
  { value: "abierta", label: "Abierta" },
  { value: "cerrada", label: "Cerrada" },
  { value: "cancelada", label: "Cancelada" },
];

const DEUDAS_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "cliente", label: "Cliente" },
  { key: "origen", label: "Origen" },
  { key: "saldo", label: "Saldo" },
  { key: "estado", label: "Estado" },
  { key: "recargo", label: "Recargo" },
  { key: "observacion", label: "Observación" },
  { key: "acciones", label: "Acciones" },
];

export function EstadoDeudaBadge({ estado }) {
  return <Badge variant={getEstadoDeudaVariant(estado)}>{estado || "-"}</Badge>;
}

function getEstadoDeudaVariant(estado) {
  switch (estado) {
    case "abierta":
      return "warning";
    case "cerrada":
      return "success";
    case "cancelada":
      return "danger";
    default:
      return "default";
  }
}

export default function DeudasListPage() {
  const [deudas, setDeudas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ estado: "abierta", q: "" });

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDeudas(filtros);
    }, 350);

    return () => clearTimeout(timer);
  }, [filtros.estado, filtros.q]);

  async function cargarDeudas(params = filtros) {
    try {
      setLoading(true);
      setError("");

      const data = await listarDeudas(params);
      setDeudas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las deudas");
    } finally {
      setLoading(false);
    }
  }

  function aplicarFiltros(e) {
    e.preventDefault();
    cargarDeudas(filtros);
  }

  function limpiarFiltros() {
    const next = { estado: "", q: "" };

    setFiltros(next);
    cargarDeudas(next);
  }

  const resumen = useMemo(() => {
    const abiertas = deudas.filter((deuda) => deuda.estado === "abierta");
    const saldoAbierto = abiertas.reduce(
      (acc, deuda) => acc + Number(deuda.saldo_actual || 0),
      0
    );

    return {
      cantidad: deudas.length,
      abiertas: abiertas.length,
      saldoAbierto,
    };
  }, [deudas]);

  return (
    <div>
      <PageHeader
        title="Deudas / Cuenta corriente"
        subtitle="Control de saldos pendientes por cliente."
        actions={
          <Button variant="outline" onClick={() => cargarDeudas()} disabled={loading}>
            Refrescar
          </Button>
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
        <MetricCard label="Deudas listadas" value={resumen.cantidad} />
        <MetricCard
          label="Abiertas"
          value={resumen.abiertas}
          tone={resumen.abiertas > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Saldo abierto"
          value={formatMoney(resumen.saldoAbierto)}
          tone={Number(resumen.saldoAbierto) > 0 ? "danger" : "success"}
        />
      </section>

      <Card
        title="Filtros"
        subtitle="Buscá por cliente, DNI o número de deuda"
        style={{ marginBottom: "16px" }}
      >
        <form
          onSubmit={aplicarFiltros}
          style={{
            display: "grid",
            gridTemplateColumns: "220px minmax(260px, 1fr) auto auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <Select
            label="Estado"
            value={filtros.estado}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, estado: e.target.value }))
            }
          >
            {ESTADOS_DEUDA.map((estado) => (
              <option key={estado.value || "todos"} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </Select>

          <Input
            label="Buscar cliente"
            value={filtros.q}
            onChange={(e) =>
              setFiltros((prev) => ({ ...prev, q: e.target.value }))
            }
            placeholder="DNI, nombre o ID..."
          />

          <Button type="submit" disabled={loading}>
            Aplicar
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={limpiarFiltros}
          >
            Limpiar
          </Button>
        </form>
      </Card>

      <Card
        title="Listado"
        subtitle={
          loading
            ? "Cargando deudas..."
            : `${deudas.length} deuda(s) para los filtros seleccionados`
        }
      >
        <Table
          columns={DEUDAS_COLUMNS}
          data={loading ? [] : deudas}
          emptyMessage={
            loading
              ? "Cargando deudas..."
              : "No hay deudas para los filtros seleccionados."
          }
          renderRow={(deuda) => (
            <>
              <td style={tdStyle}>#{deuda.id}</td>

              <td style={tdStyle}>
                <strong>{deuda.cliente_nombre || `Cliente #${deuda.id_cliente}`}</strong>
                <div style={mutedSmallStyle}>ID #{deuda.id_cliente}</div>
              </td>

              <td style={tdStyle}>
                {deuda.origen_tipo || "-"}
                {deuda.origen_id ? ` #${deuda.origen_id}` : ""}
              </td>

              <td
                style={{
                  ...tdStyle,
                  fontWeight: 800,
                  color: Number(deuda.saldo_actual || 0) > 0 ? "#b42318" : "#067647",
                }}
              >
                {formatMoney(deuda.saldo_actual)}
              </td>

              <td style={tdStyle}>
                <EstadoDeudaBadge estado={deuda.estado} />
              </td>

              <td style={tdStyle}>
                {deuda.genera_recargo ? `${deuda.tasa_recargo || "-"}%` : "No"}
              </td>

              <td style={tdStyle}>{deuda.observacion || "-"}</td>

              <td style={tdStyle}>
                <Link
                  to={`/deudas/${deuda.id}`}
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

const mutedSmallStyle = {
  color: "#667085",
  fontSize: "13px",
  marginTop: "4px",
};
