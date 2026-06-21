import { useEffect, useMemo, useState } from "react";
import {
  cambiarEstadoCategoria,
  crearCategoria,
  editarCategoria,
  listarCategorias,
} from "../services/catalogoService";

const CATEGORIAS_SUGERIDAS = [
  "Bicicletas",
  "Cubiertas",
  "Cámaras",
  "Transmisión",
  "Frenos",
  "Ruedas",
  "Dirección",
  "Pedalier y caja",
  "Pedales",
  "Asientos",
  "Manubrios y stems",
  "Puños y cintas",
  "Suspensión",
  "Luces y electrónica",
  "Lubricantes y mantenimiento",
  "Herramientas",
  "Accesorios",
  "Indumentaria",
];

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function CategoriasCatalogoPage() {
  const [categorias, setCategorias] = useState([]);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarCategorias();
  }, []);

  const sugeridasPendientes = useMemo(() => {
    const existentes = new Set(categorias.map((categoria) => normalizarTexto(categoria.nombre)));
    return CATEGORIAS_SUGERIDAS.filter((nombre) => !existentes.has(normalizarTexto(nombre)));
  }, [categorias]);

  async function cargarCategorias() {
    try {
      setLoading(true);
      setError("");
      const data = await listarCategorias({ incluir_inactivas: true });
      setCategorias(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
    }
  }

  async function crearNuevaCategoria(e) {
    e.preventDefault();

    if (!nombreNuevo.trim()) {
      setError("El nombre de la categoría es obligatorio");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await crearCategoria({ nombre: nombreNuevo });
      setNombreNuevo("");
      setMensaje("Categoría creada.");
      await cargarCategorias();
    } catch (err) {
      setError(err.message || "No se pudo crear la categoría");
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicion(categoria) {
    setEditandoId(categoria.id);
    setNombreEditado(categoria.nombre);
    setError("");
    setMensaje("");
  }

  async function guardarEdicion(categoria) {
    if (!nombreEditado.trim()) {
      setError("El nombre de la categoría es obligatorio");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await editarCategoria(categoria.id, { nombre: nombreEditado });
      setEditandoId(null);
      setNombreEditado("");
      setMensaje("Categoría actualizada.");
      await cargarCategorias();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la categoría");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(categoria) {
    const activar = !categoria.activo;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await cambiarEstadoCategoria(categoria.id, { activo: activar });
      setMensaje(activar ? "Categoría activada." : "Categoría desactivada.");
      await cargarCategorias();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado de la categoría");
    } finally {
      setGuardando(false);
    }
  }

  async function crearCategoriasSugeridas() {
    if (sugeridasPendientes.length === 0) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      for (const nombre of sugeridasPendientes) {
        await crearCategoria({ nombre });
      }

      setMensaje("Categorías sugeridas cargadas.");
      await cargarCategorias();
    } catch (err) {
      setError(err.message || "No se pudieron cargar todas las categorías sugeridas");
      await cargarCategorias();
    } finally {
      setGuardando(false);
    }
  }

  const activas = categorias.filter((categoria) => categoria.activo).length;
  const inactivas = categorias.length - activas;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Catálogo / Configuración</p>
          <h1 style={styles.title}>Categorías</h1>
          <p style={styles.subtitle}>
            Definí la estructura antes de cargar productos masivamente.
          </p>
        </div>
        <button
          type="button"
          onClick={crearCategoriasSugeridas}
          disabled={guardando || sugeridasPendientes.length === 0}
          style={styles.secondaryButton}
        >
          Cargar sugeridas
        </button>
      </header>

      {error && <div style={styles.errorBox}>{error}</div>}
      {mensaje && <div style={styles.successBox}>{mensaje}</div>}

      <section style={styles.metricsGrid}>
        <Metric label="Total" value={categorias.length} />
        <Metric label="Activas" value={activas} tone="ok" />
        <Metric label="Inactivas" value={inactivas} tone={inactivas > 0 ? "warning" : "muted"} />
      </section>

      <main style={styles.layout}>
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Nueva categoría</h2>
              <p style={styles.muted}>Se guarda en mayúsculas para mantener el catálogo ordenado.</p>
            </div>
          </div>

          <form onSubmit={crearNuevaCategoria} style={styles.form}>
            <label style={styles.field}>
              <span>Nombre</span>
              <input
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value.toUpperCase())}
                placeholder="Ej: LUBRICANTES Y MANTENIMIENTO"
                style={styles.input}
              />
            </label>
            <button type="submit" disabled={guardando} style={styles.primaryButton}>
              {guardando ? "Guardando..." : "Crear categoría"}
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Listado</h2>
              <p style={styles.muted}>No se borran categorías físicamente; se activan o desactivan.</p>
            </div>
            <button type="button" onClick={cargarCategorias} disabled={loading} style={styles.lightButton}>
              Refrescar
            </button>
          </div>

          {loading ? (
            <div style={styles.empty}>Cargando categorías...</div>
          ) : categorias.length === 0 ? (
            <div style={styles.empty}>Todavía no hay categorías cargadas.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Categoría</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => {
                    const editando = editandoId === categoria.id;

                    return (
                      <tr key={categoria.id}>
                        <td style={styles.td}>
                          {editando ? (
                            <input
                              value={nombreEditado}
                              onChange={(e) => setNombreEditado(e.target.value.toUpperCase())}
                              style={styles.input}
                            />
                          ) : (
                            <strong>{categoria.nombre}</strong>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={categoria.activo ? styles.statusOk : styles.statusMuted}>
                            {categoria.activo ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actions}>
                            {editando ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => guardarEdicion(categoria)}
                                  disabled={guardando}
                                  style={styles.primarySmallButton}
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditandoId(null)}
                                  disabled={guardando}
                                  style={styles.lightButton}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicion(categoria)}
                                  disabled={guardando}
                                  style={styles.lightButton}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cambiarEstado(categoria)}
                                  disabled={guardando}
                                  style={categoria.activo ? styles.warningButton : styles.successButton}
                                >
                                  {categoria.activo ? "Desactivar" : "Activar"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, tone = "muted" }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const buttonBase = {
  border: "none",
  borderRadius: 12,
  padding: "11px 14px",
  fontWeight: 950,
  cursor: "pointer",
};

const styles = {
  page: {
    display: "grid",
    gap: 16,
    padding: 22,
    minHeight: "100vh",
    background: "#f1f5f9",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "start",
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 14px 30px rgba(15,23,42,.06)",
  },
  eyebrow: {
    margin: 0,
    color: "#f97316",
    fontWeight: 1000,
    fontSize: 12,
    textTransform: "uppercase",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 32,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontWeight: 750,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  metric: {
    display: "grid",
    gap: 3,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
    background: "white",
  },
  metricTones: {
    ok: { background: "#ecfdf5", borderColor: "#bbf7d0", color: "#047857" },
    warning: { background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" },
    muted: { background: "white", color: "#475569" },
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    alignItems: "start",
  },
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 14px 30px rgba(15,23,42,.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 21,
  },
  muted: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  form: {
    display: "grid",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
    fontWeight: 900,
    color: "#334155",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    fontWeight: 850,
    color: "#0f172a",
    boxSizing: "border-box",
  },
  primaryButton: {
    ...buttonBase,
    background: "#0f172a",
    color: "white",
  },
  primarySmallButton: {
    ...buttonBase,
    padding: "9px 11px",
    background: "#0f172a",
    color: "white",
  },
  secondaryButton: {
    ...buttonBase,
    background: "#2563eb",
    color: "white",
  },
  lightButton: {
    ...buttonBase,
    padding: "9px 11px",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
  },
  warningButton: {
    ...buttonBase,
    padding: "9px 11px",
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
  },
  successButton: {
    ...buttonBase,
    padding: "9px 11px",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #bbf7d0",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: 10,
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: 10,
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  statusOk: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 950,
  },
  statusMuted: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#f1f5f9",
    color: "#475569",
    fontWeight: 950,
  },
  empty: {
    padding: 16,
    borderRadius: 14,
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 900,
  },
  errorBox: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 14,
    padding: 12,
    fontWeight: 900,
  },
  successBox: {
    border: "1px solid #86efac",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 14,
    padding: 12,
    fontWeight: 900,
  },
};
