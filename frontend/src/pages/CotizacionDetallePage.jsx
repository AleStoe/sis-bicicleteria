import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { listarVariantes } from "../services/catalogoService";
import { listarServiciosTaller } from "../services/serviciosTallerService";
import {
  agregarItemCotizacion,
  cambiarEstadoCotizacion,
  generarMensajeWhatsappCotizacion,
  obtenerCotizacion,
  quitarItemCotizacion,
} from "../services/cotizacionesService";
import { getCotizacionPdfUrl } from "../services/documentosService";
import { formatDate, formatMoney } from "../utils/formatters";
import { useBreakpoint } from "../components/ui";

const ESTADOS_ACCION = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
];

const itemInicial = {
  tipo_item: "producto",
  id_variante: "",
  id_servicio_taller: "",
  descripcion_snapshot: "",
  cantidad: "1",
  precio_unitario: "",
};

export default function CotizacionDetallePage() {
  const { cotizacionId } = useParams();
  const navigate = useNavigate();
  const isMobile = useBreakpoint();
  const { usuarioId } = useSession();
  const [cotizacion, setCotizacion] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [estadoNuevo, setEstadoNuevo] = useState("");
  const [itemForm, setItemForm] = useState(itemInicial);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarTodo();
  }, [cotizacionId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [cotizacionData, variantesData, serviciosData] = await Promise.all([
        obtenerCotizacion(cotizacionId),
        listarVariantes(),
        listarServiciosTaller(),
      ]);
      setCotizacion(cotizacionData);
      setEstadoNuevo(cotizacionData.estado);
      setVariantes((variantesData || []).filter((item) => item.activo !== false));
      setServicios((serviciosData || []).filter((item) => item.activo !== false));
    } catch (err) {
      setError(err.message || "No se pudo cargar la cotizacion");
    } finally {
      setLoading(false);
    }
  }

  async function refrescarCotizacion() {
    const data = await obtenerCotizacion(cotizacionId);
    setCotizacion(data);
    setEstadoNuevo(data.estado);
  }

  const puedeEditar = ["borrador", "enviada"].includes(cotizacion?.estado);

  const itemSeleccionado = useMemo(() => {
    if (itemForm.tipo_item === "producto") {
      return variantes.find((item) => String(item.id) === String(itemForm.id_variante));
    }
    if (itemForm.tipo_item === "servicio_taller") {
      return servicios.find((item) => String(item.id) === String(itemForm.id_servicio_taller));
    }
    return null;
  }, [itemForm, variantes, servicios]);

  function cambiarTipoItem(tipoItem) {
    setItemForm({ ...itemInicial, tipo_item: tipoItem });
  }

  function actualizarItem(campo, value) {
    setItemForm((prev) => ({ ...prev, [campo]: value }));
  }

  async function handleAgregarItem(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await agregarItemCotizacion(cotizacionId, normalizarItem(itemForm));
      setItemForm(itemInicial);
      await refrescarCotizacion();
      setMensaje("Item agregado");
    } catch (err) {
      setError(err.message || "No se pudo agregar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function handleQuitarItem(itemId) {
    if (!window.confirm("Quitar este item de la cotizacion?")) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await quitarItemCotizacion(cotizacionId, itemId);
      await refrescarCotizacion();
      setMensaje("Item quitado");
    } catch (err) {
      setError(err.message || "No se pudo quitar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function handleEstado(e) {
    e.preventDefault();
    if (!estadoNuevo || estadoNuevo === cotizacion.estado) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const data = await cambiarEstadoCotizacion(cotizacionId, {
        estado: estadoNuevo,
        id_usuario: Number(usuarioId || 1),
      });
      setCotizacion(data);
      setMensaje("Estado actualizado");
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    } finally {
      setGuardando(false);
    }
  }

  async function handleWhatsapp() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const data = await generarMensajeWhatsappCotizacion(cotizacionId);

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
        setMensaje("WhatsApp abierto");
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.mensaje);
        setMensaje("Sin telefono valido. Mensaje copiado al portapapeles.");
      } else {
        setMensaje(data.mensaje);
      }
    } catch (err) {
      setError(err.message || "No se pudo generar el WhatsApp");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <div style={styles.state}>Cargando cotizacion...</div>;
  if (!cotizacion) return <div style={styles.state}>No se encontro la cotizacion.</div>;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Cotizacion</p>
          <h1 style={styles.title}>{cotizacion.numero}</h1>
          <p style={styles.subtitle}>
            {cotizacion.tipo === "reparacion" ? "Reparacion" : "Bici / productos"} · {formatDate(cotizacion.fecha)}
          </p>
        </div>

        <div style={styles.heroActions}>
          <button type="button" onClick={() => navigate(-1)} style={styles.heroButton}><ArrowLeft size={17} /> Volver</button>
          <button type="button" onClick={cargarTodo} style={styles.heroButton}><RefreshCw size={17} /> Refrescar</button>
        </div>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <section style={{ ...styles.metricsGrid, ...(isMobile ? styles.metricsGridMobile : {}) }}>
        <Metric label="Estado" value={labelEstado(cotizacion.estado)} tone={cotizacion.estado === "aceptada" ? "ok" : "info"} />
        <Metric label="Cliente" value={cotizacion.cliente_nombre || cotizacion.cliente_nombre_snapshot || "Mostrador"} tone="muted" />
        <Metric label="Items" value={cotizacion.items.length} tone="muted" />
        <Metric label="Lista aplicada" value={labelTipoPrecio(cotizacion.tipo_precio)} tone="ok" />
        <Metric label="Subtotal" value={formatMoney(cotizacion.subtotal)} tone="muted" />
        <Metric label="Total" value={formatMoney(cotizacion.total_final)} tone="orange" />
      </section>

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={styles.mainColumn}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Detalle</p>
                <h2 style={styles.cardTitle}>{cotizacion.problema_reportado || "Cotizacion comercial"}</h2>
                {cotizacion.observaciones && <p style={styles.muted}>{cotizacion.observaciones}</p>}
              </div>
            </div>
          </section>

          <section style={styles.cardNoPadding}>
            <div style={styles.tableHeader}>
              <div>
                <p style={styles.eyebrow}>Items</p>
                <h2 style={styles.cardTitle}>Detalle cotizado</h2>
              </div>
            </div>

            {cotizacion.items.length === 0 ? (
              <div style={styles.empty}>Todavia no hay items cargados.</div>
            ) : (
              <div style={styles.itemsList}>
                {cotizacion.items.map((item) => (
                  <article key={item.id} style={styles.itemCard}>
                    <div>
                      <div style={styles.itemTitleLine}>
                        <span style={styles.typeBadge}>{labelTipoItem(item.tipo_item)}</span>
                        <strong>{item.descripcion_snapshot}</strong>
                      </div>
                      <p style={styles.muted}>
                        Cantidad {item.cantidad} · {formatMoney(item.precio_unitario)} c/u
                      </p>
                    </div>
                    <div style={styles.itemRight}>
                      <strong>{formatMoney(item.subtotal)}</strong>
                      {puedeEditar && (
                        <button type="button" onClick={() => handleQuitarItem(item.id)} disabled={guardando} style={styles.smallDanger}>
                          <Trash2 size={15} /> Quitar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside style={styles.sidePanel}>
          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Acciones</h2>
            <div style={styles.actionGrid}>
              <button type="button" onClick={handleWhatsapp} disabled={guardando} style={styles.primaryButton}>
                <MessageCircle size={17} /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => window.open(getCotizacionPdfUrl(cotizacion.id), "_blank", "noopener,noreferrer")}
                style={styles.secondaryButtonFull}
              >
                Ver PDF
              </button>
              <Link to="/cotizaciones" style={styles.secondaryLink}>Ver listado</Link>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Estado</h2>
            <form onSubmit={handleEstado} style={styles.form}>
              <label style={styles.field}>
                <span>Mover a</span>
                <select value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value)} style={styles.input}>
                  {ESTADOS_ACCION.map((estado) => (
                    <option key={estado.value} value={estado.value}>{estado.label}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={guardando || estadoNuevo === cotizacion.estado} style={styles.primaryButton}>
                Actualizar estado
              </button>
            </form>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Agregar item</h2>
            {!puedeEditar ? (
              <div style={styles.notice}>Solo se pueden editar cotizaciones en borrador o enviadas.</div>
            ) : (
              <form onSubmit={handleAgregarItem} style={styles.form}>
                <div style={styles.segmented}>
                  <button type="button" onClick={() => cambiarTipoItem("producto")} style={itemForm.tipo_item === "producto" ? styles.segmentActive : styles.segment}>Producto</button>
                  <button type="button" onClick={() => cambiarTipoItem("servicio_taller")} style={itemForm.tipo_item === "servicio_taller" ? styles.segmentActive : styles.segment}>Servicio</button>
                  <button type="button" onClick={() => cambiarTipoItem("linea_libre")} style={itemForm.tipo_item === "linea_libre" ? styles.segmentActive : styles.segment}>Libre</button>
                </div>

                {itemForm.tipo_item === "producto" && (
                  <label style={styles.field}>
                    <span>Producto</span>
                    <select value={itemForm.id_variante} onChange={(e) => actualizarItem("id_variante", e.target.value)} required style={styles.input}>
                      <option value="">Seleccionar...</option>
                      {variantes.map((variante) => (
                        <option key={variante.id} value={variante.id}>
                          {variante.producto_nombre} {variante.nombre_variante ? `- ${variante.nombre_variante}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {itemForm.tipo_item === "servicio_taller" && (
                  <label style={styles.field}>
                    <span>Servicio</span>
                    <select value={itemForm.id_servicio_taller} onChange={(e) => actualizarItem("id_servicio_taller", e.target.value)} required style={styles.input}>
                      <option value="">Seleccionar...</option>
                      {servicios.map((servicio) => (
                        <option key={servicio.id} value={servicio.id}>{servicio.nombre}</option>
                      ))}
                    </select>
                  </label>
                )}

                {itemForm.tipo_item === "linea_libre" && (
                  <label style={styles.field}>
                    <span>Descripcion</span>
                    <input value={itemForm.descripcion_snapshot} onChange={(e) => actualizarItem("descripcion_snapshot", e.target.value)} required style={styles.input} />
                  </label>
                )}

                <div style={styles.twoCols}>
                  <label style={styles.field}>
                    <span>Cantidad</span>
                    <input type="number" min="0.01" step="0.01" value={itemForm.cantidad} onChange={(e) => actualizarItem("cantidad", e.target.value)} required style={styles.input} />
                  </label>
                  <label style={styles.field}>
                    <span>Precio</span>
                    <input type="number" min="0" step="0.01" value={itemForm.precio_unitario} onChange={(e) => actualizarItem("precio_unitario", e.target.value)} placeholder="Auto" style={styles.input} />
                  </label>
                </div>

                {itemSeleccionado && (
                  <div style={styles.notice}>
                    Precio {labelTipoPrecio(cotizacion.tipo_precio).toLowerCase()}: {formatMoney(getPrecioItemSeleccionado(itemSeleccionado, itemForm.tipo_item, cotizacion.tipo_precio))}
                  </div>
                )}

                <button type="submit" disabled={guardando} style={styles.primaryButton}>
                  <Plus size={17} /> Agregar item
                </button>
              </form>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

function normalizarItem(item) {
  return {
    tipo_item: item.tipo_item,
    id_variante: item.id_variante ? Number(item.id_variante) : null,
    id_servicio_taller: item.id_servicio_taller ? Number(item.id_servicio_taller) : null,
    descripcion_snapshot: item.descripcion_snapshot || null,
    cantidad: item.cantidad || "1",
    precio_unitario: item.precio_unitario === "" ? null : item.precio_unitario,
  };
}

function getPrecioItemSeleccionado(item, tipoItem, tipoPrecio) {
  if (tipoItem === "producto") {
    if (tipoPrecio === "mayorista") return Number(item.precio_mayorista || 0);
    return Number(item.precio_minorista || 0);
  }

  return Number(item.precio_sugerido || 0);
}

function labelTipoPrecio(tipoPrecio) {
  return tipoPrecio === "mayorista" ? "Mayorista" : "Minorista";
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

function labelTipoItem(tipo) {
  if (tipo === "servicio_taller") return "Servicio";
  if (tipo === "linea_libre") return "Libre";
  return "Producto";
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  pageMobile: { padding: 10 },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 22, background: "#0f172a", color: "white", marginBottom: 16, boxShadow: "0 18px 40px rgba(15,23,42,.18)" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  heroButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 13, padding: "12px 14px", fontWeight: 1000, cursor: "pointer" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 },
  metricsGridMobile: { gridTemplateColumns: "1fr 1fr", gap: 8 },
  metric: { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, display: "grid", gap: 5, boxShadow: "0 10px 22px rgba(15,23,42,.06)" },
  metricTones: { ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }, info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }, muted: { color: "#475569", background: "#f8fafc" }, orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" } },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" },
  layoutMobile: { gridTemplateColumns: "1fr" },
  mainColumn: { display: "grid", gap: 16 },
  sidePanel: { display: "grid", gap: 16, position: "sticky", top: 16 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  cardNoPadding: { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  sectionHeader: { marginBottom: 4 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  cardTitle: { margin: "4px 0 0", fontSize: 22 },
  sideTitle: { margin: "0 0 12px", fontSize: 20 },
  muted: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  tableHeader: { padding: 18, borderBottom: "1px solid #e2e8f0" },
  itemsList: { display: "grid", gap: 10, padding: 16 },
  itemCard: { border: "1px solid #e2e8f0", borderRadius: 16, padding: 13, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  itemTitleLine: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  itemRight: { display: "grid", gap: 8, justifyItems: "end" },
  typeBadge: { background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000 },
  smallDanger: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  form: { display: "grid", gap: 12 },
  actionGrid: { display: "grid", gap: 10 },
  field: { display: "grid", gap: 6, fontWeight: 900, color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px", fontWeight: 750, boxSizing: "border-box", background: "white", color: "#0f172a" },
  segmented: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  segment: { border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 12, padding: "10px 8px", fontWeight: 1000, cursor: "pointer" },
  segmentActive: { border: "1px solid #f97316", background: "#fff7ed", color: "#c2410c", borderRadius: 12, padding: "10px 8px", fontWeight: 1000, cursor: "pointer" },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", textDecoration: "none" },
  secondaryButtonFull: { width: "100%", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  secondaryLink: { display: "block", textAlign: "center", textDecoration: "none", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000 },
  notice: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 13, padding: 12, fontWeight: 850 },
  empty: { padding: 22, color: "#64748b", fontWeight: 900 },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 850 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 850 },
  state: { padding: 24, fontWeight: 900 },
};
