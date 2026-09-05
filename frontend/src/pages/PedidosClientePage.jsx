import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, RefreshCcw, Search } from "lucide-react";
import { listarClientes } from "../services/clientesService";
import {
  crearPedidoCliente,
  listarPedidosCliente,
} from "../services/pedidosClienteService";
import { useSession } from "../context/SessionContext";
import { useToast } from "../hooks/useToast";
import { Button, Card, PageHeader } from "../components/ui";
import { colors, radius, shadows, spacing, typography } from "../theme";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clienteLabel(cliente) {
  if (!cliente) return "";
  return [cliente.nombre, cliente.dni ? `DNI ${cliente.dni}` : "", cliente.telefono]
    .filter(Boolean)
    .join(" · ");
}

export default function PedidosClientePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { sucursalId, usuarioId } = useSession();
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estado, setEstado] = useState("borrador");
  const [query, setQuery] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [tipoPrecio, setTipoPrecio] = useState("mayorista");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [creando, setCreando] = useState(false);

  const clienteSeleccionado = useMemo(
    () => clientes.find((cliente) => Number(cliente.id) === Number(clienteId)),
    [clientes, clienteId]
  );

  useEffect(() => {
    cargarPedidos();
  }, [estado]);

  useEffect(() => {
    const handle = setTimeout(() => cargarClientes(clienteQuery), 250);
    return () => clearTimeout(handle);
  }, [clienteQuery]);

  async function cargarPedidos() {
    try {
      setLoading(true);
      const data = await listarPedidosCliente({
        estado: estado === "todos" ? undefined : estado,
        q: query.trim() || undefined,
        limit: 120,
      });
      setPedidos(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }

  async function cargarClientes(texto = "") {
    try {
      const data = await listarClientes({
        q: texto.trim() || undefined,
        solo_activos: true,
      });
      setClientes(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      setClientes([]);
    }
  }

  async function handleCrearPedido(event) {
    event.preventDefault();
    if (!clienteId) {
      toast.error("Elegí un cliente para iniciar el pedido");
      return;
    }

    try {
      setCreando(true);
      const pedido = await crearPedidoCliente({
        id_cliente: Number(clienteId),
        id_sucursal: Number(sucursalId),
        tipo_precio: tipoPrecio,
        observaciones: observaciones.trim() || null,
        id_usuario: usuarioId,
      });
      toast.success("Pedido creado");
      navigate(`/pedidos-cliente/${pedido.id}`);
    } catch (err) {
      toast.error(err.message || "No se pudo crear el pedido");
    } finally {
      setCreando(false);
    }
  }

  function seleccionarCliente(cliente) {
    setClienteId(String(cliente.id));
    setClienteQuery(clienteLabel(cliente));
    setTipoPrecio(cliente.tipo_cliente === "mayorista" ? "mayorista" : "minorista");
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Pedidos de cliente"
        subtitle="Guardá pedidos abiertos y pasalos a checkout cuando el cliente confirme."
        eyebrow="Mostrador / mayorista"
        actions={
          <Button type="button" variant="outline" onClick={cargarPedidos}>
            <RefreshCcw size={16} /> Refrescar
          </Button>
        }
      />

      <section style={styles.layout}>
        <Card style={styles.createCard}>
          <form onSubmit={handleCrearPedido} style={styles.form}>
            <div>
              <div style={styles.kicker}>Nuevo pedido</div>
              <h2 style={styles.cardTitle}>Preparar pedido</h2>
              <p style={styles.muted}>
                Armalo ahora, sumale cosas después y cuando esté listo lo mandás a checkout.
              </p>
            </div>

            <label style={styles.field}>
              Cliente
              <input
                type="search"
                value={clienteQuery}
                onChange={(event) => {
                  setClienteQuery(event.target.value);
                  setClienteId("");
                }}
                placeholder="Buscar por nombre, DNI o teléfono..."
                style={styles.input}
              />
            </label>

            {clienteQuery && !clienteId && (
              <div style={styles.clientResults}>
                {clientes.length ? (
                  clientes.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => seleccionarCliente(cliente)}
                      style={styles.clientButton}
                    >
                      <strong>{cliente.nombre}</strong>
                      <span>
                        #{cliente.id}
                        {cliente.dni ? ` · DNI ${cliente.dni}` : ""}
                        {cliente.telefono ? ` · ${cliente.telefono}` : ""}
                      </span>
                    </button>
                  ))
                ) : (
                  <div style={styles.emptySmall}>Sin clientes para esa búsqueda.</div>
                )}
              </div>
            )}

            {clienteSeleccionado && (
              <div style={styles.selectedClient}>
                <strong>{clienteSeleccionado.nombre}</strong>
                <span>{clienteLabel(clienteSeleccionado)}</span>
              </div>
            )}

            <div style={styles.twoCols}>
              <label style={styles.field}>
                Lista
                <select
                  value={tipoPrecio}
                  onChange={(event) => setTipoPrecio(event.target.value)}
                  style={styles.input}
                >
                  <option value="minorista">Minorista</option>
                  <option value="mayorista">Mayorista</option>
                </select>
              </label>
              <label style={styles.field}>
                Observación
                <input
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  placeholder="Ej: retirar mañana, sumar si entra algo..."
                  style={styles.input}
                />
              </label>
            </div>

            <button type="submit" disabled={creando} style={styles.primaryButton}>
              <Plus size={18} />
              {creando ? "Creando..." : "Crear pedido"}
            </button>
          </form>
        </Card>

        <Card style={styles.listCard}>
          <div style={styles.filters}>
            <label style={styles.searchBox}>
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") cargarPedidos();
                }}
                placeholder="Buscar cliente o número de pedido..."
                style={styles.searchInput}
              />
            </label>
            <select
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              style={styles.filterSelect}
            >
              <option value="borrador">Borradores</option>
              <option value="convertido_a_venta">Convertidos</option>
              <option value="cancelado">Cancelados</option>
              <option value="todos">Todos</option>
            </select>
            <Button type="button" variant="outline" onClick={cargarPedidos}>
              Buscar
            </Button>
          </div>

          <div style={styles.listHeader}>
            <div>
              <div style={styles.kicker}>Listado</div>
              <h2 style={styles.cardTitle}>Pedidos guardados</h2>
            </div>
            <span style={styles.countPill}>{loading ? "..." : pedidos.length}</span>
          </div>

          <div style={styles.table}>
            {pedidos.length === 0 ? (
              <div style={styles.emptyState}>
                <ClipboardList size={32} />
                <strong>No hay pedidos para mostrar.</strong>
                <span>Creá uno desde el panel de la izquierda.</span>
              </div>
            ) : (
              pedidos.map((pedido) => (
                <button
                  key={pedido.id}
                  type="button"
                  onClick={() => navigate(`/pedidos-cliente/${pedido.id}`)}
                  style={styles.row}
                >
                  <span style={styles.rowMain}>
                    <strong>Pedido #{pedido.id}</strong>
                    <small>{formatDate(pedido.fecha_creacion)}</small>
                  </span>
                  <span style={styles.rowClient}>
                    <strong>{pedido.cliente_nombre}</strong>
                    <small>{pedido.tipo_precio === "mayorista" ? "Lista mayorista" : "Lista minorista"}</small>
                  </span>
                  <span style={styles.rowMetric}>
                    <strong>{pedido.total_items} ítem(s)</strong>
                    <small>{Number(pedido.cantidad_total || 0).toLocaleString("es-AR")} unidad(es)</small>
                  </span>
                  <span style={styles.money}>{formatMoney(pedido.total_estimado)}</span>
                  <span style={styles.estadoPill}>{pedido.estado.replaceAll("_", " ")}</span>
                </button>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "grid", gap: spacing.lg },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
    gap: spacing.lg,
    alignItems: "start",
  },
  createCard: { padding: 18 },
  listCard: { padding: 18, display: "grid", gap: 14 },
  form: { display: "grid", gap: 14 },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  cardTitle: { margin: "2px 0 0", fontSize: 22, fontWeight: 900, color: colors.text },
  muted: { margin: "4px 0 0", color: colors.textMuted, lineHeight: 1.4 },
  field: { display: "grid", gap: 6, fontWeight: 800, color: colors.text },
  input: {
    minHeight: 42,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "0 12px",
    fontWeight: 700,
    background: "white",
  },
  twoCols: { display: "grid", gridTemplateColumns: "150px 1fr", gap: 10 },
  primaryButton: {
    minHeight: 46,
    border: 0,
    borderRadius: radius.md,
    background: colors.primary,
    color: "white",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: shadows.sm,
  },
  clientResults: {
    display: "grid",
    gap: 6,
    maxHeight: 230,
    overflow: "auto",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 6,
  },
  clientButton: {
    border: 0,
    borderRadius: radius.sm,
    background: colors.surfaceAlt,
    padding: 10,
    textAlign: "left",
    display: "grid",
    gap: 3,
    cursor: "pointer",
  },
  selectedClient: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    borderRadius: radius.md,
    padding: 12,
    display: "grid",
    gap: 3,
    color: "#166534",
  },
  emptySmall: { padding: 12, color: colors.textMuted, fontWeight: 700 },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 180px auto",
    gap: 10,
    alignItems: "center",
  },
  searchBox: {
    minHeight: 42,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
    background: "white",
  },
  searchInput: { border: 0, outline: 0, flex: 1, fontWeight: 700 },
  filterSelect: {
    minHeight: 42,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "0 12px",
    fontWeight: 800,
  },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  countPill: {
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    padding: "8px 12px",
    fontWeight: 900,
  },
  table: { display: "grid", border: `1px solid ${colors.border}`, borderRadius: radius.lg, overflow: "hidden" },
  row: {
    border: 0,
    borderBottom: `1px solid ${colors.border}`,
    background: "white",
    padding: "14px 16px",
    display: "grid",
    gridTemplateColumns: "140px minmax(220px, 1fr) 150px 140px 140px",
    gap: 18,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
  },
  rowMain: { display: "grid", gap: 4, minWidth: 0 },
  rowClient: { display: "grid", gap: 4, minWidth: 0 },
  rowMetric: { display: "grid", gap: 4, minWidth: 0 },
  money: { fontWeight: 900, color: colors.text, fontSize: 17, textAlign: "right" },
  estadoPill: {
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    padding: "8px 12px",
    fontWeight: 900,
    textAlign: "center",
    textTransform: "capitalize",
  },
  emptyState: {
    minHeight: 240,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 8,
    color: colors.textMuted,
  },
};
