import { useEffect, useMemo, useState } from "react";
import {
  activarServicioTaller,
  crearServicioTaller,
  desactivarServicioTaller,
  editarServicioTaller,
  listarServiciosTaller,
} from "../services/serviciosTallerService";
import { formatMoney } from "../utils/formatters";
import useMediaQuery from "../hooks/useMediaQuery";
import { normalizeTextUpper } from "../utils/textNormalization";
import CalculadoraPrecioPagoPreview from "../components/precios/CalculadoraPrecioPagoPreview";
import { obtenerConfiguracionNegocio } from "../services/configuracionNegocioService";
import { DEFAULT_CONFIGURACION_NEGOCIO } from "../config/defaultConfiguracionNegocio";
import ServicePlaceholder from "../components/servicios/ServicePlaceholder";

const FORM_INICIAL = {
  nombre: "",
  descripcion: "",
  precio_sugerido: "",
  duracion_estimada_min: "",
  activo: true,
};

export default function ServiciosPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const [servicios, setServicios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [configuracionNegocio, setConfiguracionNegocio] = useState(DEFAULT_CONFIGURACION_NEGOCIO);
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarServicios();
  }, [incluirInactivos]);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  async function cargarConfiguracion() {
    try {
      const data = await obtenerConfiguracionNegocio();
      setConfiguracionNegocio({
        ...DEFAULT_CONFIGURACION_NEGOCIO,
        ...(data || {}),
      });
    } catch {
      setConfiguracionNegocio(DEFAULT_CONFIGURACION_NEGOCIO);
    }
  }

  async function cargarServicios() {
    try {
      setCargando(true);
      setError("");
      const data = await listarServiciosTaller({ incluir_inactivos: incluirInactivos });
      setServicios(data || []);
    } catch (err) {
      setError(err.message || "Error al cargar servicios de taller");
    } finally {
      setCargando(false);
    }
  }

  const serviciosFiltrados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return servicios;

    return servicios.filter((servicio) =>
      normalizar([servicio.nombre, servicio.descripcion].filter(Boolean).join(" ")).includes(q)
    );
  }, [servicios, busqueda]);

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: campo === "nombre" ? normalizeTextUpper(valor) : valor,
    }));
  }

  function editar(servicio) {
    setEditandoId(servicio.id);
    setForm({
      nombre: servicio.nombre || "",
      descripcion: servicio.descripcion || "",
      precio_sugerido: servicio.precio_sugerido != null ? String(servicio.precio_sugerido) : "",
      duracion_estimada_min:
        servicio.duracion_estimada_min != null ? String(servicio.duracion_estimada_min) : "",
      activo: Boolean(servicio.activo),
    });
    setMensaje("");
    setError("");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function guardarServicio(e) {
    e.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre del servicio es obligatorio");
      return;
    }

    if (Number(form.precio_sugerido) < 0 || form.precio_sugerido === "") {
      setError("El precio sugerido debe ser cero o mayor");
      return;
    }

    const duracion = form.duracion_estimada_min === "" ? null : Number(form.duracion_estimada_min);
    if (duracion !== null && duracion <= 0) {
      setError("La duración debe ser mayor a cero o quedar vacía");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio_sugerido: Number(form.precio_sugerido),
      duracion_estimada_min: duracion,
    };

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (editandoId) {
        await editarServicioTaller(editandoId, {
          ...payload,
          activo: Boolean(form.activo),
        });
        setMensaje("Servicio actualizado correctamente");
      } else {
        await crearServicioTaller(payload);
        setMensaje("Servicio creado correctamente");
      }

      cancelarEdicion();
      await cargarServicios();
    } catch (err) {
      setError(err.message || "No se pudo guardar el servicio");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(servicio, activo) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (activo) {
        await activarServicioTaller(servicio.id);
        setMensaje("Servicio activado correctamente");
      } else {
        await desactivarServicioTaller(servicio.id);
        setMensaje("Servicio desactivado correctamente");
      }

      await cargarServicios();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado del servicio");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Taller</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Servicios Taller</h1>
          <p style={styles.subtitle}>
            Mano de obra separada del catálogo: sin stock, sin proveedor y sin variantes.
          </p>
        </div>
        <button type="button" onClick={cargarServicios} disabled={cargando} style={{ ...styles.secondaryHeroButton, ...(isMobile ? styles.fullWidth : {}) }}>
          {cargando ? "Cargando..." : "↻ Actualizar"}
        </button>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      <main style={isNarrow ? styles.layoutMobile : styles.layout}>
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>{editandoId ? "Editar" : "Nuevo"}</p>
              <h2 style={styles.cardTitle}>{editandoId ? `Servicio #${editandoId}` : "Crear servicio"}</h2>
            </div>
            {editandoId && (
              <button type="button" onClick={cancelarEdicion} style={styles.smallSecondary}>
                Cancelar edición
              </button>
            )}
          </div>

          <form onSubmit={guardarServicio} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Nombre *</span>
              <input
                value={form.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                placeholder="Ej: Service completo"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Descripción</span>
              <textarea
                value={form.descripcion}
                onChange={(e) => actualizarCampo("descripcion", e.target.value)}
                placeholder="Qué incluye, alcance del trabajo, observaciones..."
                rows={4}
                style={styles.textarea}
              />
            </label>

            <div style={isMobile ? styles.formRowMobile : styles.formRow}>
              <label style={styles.field}>
                <span style={styles.label}>Precio sugerido *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_sugerido}
                  onChange={(e) => actualizarCampo("precio_sugerido", e.target.value)}
                  placeholder="15000"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Duración estimada</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.duracion_estimada_min}
                  onChange={(e) => actualizarCampo("duracion_estimada_min", e.target.value)}
                  placeholder="60"
                  style={styles.input}
                />
              </label>
            </div>

            <CalculadoraPrecioPagoPreview
              porcentajeDescuentoContado={
                configuracionNegocio.porcentaje_descuento_contado_calculadora_precios
              }
              mostrarMayorista={false}
              minoristaLabel="Quiero recibir por este servicio en efectivo/transferencia"
              minoristaButtonLabel="Usar como precio sugerido/lista"
              onAplicarMinorista={(monto) => actualizarCampo("precio_sugerido", monto)}
            />

            {editandoId && (
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => actualizarCampo("activo", e.target.checked)}
                />
                Servicio activo
              </label>
            )}

            <button type="submit" disabled={guardando} style={styles.primaryButton}>
              {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear servicio"}
            </button>
          </form>
        </section>

        <section style={styles.cardNoPadding}>
          <div style={styles.tableHeader}>
            <div>
              <p style={styles.eyebrow}>Listado</p>
              <h2 style={styles.cardTitle}>Servicios cargados</h2>
              <p style={styles.muted}>{serviciosFiltrados.length} servicio(s)</p>
            </div>
          </div>

          <div style={isMobile ? styles.filtersMobile : styles.filters}>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o descripción..."
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={incluirInactivos}
                onChange={(e) => setIncluirInactivos(e.target.checked)}
              />
              Incluir inactivos
            </label>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Servicio</th>
                  <th style={styles.th}>Precio</th>
                  <th style={styles.th}>Duración</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {serviciosFiltrados.map((servicio) => (
                  <tr key={servicio.id}>
                    <td style={styles.tdStrong}>
                      <div style={styles.serviceCell}>
                        <ServicePlaceholder size="sm" />
                        <div style={styles.serviceCellText}>
                          {servicio.nombre}
                          {servicio.descripcion && <div style={styles.tdMutedText}>{servicio.descripcion}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>{formatMoney(servicio.precio_sugerido)}</td>
                    <td style={styles.td}>
                      {servicio.duracion_estimada_min ? `${servicio.duracion_estimada_min} min` : "-"}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(servicio.activo ? styles.badgeOk : styles.badgeOff) }}>
                        {servicio.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={styles.tdActions}>
                      <button type="button" onClick={() => editar(servicio)} style={styles.smallSecondary}>
                        Editar
                      </button>
                      {servicio.activo ? (
                        <button
                          type="button"
                          onClick={() => cambiarActivo(servicio, false)}
                          disabled={guardando}
                          style={styles.smallDanger}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cambiarActivo(servicio, true)}
                          disabled={guardando}
                          style={styles.smallPrimary}
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!cargando && serviciosFiltrados.length === 0 && (
                  <tr>
                    <td style={styles.empty} colSpan={5}>
                      No hay servicios para mostrar.
                    </td>
                  </tr>
                )}

                {cargando && (
                  <tr>
                    <td style={styles.empty} colSpan={5}>
                      Cargando servicios...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function normalizar(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  pageMobile: { padding: 12, overflowX: "hidden" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16, borderRadius: 18 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  titleMobile: { fontSize: 26 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  secondaryHeroButton: { border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  layout: { display: "grid", gridTemplateColumns: "390px minmax(0, 1fr)", gap: 16, alignItems: "start" },
  layoutMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  cardNoPadding: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  cardTitle: { margin: "3px 0 0", fontSize: 22, letterSpacing: "-.02em" },
  muted: { color: "#64748b", margin: "4px 0 0", fontWeight: 700 },
  form: { display: "grid", gap: 12 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  formRowMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  field: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  label: { color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white", resize: "vertical" },
  primaryButton: { border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 20px rgba(249,115,22,.22)" },
  smallPrimary: { border: "none", background: "#0f172a", color: "white", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallSecondary: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallDanger: { border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#334155" },
  tableHeader: { padding: 18, borderBottom: "1px solid #e2e8f0" },
  filters: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: 16, borderBottom: "1px solid #e2e8f0" },
  filtersMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "stretch", padding: 12, borderBottom: "1px solid #e2e8f0" },
  tableWrapper: { overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
  th: { textAlign: "left", padding: "12px 14px", background: "#f8fafc", color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" },
  td: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 800, color: "#334155" },
  tdStrong: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 1000, color: "#0f172a" },
  serviceCell: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  serviceCellText: { minWidth: 0, overflowWrap: "anywhere" },
  tdMutedText: { marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 },
  tdActions: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" },
  badge: { display: "inline-flex", borderRadius: 999, padding: "6px 10px", fontWeight: 1000, fontSize: 12 },
  badgeOk: { background: "#ecfdf5", color: "#047857" },
  badgeOff: { background: "#f1f5f9", color: "#64748b" },
  empty: { padding: 22, color: "#64748b", fontWeight: 900, textAlign: "center" },
  fullWidth: { width: "100%" },
};
