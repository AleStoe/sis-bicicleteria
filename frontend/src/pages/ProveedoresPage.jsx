import { useEffect, useMemo, useState } from "react";
import {
  activarProveedor,
  actualizarProveedor,
  crearProveedor,
  desactivarProveedor,
  listarProveedores,
} from "../services/proveedoresService";
import {
  cambiarEstadoMarca,
  crearMarca,
  editarMarca,
  listarMarcas,
} from "../services/catalogoService";
import useMediaQuery from "../hooks/useMediaQuery";
import { normalizeTextUpper } from "../utils/textNormalization";

export default function ProveedoresPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const [tabActiva, setTabActiva] = useState("proveedores");
  const [proveedores, setProveedores] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [busquedaMarcas, setBusquedaMarcas] = useState("");
  const [soloMarcasActivas, setSoloMarcasActivas] = useState(false);

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
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [marcaForm, setMarcaForm] = useState({ nombre: "" });
  const [marcaEditando, setMarcaEditando] = useState(null);

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

  async function cargarMarcas() {
    try {
      setCargando(true);
      setError("");

      const data = await listarMarcas({
        solo_activas: soloMarcasActivas,
      });

      setMarcas(data || []);
    } catch (err) {
      setError(err.message || "Error al cargar marcas");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarProveedores();
  }, [soloActivos]);

  useEffect(() => {
    cargarMarcas();
  }, [soloMarcasActivas]);

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

  const marcasFiltradas = useMemo(() => {
    const q = busquedaMarcas.trim().toLowerCase();

    if (!q) return marcas;

    return marcas.filter((m) =>
      String(m.nombre || "").toLowerCase().includes(q)
    );
  }, [marcas, busquedaMarcas]);

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: campo === "nombre" ? normalizeTextUpper(valor) : valor,
    }));
  }

  function limpiarFormulario() {
    setProveedorEditando(null);
    setForm({
      nombre: "",
      telefono: "",
      email: "",
      notas: "",
    });
  }

  function limpiarMarcaFormulario() {
    setMarcaEditando(null);
    setMarcaForm({ nombre: "" });
  }

  function iniciarEdicion(proveedor) {
    setProveedorEditando(proveedor);
    setError("");
    setMensaje("");
    setForm({
      nombre: proveedor.nombre || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      notas: proveedor.notas || "",
    });
  }

  function iniciarEdicionMarca(marca) {
    setMarcaEditando(marca);
    setError("");
    setMensaje("");
    setMarcaForm({ nombre: marca.nombre || "" });
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

      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        notas: form.notas.trim() || null,
      };

      if (proveedorEditando) {
        await actualizarProveedor(proveedorEditando.id, payload);
        setMensaje("Proveedor actualizado correctamente");
      } else {
        await crearProveedor(payload);
        setMensaje("Proveedor creado correctamente");
      }

      limpiarFormulario();

      await cargarProveedores();
    } catch (err) {
      setError(err.message || "Error al guardar proveedor");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarMarca(e) {
    e.preventDefault();

    if (!marcaForm.nombre.trim()) {
      setError("El nombre de la marca es obligatorio");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const payload = { nombre: normalizeTextUpper(marcaForm.nombre.trim()) };

      if (marcaEditando) {
        await editarMarca(marcaEditando.id, payload);
        setMensaje("Marca actualizada correctamente");
      } else {
        await crearMarca(payload);
        setMensaje("Marca creada correctamente");
      }

      limpiarMarcaFormulario();
      await cargarMarcas();
    } catch (err) {
      setError(err.message || "Error al guardar marca");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoProveedor(proveedor) {
    const accion = proveedor.activo ? desactivarProveedor : activarProveedor;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await accion(proveedor.id);

      if (proveedorEditando?.id === proveedor.id && proveedor.activo) {
        limpiarFormulario();
      }

      setMensaje(proveedor.activo ? "Proveedor desactivado" : "Proveedor activado");
      await cargarProveedores();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado del proveedor");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoMarcaItem(marca) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await cambiarEstadoMarca(marca.id, { activa: !marca.activa });

      if (marcaEditando?.id === marca.id && marca.activa) {
        limpiarMarcaFormulario();
      }

      setMensaje(marca.activa ? "Marca desactivada" : "Marca activada");
      await cargarMarcas();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado de la marca");
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

      <div style={styles.tabs}>
        <button
          type="button"
          style={tabActiva === "proveedores" ? styles.tabActive : styles.tab}
          onClick={() => setTabActiva("proveedores")}
        >
          Proveedores
        </button>
        <button
          type="button"
          style={tabActiva === "marcas" ? styles.tabActive : styles.tab}
          onClick={() => setTabActiva("marcas")}
        >
          Marcas
        </button>
      </div>

      {tabActiva === "proveedores" && (
      <div style={isNarrow ? styles.gridMobile : styles.grid}>
        <section style={styles.card}>
          <div style={styles.formHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                {proveedorEditando ? "Editar proveedor" : "Nuevo proveedor"}
              </h2>
              {proveedorEditando && (
                <p style={styles.editingHint}>Editando #{proveedorEditando.id}</p>
              )}
            </div>
            {proveedorEditando && (
              <button
                type="button"
                style={styles.linkButton}
                onClick={limpiarFormulario}
                disabled={guardando}
              >
                Cancelar
              </button>
            )}
          </div>

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
              {guardando
                ? "Guardando..."
                : proveedorEditando
                  ? "Guardar cambios"
                  : "Crear proveedor"}
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
                  <th style={styles.th}>Acciones</th>
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
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => iniciarEdicion(p)}
                          disabled={guardando}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.smallButton,
                            ...(p.activo ? styles.dangerButton : styles.successButton),
                          }}
                          onClick={() => cambiarEstadoProveedor(p)}
                          disabled={guardando}
                        >
                          {p.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!cargando && proveedoresFiltrados.length === 0 && (
                  <tr>
                    <td style={styles.empty} colSpan={6}>
                      No hay proveedores para mostrar.
                    </td>
                  </tr>
                )}

                {cargando && (
                  <tr>
                    <td style={styles.empty} colSpan={6}>
                      Cargando proveedores...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      )}

      {tabActiva === "marcas" && (
        <div style={isNarrow ? styles.gridMobile : styles.grid}>
          <section style={styles.card}>
            <div style={styles.formHeader}>
              <div>
                <h2 style={styles.cardTitle}>
                  {marcaEditando ? "Editar marca" : "Nueva marca"}
                </h2>
                {marcaEditando && (
                  <p style={styles.editingHint}>Editando #{marcaEditando.id}</p>
                )}
              </div>
              {marcaEditando && (
                <button
                  type="button"
                  style={styles.linkButton}
                  onClick={limpiarMarcaFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={guardarMarca} style={styles.form}>
              <label style={styles.label}>
                Nombre *
                <input
                  style={styles.input}
                  value={marcaForm.nombre}
                  onChange={(e) => setMarcaForm({ nombre: normalizeTextUpper(e.target.value) })}
                  placeholder="Ej: SHIMANO"
                />
              </label>

              <button type="submit" style={styles.primaryButton} disabled={guardando}>
                {guardando
                  ? "Guardando..."
                  : marcaEditando
                    ? "Guardar cambios"
                    : "Crear marca"}
              </button>
            </form>
          </section>

          <section style={styles.card}>
            <div style={isMobile ? styles.toolbarMobile : styles.toolbar}>
              <div>
                <h2 style={styles.cardTitle}>Marcas</h2>
                <p style={styles.counter}>
                  {marcasFiltradas.length} marca(s)
                </p>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={cargarMarcas}
                disabled={cargando}
              >
                {cargando ? "Cargando..." : "Actualizar"}
              </button>
            </div>

            <div style={isMobile ? styles.filtersMobile : styles.filters}>
              <input
                style={styles.input}
                value={busquedaMarcas}
                onChange={(e) => setBusquedaMarcas(e.target.value)}
                placeholder="Buscar por nombre de marca..."
              />

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={soloMarcasActivas}
                  onChange={(e) => setSoloMarcasActivas(e.target.checked)}
                />
                Solo activas
              </label>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Productos</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {marcasFiltradas.map((m) => (
                    <tr key={m.id}>
                      <td style={styles.tdMuted}>{m.id}</td>
                      <td style={styles.tdStrong}>{m.nombre}</td>
                      <td style={styles.td}>{m.productos_asociados ?? 0}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(m.activa ? styles.badgeOk : styles.badgeOff),
                          }}
                        >
                          {m.activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            type="button"
                            style={styles.smallButton}
                            onClick={() => iniciarEdicionMarca(m)}
                            disabled={guardando}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.smallButton,
                              ...(m.activa ? styles.dangerButton : styles.successButton),
                            }}
                            onClick={() => cambiarEstadoMarcaItem(m)}
                            disabled={guardando}
                          >
                            {m.activa ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!cargando && marcasFiltradas.length === 0 && (
                    <tr>
                      <td style={styles.empty} colSpan={5}>
                        No hay marcas para mostrar.
                      </td>
                    </tr>
                  )}

                  {cargando && (
                    <tr>
                      <td style={styles.empty} colSpan={5}>
                        Cargando marcas...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
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
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  tab: {
    border: "1px solid #cfd7e3",
    borderRadius: "999px",
    padding: "9px 14px",
    background: "#fff",
    color: "#344054",
    fontWeight: 800,
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid #1f6feb",
    borderRadius: "999px",
    padding: "9px 14px",
    background: "#eff6ff",
    color: "#1f6feb",
    fontWeight: 900,
    cursor: "pointer",
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
  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  editingHint: {
    margin: "4px 0 0",
    color: "#666",
    fontSize: "13px",
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
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#1f6feb",
    fontWeight: 700,
    cursor: "pointer",
    padding: "4px",
  },
  smallButton: {
    border: "1px solid #cfd7e3",
    borderRadius: "7px",
    padding: "7px 9px",
    background: "#fff",
    color: "#1f2937",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerButton: {
    borderColor: "#fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
  },
  successButton: {
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
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
