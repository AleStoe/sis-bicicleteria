import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge, Button, Card, Input, PageHeader, Select, Table } from "../components/ui";
import { listarBicicletasCliente, listarClientes } from "../services/clientesService";
import { crearCasoPostventa, listarCasosPostventa } from "../services/postventaService";
import { formatDateTime } from "../utils/formatters";
import {
  labelPostventaEstado,
  labelPostventaPrioridad,
  labelPostventaTipo,
  POSTVENTA_ESTADOS,
  POSTVENTA_PRIORIDADES,
  POSTVENTA_TIPOS,
  variantPostventaEstado,
} from "../utils/postventa";
import { colors, radius, spacing } from "../theme";

const COLUMNS = [
  { key: "codigo", label: "Caso" },
  { key: "cliente", label: "Cliente" },
  { key: "tipo", label: "Tipo" },
  { key: "estado", label: "Estado" },
  { key: "prioridad", label: "Prioridad" },
  { key: "fecha", label: "Fecha" },
  { key: "acciones", label: "Acciones" },
];

const INITIAL_FORM = {
  tipo_caso: "reclamo_tecnico",
  prioridad: "normal",
  motivo_cliente: "",
  observaciones: "",
  id_venta_origen: "",
  id_bicicleta_cliente: "",
};

