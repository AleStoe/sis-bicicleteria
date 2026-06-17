import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Plus, RefreshCw, Search } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { listarClientes } from "../services/clientesService";
import { listarVariantes } from "../services/catalogoService";
import { listarServiciosTaller } from "../services/serviciosTallerService";
import { crearCotizacion, listarCotizaciones } from "../services/cotizacionesService";
import { normalizeTextUpper } from "../utils/textNormalization";
import { formatDate, formatMoney } from "../utils/formatters";
import { useBreakpoint } from "../components/ui";

const ESTADOS = [
  { value: "", label: "Todas" },
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviadas" },
  { value: "aceptada", label: "Aceptadas" },
  { value: "rechazada", label: "Rechazadas" },
  { value: "vencida", label: "Vencidas" },
  { value: "cancelada", label: "Canceladas" },
];

const itemInicial = {
  tipo_item: "producto",
  id_variante: "",
  id_servicio_taller: "",
  descripcion_snapshot: "",
  cantidad: "1",
  precio_unitario: "",
};

export default function CotizacionesListPage() {
  const navigate = useNavigate();
  const isMobile = useBreakpoint();
  const { usuarioId, sucursalId } = useSession();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tipo: "venta",
    id_cliente: "",
    cliente_nombre_snapshot: "",
    cliente_telefono_snapshot: "",
    problema_reportado: "",
    observaciones: "",
    item: itemInicial,
  });

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    cargarCotizaciones();
  }, [estadoFiltro]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [cotizacionesData, clientesData, variantesData, serviciosData] = await Promise.all([
        listarCotizaciones(),
        listarClientes({ solo_activos: true }),
        listarVariantes(),
        listarServiciosTaller(),
      ]);

      setCotizaciones(cotizacionesData || []);
      setClientes(clientesData || []);
      setVariantes((variantesData || []).filter((item) => item.activo !== false));
      setServicios((serviciosData || []).filter((item) => item.activo !== false));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las cotizaciones");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCotizaciones() {
    try {
      const data = await listarCotizaciones({ estado: estadoFiltro || undefined });
      setCotizaciones(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron actualizar las cotizaciones");
    }
  }

  const cotizacionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cotizaciones;

    return cotizaciones.filter((cotizacion) =>
      [
        cotizacion.numero,
        cotizacion.tipo,
        cotizacion.estado,
        cotizacion.cliente_nombre,
        cotizacion.cliente_nombre_snapshot,
        cotizacion.problema_reportado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [cotizaciones, busqueda]);

  function actualizarItem(campo, value) {
    setForm((prev) => ({
      ...prev,
      item: {
        ...prev.item,
        [campo]: value,
      },
    }));
  }

  function seleccionarCliente(clienteId) {
    const cliente = clientes.find((item) => String(item.id) === String(clienteId));
    setForm((prev) => ({
      ...prev,
      id_cliente: clienteId,
      cliente_nombre_snapshot: cliente ? cliente.nombre : prev.cliente_nombre_snapshot,
      cliente_telefono_snapshot: cliente?.telefono || prev.cliente_telefono_snapshot,
    }));
  }

  function cambiarTipoItem(tipoItem) {
    setForm((prev) => ({
      ...prev,
      item: {
        ...itemInicial,
        tipo_item: tipoItem,
      },
    }));
  }

  async function handleCrear(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");

    try {
      const item = normalizarItem(form.item);
      const payload = {
        tipo: form.tipo,
        id_sucursal: Number(sucursalId || 1),
        id_usuario_creador: Number(usuarioId || 1),
        id_cliente: form.id_cliente ? Number(form.id_cliente) : null,
        cliente_nombre_snapshot: form.cliente_nombre_snapshot || null,
        cliente_telefono_snapshot: form.cliente_telefono_snapshot || null,
        problema_reportado: form.tipo === "reparacion" ? form.problema_reportado : null,
        observaciones: form.observaciones || null,
        items: item ? [item] : [],
      };

      const creada = await crearCotizacion(payload);
      navigate(`/cotizaciones/${creada.id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear la cotizacion");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <div style={styles.state}>Cargando cotizaciones...</div>;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Mostrador / taller</p>
          <h1 style={styles.title}>Cotizaciones</h1>
          <p style={styles.subtitle}>Presupuestos previos sin mover stock, caja ni deuda.</p>
        </div>

        <button type="button" onClick={cargarTodo} style={styles.heroButton}>
          <RefreshCw size={17} /> Refrescar
        </button>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Nueva cotizacion</h2>
              <p style={styles.panelSubtitle}>Creala y despues enviala por WhatsApp desde el detalle.</p>
            </div>
          </div>

          <form onSubmit={handleCrear} style={styles.form}>
            <div style={styles.segmented}>
              <button type="button" onClick={() => setForm((p) => ({ ...p, tipo: "venta" }))} style={form.tipo === "venta" ? styles.segmentActive : styles.segment}>
                Bici / productos
              </button>
              <button type="button" onClick={() => setForm((p) => ({ ...p, tipo: "reparacion" }))} style={form.tipo === "reparacion" ? styles.segmentActive : styles.segment}>
                Reparacion
              </button>
            </div>

            <label style={styles.field}>
              <span>Cliente</span>
              <select value={form.id_cliente} onChange={(e) => seleccionarCliente(e.target.value)} style={styles.input}>
                <option value="">Cliente mostrador / sin registrar</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                ))}
              </select>
            </label>

            {!form.id_cliente && (
              <div style={styles.twoCols}>
                <label style={styles.field}>
                  <span>Nombre</span>
                  <input value={form.cliente_nombre_snapshot} onChange={(e) => setForm((p) => ({ ...p, cliente_nombre_snapshot: normalizeTextUpper(e.target.value) }))} style={styles.input} />
                </label>
                <label style={styles.field}>
                  <span>Telefono</span>
                  <input value={form.cliente_telefono_snapshot} onChange={(e) => setForm((p) => ({ ...p, cliente_telefono_snapshot: e.target.value }))} style={styles.input} />
                </label>
              </div>
            )}

            {form.tipo === "reparacion" && (
              <label style={styles.field}>
                <span>Consulta / problema</span>
                <textarea value={form.problema_reportado} onChange={(e) => setForm((p) => ({ ...p, problema_reportado: normalizeTextUpper(e.target.value) }))} style={styles.textarea} required />
              </label>
            )}

            <div style={styles.itemBox}>
              <div style={styles.itemHeader}>
                <strong>Primer item</strong>
                <select value={form.item.tipo_item} onChange={(e) => cambiarTipoItem(e.target.value)} style={styles.compactSelect}>
                  <option value="producto">Producto</option>
                  <option value="servicio_taller">Servicio taller</option>
                  <option value="linea_libre">Linea libre</option>
                </select>
              </div>

              {form.item.tipo_item === "producto" && (
                <label style={styles.field}>
                  <span>Producto / variante</span>
                  <select value={form.item.id_variante} onChange={(e) => actualizarItem("id_variante", e.target.value)} style={styles.input}>
                    <option value="">Sin item inicial</option>
                    {variantes.map((variante) => (
                      <option key={variante.id} value={variante.id}>
                        {variante.producto_nombre} {variante.nombre_variante ? `- ${variante.nombre_variante}` : ""} ({formatMoney(variante.precio_minorista)})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.item.tipo_item === "servicio_taller" && (
                <label style={styles.field}>
                  <span>Servicio</span>
                  <select value={form.item.id_servicio_taller} onChange={(e) => actualizarItem("id_servicio_taller", e.target.value)} style={styles.input}>
                    <option value="">Sin item inicial</option>
                    {servicios.map((servicio) => (
                      <option key={servicio.id} value={servicio.id}>
                        {servicio.nombre} ({formatMoney(servicio.precio_sugerido)})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.item.tipo_item === "linea_libre" && (
                <label style={styles.field}>
                  <span>Descripcion</span>
                  <input value={form.item.descripcion_snapshot} onChange={(e) => actualizarItem("descripcion_snapshot", e.target.value)} style={styles.input} />
                </label>
              )}

              <div style={styles.twoCols}>
                <label style={styles.field}>
                  <span>Cantidad</span>
                  <input type="number" min="0.01" step="0.01" value={form.item.cantidad} onChange={(e) => actualizarItem("cantidad", e.target.value)} style={styles.input} />
                </label>
                <label style={styles.field}>
                  <span>Precio manual</span>
                  <input type="number" min="0" step="0.01" value={form.item.precio_unitario} onChange={(e) => actualizarItem("precio_unitario", e.target.value)} placeholder="Opcional" style={styles.input} />
                </label>
              </div>
            </div>

            <label style={styles.field}>
              <span>Observaciones</span>
              <textarea value={form.observaciones} onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))} style={styles.textarea} />
            </label>

            <button type="submit" disabled={guardando} style={styles.primaryButton}>
              <Plus size={17} /> {guardando ? "Creando..." : "Crear cotizacion"}
            </button>
          </form>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Listado</h2>
              <p style={styles.panelSubtitle}>{cotizacionesFiltradas.length} resultado(s)</p>
            </div>
          </div>

          <div style={styles.filters}>
            <div style={styles.searchBox}>
              <Search size={17} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar numero, cliente o problema..." style={styles.searchInput} />
            </div>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={styles.input}>
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>{estado.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.list}>
            {cotizacionesFiltradas.length === 0 ? (
              <div style={styles.empty}>No hay cotizaciones para mostrar.</div>
            ) : (
              cotizacionesFiltradas.map((cotizacion) => (
                <CotizacionCard key={cotizacion.id} cotizacion={cotizacion} />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CotizacionCard({ cotizacion }) {
  return (
    <article style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <div style={styles.numberRow}>
            <FileText size={16} />
            <strong>{cotizacion.numero}</strong>
            <span style={badgeTipo(cotizacion.tipo)}>{cotizacion.tipo === "reparacion" ? "Reparacion" : "Venta"}</span>
          </div>
          <p style={styles.cardTitle}>{cotizacion.cliente_nombre || cotizacion.cliente_nombre_snapshot || "Cliente mostrador"}</p>
          {cotizacion.problema_reportado && <p style={styles.muted}>{cotizacion.problema_reportado}</p>}
        </div>
        <span style={badgeEstado(cotizacion.estado)}>{labelEstado(cotizacion.estado)}</span>
      </div>

      <div style={styles.metaGrid}>
        <Info label="Fecha" value={formatDate(cotizacion.fecha)} />
        <Info label="Items" value={cotizacion.items_count} />
        <Info label="Total" value={formatMoney(cotizacion.total_final)} />
      </div>

      <Link to={`/cotizaciones/${cotizacion.id}`} style={styles.detailButton}>Abrir</Link>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function normalizarItem(item) {
  if (item.tipo_item === "producto" && !item.id_variante) return null;
  if (item.tipo_item === "servicio_taller" && !item.id_servicio_taller) return null;
  if (item.tipo_item === "linea_libre" && !item.descripcion_snapshot.trim()) return null;

  return {
    tipo_item: item.tipo_item,
    id_variante: item.id_variante ? Number(item.id_variante) : null,
    id_servicio_taller: item.id_servicio_taller ? Number(item.id_servicio_taller) : null,
    descripcion_snapshot: item.descripcion_snapshot || null,
    cantidad: item.cantidad || "1",
    precio_unitario: item.precio_unitario === "" ? null : item.precio_unitario,
  };
}

function labelEstado(estado) {
  const labels = {
    borrador: "Borrador",
    enviada: "Enviada",
    aceptada: "Aceptada",
    convertida: "Convertida",
    rechazada: "Rechazada",
    vencida: "Vencida",
    cancelada: "Cancelada",
  };
  return labels[estado] || estado;
}

function badgeEstado(estado) {
  const tones = {
    borrador: ["#475569", "#f8fafc", "#e2e8f0"],
    enviada: ["#1d4ed8", "#eff6ff", "#bfdbfe"],
    aceptada: ["#047857", "#ecfdf5", "#bbf7d0"],
    convertida: ["#166534", "#dcfce7", "#bbf7d0"],
    rechazada: ["#991b1b", "#fee2e2", "#fecaca"],
    vencida: ["#92400e", "#fef3c7", "#fde68a"],
    cancelada: ["#64748b", "#f1f5f9", "#e2e8f0"],
  };
  const [color, background, border] = tones[estado] || tones.borrador;
  return { ...styles.badge, color, background, border: `1px solid ${border}` };
}

function badgeTipo(tipo) {
  return {
    ...styles.badge,
    color: tipo === "reparacion" ? "#c2410c" : "#1d4ed8",
    background: tipo === "reparacion" ? "#fff7ed" : "#eff6ff",
    border: `1px solid ${tipo === "reparacion" ? "#fed7aa" : "#bfdbfe"}`,
  };
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  pageMobile: { padding: 10 },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 22, background: "#0f172a", color: "white", marginBottom: 16, boxShadow: "0 18px 40px rgba(15,23,42,.18)" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 13, padding: "12px 14px", fontWeight: 1000, cursor: "pointer" },
  layout: { display: "grid", gridTemplateColumns: "420px minmax(0, 1fr)", gap: 16, alignItems: "start" },
  layoutMobile: { gridTemplateColumns: "1fr" },
  panel: { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  panelHeader: { padding: 16, borderBottom: "1px solid #e2e8f0" },
  panelTitle: { margin: 0, fontSize: 22 },
  panelSubtitle: { margin: "4px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13 },
  form: { display: "grid", gap: 12, padding: 16 },
  segmented: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  segment: { border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 12, padding: "11px 12px", fontWeight: 1000, cursor: "pointer" },
  segmentActive: { border: "1px solid #f97316", background: "#fff7ed", color: "#c2410c", borderRadius: 12, padding: "11px 12px", fontWeight: 1000, cursor: "pointer" },
  field: { display: "grid", gap: 6, fontWeight: 900, color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px", fontWeight: 750, boxSizing: "border-box", background: "white", color: "#0f172a" },
  compactSelect: { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 10px", fontWeight: 900, background: "white" },
  textarea: { width: "100%", minHeight: 76, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px", fontWeight: 700, resize: "vertical", boxSizing: "border-box" },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  itemBox: { display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, background: "#f8fafc" },
  itemHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  filters: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px", gap: 10, padding: 16, borderBottom: "1px solid #e2e8f0" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 12, padding: "0 11px", background: "#f8fafc" },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", padding: "12px 0", fontWeight: 750, minWidth: 0 },
  list: { display: "grid", gap: 10, padding: 16 },
  card: { border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, display: "grid", gap: 12, background: "white" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  numberRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#0f172a" },
  cardTitle: { margin: "6px 0 0", fontWeight: 1000, fontSize: 17 },
  muted: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 },
  info: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, display: "grid", gap: 3, color: "#64748b" },
  detailButton: { textDecoration: "none", textAlign: "center", background: "#0f172a", color: "white", borderRadius: 12, padding: "10px 12px", fontWeight: 1000 },
  badge: { display: "inline-flex", alignItems: "center", width: "fit-content", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000 },
  empty: { padding: 18, color: "#64748b", fontWeight: 900 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 850 },
  state: { padding: 24, fontWeight: 900 },
};
