import { useEffect, useMemo, useState } from "react";
import { crearProveedor, listarProveedores } from "../services/proveedoresService";
import useMediaQuery from "../hooks/useMediaQuery";

export default function ProveedoresPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
    notas: "",
  });

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarProveedores() {
    try {
      setCargando(true);
      setError("");

      const data = await listarProveedores({
        solo_activos: soloActivos,
      });

      setProveedores(data || []);
    } catch (err) {
      setError(err.message || "Error al cargar proveedores");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarProveedores();
  }, [soloActivos]);

  const proveedoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    if (!q) return proveedores;

    return proveedores.filter((p) => {
      return (
        String(p.nombre || "").toLowerCase().includes(q) ||
        String(p.telefono || "").toLowerCase().includes(q) ||
        String(p.email || "").toLowerCase().includes(q)
      );
    });
  }, [proveedores, busqueda]);

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  async function guardarProveedor(e) {
    e.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre del proveedor es obligatorio");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await crearProveedor({
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        notas: form.notas.trim() || null,
      });

      setMensaje("Proveedor creado correctamente");
      setForm({
        nombre: "",
        telefono: "",
        email: "",
        notas: "",
      });

      await cargarProveedores();
    } catch (err) {
      setError(err.message || "Error al crear proveedor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <div style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
        <div>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Proveedores</h1>
          <p style={styles.subtitle}>
            Alta y consulta rápida de proveedores para stock y precios.
          </p>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <div style={isNarrow ? styles.gridMobile : styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Nuevo proveedor</h2>

          <form onSubmit={guardarProveedor} style={styles.form}>
            <label style={styles.label}>
              Nombre *
              <input
                style={styles.input}
                value={form.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                placeholder="Ej: Bicipartes"
              />
            </label>

            <label style={styles.label}>
              Teléfono
              <input
                style={styles.input}
                value={form.telefono}
                onChange={(e) => actualizarCampo("telefono", e.target.value)}
                placeholder="Ej: 291..."
              />
            </label>

            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                value={form.email}
                onChange={(e) => actualizarCampo("email", e.target.value)}
                placeholder="proveedor@email.com"
              />
            </label>

            <label style={styles.label}>
              Notas
              <textarea
                style={styles.textarea}
                value={form.notas}
                onChange={(e) => actualizarCampo("notas", e.target.value)}
                placeholder="Condiciones, contactos, observaciones..."
                rows={4}
              />
            </label>

            <button type="submit" style={styles.primaryButton} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear proveedor"}
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <div style={isMobile ? styles.toolbarMobile : styles.toolbar}>
            <div>
              <h2 style={styles.cardTitle}>Listado</h2>
              <p style={styles.counter}>
                {proveedoresFiltrados.length} proveedor(es)
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={cargarProveedores}
              disabled={cargando}
            >
              {cargando ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div style={isMobile ? styles.filtersMobile : styles.filters}>
            <input
              style={styles.input}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              Solo activos
            </label>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Teléfono</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {proveedoresFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td style={styles.tdMuted}>{p.id}</td>
                    <td style={styles.tdStrong}>{p.nombre}</td>
                    <td style={styles.td}>{p.telefono || "-"}</td>
                    <td style={styles.td}>{p.email || "-"}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(p.activo ? styles.badgeOk : styles.badgeOff),
                        }}
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}

                {!cargando && proveedoresFiltrados.length === 0 && (
                  <tr>
                    <td style={styles.empty} colSpan={5}>
                      No hay proveedores para mostrar.
                    </td>
                  </tr>
                )}

                {cargando && (
                  <tr>
                    <td style={styles.empty} colSpan={5}>
                      Cargando proveedores...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
  },
  pageMobile: {
    padding: "12px",
    overflowX: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
  },
  headerMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  titleMobile: {
    fontSize: "24px",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#666",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "18px",
    alignItems: "start",
  },
  gridMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "14px",
    alignItems: "start",
  },
  card: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "18px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
  },
  form: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontSize: "14px",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    borderRadius: "8px",
    padding: "11px 14px",
    background: "#1f6feb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "9px 12px",
    background: "#f8f8f8",
    color: "#222",
    fontWeight: 600,
    cursor: "pointer",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px",
  },
  toolbarMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    alignItems: "stretch",
    marginBottom: "14px",
  },
  counter: {
    margin: "4px 0 0",
    color: "#777",
    fontSize: "13px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px",
  },
  filtersMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    alignItems: "stretch",
    marginBottom: "14px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    fontSize: "14px",
  },
  tableWrapper: {
    overflowX: "auto",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "720px",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #ddd",
    padding: "10px",
    fontSize: "13px",
    color: "#555",
  },
  td: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "14px",
  },
  tdStrong: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "14px",
    fontWeight: 700,
  },
  tdMuted: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "13px",
    color: "#777",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
  },
  badgeOk: {
    background: "#e7f7ed",
    color: "#137333",
  },
  badgeOff: {
    background: "#f1f1f1",
    color: "#777",
  },
  empty: {
    padding: "18px",
    textAlign: "center",
    color: "#777",
  },
  error: {
    background: "#ffe8e8",
    color: "#9b1c1c",
    border: "1px solid #f5b5b5",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
  success: {
    background: "#e7f7ed",
    color: "#137333",
    border: "1px solid #b7e0c2",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
};