export default function PostventaPage() {
  const navigate = useNavigate();
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filtros, setFiltros] = useState({ estado: "", tipo_caso: "", q: "" });

  const [clienteQuery, setClienteQuery] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [bicicletas, setBicicletas] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    const timer = setTimeout(() => cargarCasos(), 250);
    return () => clearTimeout(timer);
  }, [filtros.estado, filtros.tipo_caso, filtros.q]);

  useEffect(() => {
    const timer = setTimeout(() => buscarClientes(clienteQuery), 250);
    return () => clearTimeout(timer);
  }, [clienteQuery]);

  useEffect(() => {
    if (!clienteSeleccionado?.id) {
      setBicicletas([]);
      setForm((prev) => ({ ...prev, id_bicicleta_cliente: "" }));
      return;
    }

    cargarBicicletasCliente(clienteSeleccionado.id);
  }, [clienteSeleccionado?.id]);

  async function cargarCasos() {
    try {
      setLoading(true);
      setError("");
      const data = await listarCasosPostventa({ ...filtros, limit: 100 });
      setCasos(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los casos de postventa");
    } finally {
      setLoading(false);
    }
  }

  async function buscarClientes(q = "") {
    try {
      const data = await listarClientes({ q: q.trim() || undefined, solo_activos: true });
      setClientes((data || []).slice(0, 8));
    } catch {
      setClientes([]);
    }
  }

  async function cargarBicicletasCliente(clienteId) {
    try {
      const data = await listarBicicletasCliente(clienteId);
      setBicicletas(data || []);
    } catch {
      setBicicletas([]);
    }
  }

  function seleccionarCliente(cliente) {
    setClienteSeleccionado(cliente);
    setClienteQuery(cliente.nombre || `Cliente #${cliente.id}`);
  }

  async function crearCaso(event) {
    event.preventDefault();

    if (!clienteSeleccionado?.id) {
      setError("Selecciona un cliente antes de crear el caso.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        tipo_caso: form.tipo_caso,
        prioridad: form.prioridad,
        id_cliente: Number(clienteSeleccionado.id),
        motivo_cliente: form.motivo_cliente.trim(),
        observaciones: form.observaciones.trim() || null,
        id_venta_origen: form.id_venta_origen ? Number(form.id_venta_origen) : null,
        id_bicicleta_cliente: form.id_bicicleta_cliente ? Number(form.id_bicicleta_cliente) : null,
      };

      const creado = await crearCasoPostventa(payload);
      setSuccess(`Caso ${creado.codigo || `#${creado.id}`} creado correctamente.`);
      setForm(INITIAL_FORM);
      setClienteSeleccionado(null);
      setClienteQuery("");
      await cargarCasos();
      navigate(`/postventa/${creado.id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear el caso de postventa");
    } finally {
      setSaving(false);
    }
  }

  const resumen = useMemo(() => {
    const abiertos = casos.filter((caso) => !["cerrado", "cancelado"].includes(caso.estado)).length;
    return { total: casos.length, abiertos };
  }, [casos]);

  return (
    <div>
      <PageHeader
        title="Postventa"
        subtitle="Casos de reclamos, garantias, coberturas y decisiones comerciales posteriores a una venta."
        actions={<Button variant="outline" onClick={cargarCasos} disabled={loading}>Refrescar</Button>}
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <section style={styles.metrics}>
        <Metric label="Casos listados" value={resumen.total} />
        <Metric label="Casos abiertos" value={resumen.abiertos} tone="warning" />
      </section>

      <section style={styles.layout}>
        <Card title="Crear caso" subtitle="Carga minima para iniciar trazabilidad de postventa.">
          <form onSubmit={crearCaso} style={styles.form}>
            <div style={styles.clientSearch}>
              <label style={styles.label}>Cliente</label>
              <div style={styles.searchBox}>
                <Search size={17} color={colors.textMuted} />
                <input
                  value={clienteQuery}
                  onChange={(event) => {
                    setClienteQuery(event.target.value);
                    setClienteSeleccionado(null);
                  }}
                  placeholder="Buscar cliente por nombre, DNI o telefono..."
                  style={styles.searchInput}
                />
              </div>

              {clienteQuery && !clienteSeleccionado ? (
                <div style={styles.results}>
                  {clientes.length === 0 ? (
                    <div style={styles.emptyInline}>Sin clientes para esa busqueda.</div>
                  ) : (
                    clientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => seleccionarCliente(cliente)}
                        style={styles.resultButton}
                      >
                        <strong>{cliente.nombre}</strong>
                        <span style={styles.mutedSmall}>
                          #{cliente.id}
                          {cliente.dni ? ` · DNI ${cliente.dni}` : ""}
                          {cliente.telefono ? ` · Tel. ${cliente.telefono}` : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div style={styles.formGrid}>
              <Select
                label="Tipo de caso"
                value={form.tipo_caso}
                onChange={(event) => setForm((prev) => ({ ...prev, tipo_caso: event.target.value }))}
              >
                {POSTVENTA_TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>{labelPostventaTipo(tipo)}</option>
                ))}
              </Select>

              <Select
                label="Prioridad"
                value={form.prioridad}
                onChange={(event) => setForm((prev) => ({ ...prev, prioridad: event.target.value }))}
              >
                {POSTVENTA_PRIORIDADES.map((prioridad) => (
                  <option key={prioridad} value={prioridad}>{labelPostventaPrioridad(prioridad)}</option>
                ))}
              </Select>

              <Input
                label="Venta origen opcional"
                type="number"
                min="1"
                value={form.id_venta_origen}
                onChange={(event) => setForm((prev) => ({ ...prev, id_venta_origen: event.target.value }))}
                placeholder="Ej: 154"
              />

              <Select
                label="Bicicleta del cliente"
                value={form.id_bicicleta_cliente}
                disabled={!clienteSeleccionado}
                onChange={(event) => setForm((prev) => ({ ...prev, id_bicicleta_cliente: event.target.value }))}
              >
                <option value="">
                  {clienteSeleccionado ? "Sin bicicleta asociada" : "Primero selecciona cliente"}
                </option>
                {bicicletas.map((bici) => (
                  <option key={bici.id} value={bici.id}>
                    {formatBicicleta(bici)}
                  </option>
                ))}
              </Select>
            </div>

            <Textarea
              label="Motivo informado por el cliente"
              required
              value={form.motivo_cliente}
              onChange={(event) => setForm((prev) => ({ ...prev, motivo_cliente: event.target.value }))}
              placeholder="Ej: la bicicleta hace ruido al pedalear desde la compra..."
            />

            <Textarea
              label="Observacion inicial"
              value={form.observaciones}
              onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
              placeholder="Detalle operativo opcional."
            />

            <Button type="submit" disabled={saving} fullWidth>
              {saving ? "Creando..." : "Crear caso"}
            </Button>
          </form>
        </Card>

        <Card
          title="Casos registrados"
          subtitle={loading ? "Cargando casos..." : `${casos.length} caso(s)`}
          actions={
            <div style={styles.filterActions}>
              <Select
                value={filtros.estado}
                onChange={(event) => setFiltros((prev) => ({ ...prev, estado: event.target.value }))}
                selectStyle={{ minWidth: 170 }}
              >
                <option value="">Todos los estados</option>
                {POSTVENTA_ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>{labelPostventaEstado(estado)}</option>
                ))}
              </Select>
              <Select
                value={filtros.tipo_caso}
                onChange={(event) => setFiltros((prev) => ({ ...prev, tipo_caso: event.target.value }))}
                selectStyle={{ minWidth: 170 }}
              >
                <option value="">Todos los tipos</option>
                {POSTVENTA_TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>{labelPostventaTipo(tipo)}</option>
                ))}
              </Select>
              <Input
                value={filtros.q}
                onChange={(event) => setFiltros((prev) => ({ ...prev, q: event.target.value }))}
                placeholder="Buscar cliente o codigo..."
                inputStyle={{ minWidth: 220 }}
              />
            </div>
          }
        >
          <Table
            columns={COLUMNS}
            data={loading ? [] : casos}
            emptyMessage={loading ? "Cargando casos..." : "No hay casos para los filtros seleccionados."}
            renderRow={(caso) => (
              <>
                <td style={styles.td}>
                  <strong>{caso.codigo || `#${caso.id}`}</strong>
                  <div style={styles.mutedSmall}>#{caso.id}</div>
                </td>
                <td style={styles.td}>
                  <strong>{caso.cliente_nombre || `Cliente #${caso.id_cliente}`}</strong>
                  {caso.bicicleta_cliente_descripcion ? (
                    <div style={styles.mutedSmall}>{caso.bicicleta_cliente_descripcion}</div>
                  ) : null}
                </td>
                <td style={styles.td}>{labelPostventaTipo(caso.tipo_caso)}</td>
                <td style={styles.td}>
                  <Badge variant={variantPostventaEstado(caso.estado)}>
                    {labelPostventaEstado(caso.estado)}
                  </Badge>
                </td>
                <td style={styles.td}>{labelPostventaPrioridad(caso.prioridad)}</td>
                <td style={styles.td}>{formatDateTime(caso.fecha_apertura)}</td>
                <td style={styles.td}>
                  <Link to={`/postventa/${caso.id}`} style={styles.linkAction}>Abrir</Link>
                </td>
              </>
            )}
          />
        </Card>
      </section>
    </div>
  );
}

function Textarea({ label, style = {}, ...props }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800, color: colors.text, ...style }}>
      <span>{label}</span>
      <textarea style={styles.textarea} {...props} />
    </label>
  );
}

function Alert({ children, tone = "danger" }) {
  const isDanger = tone === "danger";
  return (
    <div style={{
      ...styles.alert,
      background: isDanger ? colors.dangerSoft : colors.successSoft,
      color: isDanger ? colors.dangerDark : colors.successDark,
      borderColor: isDanger ? "#f4c7c3" : "#abefc6",
    }}>
      {children}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(tone === "warning" ? styles.metricWarning : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBicicleta(bici) {
  return (
    bici.descripcion ||
    bici.nombre ||
    bici.modelo ||
    bici.producto_nombre ||
    `Bicicleta #${bici.id}`
  );
}

const styles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
    gap: spacing.lg,
    alignItems: "start",
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metric: {
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
    display: "grid",
    gap: 6,
    fontWeight: 900,
  },
  metricWarning: {
    background: colors.warningSoft,
    color: colors.warningDark,
    borderColor: "#fbbf24",
  },
  form: { display: "grid", gap: spacing.md },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: spacing.md,
  },
  label: { fontSize: 13, fontWeight: 800, color: colors.text },
  clientSearch: { display: "grid", gap: 6, position: "relative" },
  searchBox: {
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "0 12px",
    background: colors.surface,
  },
  searchInput: {
    border: 0,
    outline: 0,
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: 700,
  },
  results: {
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.md,
    overflow: "hidden",
    background: colors.surface,
  },
  resultButton: {
    width: "100%",
    border: 0,
    borderBottom: `1px solid ${colors.borderSoft}`,
    background: colors.surface,
    padding: 10,
    textAlign: "left",
    display: "grid",
    gap: 3,
    cursor: "pointer",
  },
  emptyInline: {
    padding: 10,
    color: colors.textMuted,
    fontWeight: 700,
  },
  textarea: {
    width: "100%",
    minHeight: 84,
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: "Arial, sans-serif",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
  },
  filterActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "end",
  },
  td: {
    padding: "12px 16px",
    verticalAlign: "top",
  },
  mutedSmall: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  linkAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    padding: "0 12px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    color: colors.secondary,
    background: colors.surface,
    textDecoration: "none",
    fontWeight: 900,
  },
  alert: {
    border: "1px solid",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    fontWeight: 800,
  },
};
