import { useEffect, useMemo, useState } from "react";
import {
  activarUsuario,
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  listarUsuarios,
  resetearPasswordUsuario,
} from "../services/usuariosService";
import useMediaQuery from "../hooks/useMediaQuery";
import { normalizeTextUpper } from "../utils/textNormalization";

const FORM_INICIAL = {
  nombre: "",
  username: "",
  email: "",
  password: "",
  rol: "operador",
  activo: true,
};

const ROLES = [
  { value: "administrador", label: "Administrador" },
  { value: "encargado", label: "Encargado" },
  { value: "operador", label: "Operador" },
  { value: "mecanico", label: "Mecánico" },
];

export default function UsuariosPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [resetPasswordUsuario, setResetPasswordUsuario] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    repetirPassword: "",
  });

  useEffect(() => {
    cargarUsuarios();
  }, [soloActivos]);

  async function cargarUsuarios() {
    try {
      setCargando(true);
      setError("");

      const data = await listarUsuarios({
        q: busqueda.trim() || undefined,
        solo_activos: soloActivos,
      });

      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar usuarios");
    } finally {
      setCargando(false);
    }
  }

  async function buscar(e) {
    e.preventDefault();
    await cargarUsuarios();
  }

  const usuariosFiltrados = useMemo(() => usuarios, [usuarios]);

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: campo === "nombre" ? normalizeTextUpper(valor) : valor,
    }));
  }

  function editar(usuario) {
    setEditandoId(usuario.id);
    setForm({
      nombre: usuario.nombre || "",
      username: usuario.username || "",
      email: usuario.email || "",
      password: "",
      rol: usuario.rol || "operador",
      activo: Boolean(usuario.activo),
    });
    setMensaje("");
    setError("");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function guardarUsuario(e) {
    e.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (!form.username.trim()) {
      setError("El usuario es obligatorio");
      return;
    }

    if (!editandoId && form.password.trim().length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!editandoId && form.password.trim().length > 72) {
      setError("La contraseña no puede superar 72 caracteres");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      username: form.username.trim(),
      email: form.email.trim() || null,
      rol: form.rol,
    };

    if (!editandoId) {
      payload.password = form.password.trim();
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (editandoId) {
        await editarUsuario(editandoId, {
          ...payload,
          activo: Boolean(form.activo),
        });
        setMensaje("Usuario actualizado correctamente");
      } else {
        await crearUsuario(payload);
        setMensaje("Usuario creado correctamente");
      }

      cancelarEdicion();
      await cargarUsuarios();
    } catch (err) {
      setError(err.message || "No se pudo guardar el usuario");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(usuario, activo) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (activo) {
        await activarUsuario(usuario.id);
        setMensaje("Usuario activado correctamente");
      } else {
        await desactivarUsuario(usuario.id);
        setMensaje("Usuario desactivado correctamente");
      }

      await cargarUsuarios();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado del usuario");
    } finally {
      setGuardando(false);
    }
  }

  function abrirResetPassword(usuario) {
    setResetPasswordUsuario(usuario);
    setPasswordForm({
      password: "",
      repetirPassword: "",
    });
    setError("");
    setMensaje("");
  }

  function cerrarResetPassword() {
    setResetPasswordUsuario(null);
    setPasswordForm({
      password: "",
      repetirPassword: "",
    });
  }

  async function guardarResetPassword(e) {
    e.preventDefault();

    const password = passwordForm.password.trim();
    const repetirPassword = passwordForm.repetirPassword.trim();

    if (password.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password.length > 72) {
      setError("La contraseña no puede superar 72 caracteres");
      return;
    }

    if (password !== repetirPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await resetearPasswordUsuario(resetPasswordUsuario.id, { password });

      setMensaje(`Contraseña restablecida para ${resetPasswordUsuario.nombre}`);
      cerrarResetPassword();
    } catch (err) {
      setError(err.message || "No se pudo restablecer la contraseña");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Configuración</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Usuarios</h1>
          <p style={styles.subtitle}>
            Alta y administración de usuarios operativos del sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarUsuarios}
          disabled={cargando}
          style={{ ...styles.secondaryHeroButton, ...(isMobile ? styles.fullWidth : {}) }}
        >
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
              <h2 style={styles.cardTitle}>
                {editandoId ? `Usuario #${editandoId}` : "Crear usuario"}
              </h2>
            </div>

            {editandoId && (
              <button type="button" onClick={cancelarEdicion} style={styles.smallSecondary}>
                Cancelar
              </button>
            )}
          </div>

          <form onSubmit={guardarUsuario} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Nombre *</span>
              <input
                value={form.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                placeholder="Ej: Angel"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Usuario *</span>
              <input
                value={form.username}
                onChange={(e) => actualizarCampo("username", e.target.value)}
                placeholder="ej: angel"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => actualizarCampo("email", e.target.value)}
                placeholder="usuario@local.test"
                style={styles.input}
              />
            </label>

            {!editandoId && (
              <label style={styles.field}>
                <span style={styles.label}>Contraseña *</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => actualizarCampo("password", e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={styles.input}
                />
              </label>
            )}

            <label style={styles.field}>
              <span style={styles.label}>Rol *</span>
              <select
                value={form.rol}
                onChange={(e) => actualizarCampo("rol", e.target.value)}
                style={styles.input}
              >
                {ROLES.map((rol) => (
                  <option key={rol.value} value={rol.value}>
                    {rol.label}
                  </option>
                ))}
              </select>
            </label>

            {editandoId && (
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => actualizarCampo("activo", e.target.checked)}
                />
                Usuario activo
              </label>
            )}

            <button type="submit" disabled={guardando} style={styles.primaryButton}>
              {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear usuario"}
            </button>
          </form>
        </section>

        <section style={styles.cardNoPadding}>
          <div style={styles.tableHeader}>
            <div>
              <p style={styles.eyebrow}>Listado</p>
              <h2 style={styles.cardTitle}>Usuarios cargados</h2>
              <p style={styles.muted}>{usuariosFiltrados.length} usuario(s)</p>
            </div>
          </div>

          <form onSubmit={buscar} style={isMobile ? styles.filtersMobile : styles.filters}>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, usuario, email o rol..."
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              Solo activos
            </label>

            <button type="submit" style={{ ...styles.smallPrimary, ...(isMobile ? styles.fullWidth : {}) }}>
              Buscar
            </button>
          </form>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Rol</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id}>
                    <td style={styles.tdStrong}>
                      {usuario.nombre}
                      <div style={styles.tdMutedText}>
                        #{usuario.id} · @{usuario.username}
                      </div>
                    </td>

                    <td style={styles.td}>{usuario.email || "-"}</td>

                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...badgeRolStyle(usuario.rol) }}>
                        {renderRol(usuario.rol)}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(usuario.activo ? styles.badgeOk : styles.badgeOff),
                        }}
                      >
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td style={styles.tdActions}>
                      <button type="button" onClick={() => editar(usuario)} style={styles.smallSecondary}>
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirResetPassword(usuario)}
                        disabled={guardando}
                        style={styles.smallSecondary}
                      >
                        Restablecer contraseña
                      </button>

                      {usuario.activo ? (
                        <button
                          type="button"
                          onClick={() => cambiarActivo(usuario, false)}
                          disabled={guardando}
                          style={styles.smallDanger}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cambiarActivo(usuario, true)}
                          disabled={guardando}
                          style={styles.smallPrimary}
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!cargando && usuariosFiltrados.length === 0 && (
                  <tr>
                    <td style={styles.empty} colSpan={5}>
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                )}

                {cargando && (
                  <tr>
                    <td style={styles.empty} colSpan={5}>
                      Cargando usuarios...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {resetPasswordUsuario && (
        <div style={styles.modalOverlay}>
          <form onSubmit={guardarResetPassword} style={styles.modalCard}>
            <h2 style={styles.cardTitle}>Restablecer contraseña</h2>

            <p style={styles.muted}>
              Usuario: <strong>{resetPasswordUsuario.nombre}</strong> (@
              {resetPasswordUsuario.username})
            </p>

            <label style={styles.field}>
              <span style={styles.label}>Nueva contraseña</span>
              <input
                type="password"
                value={passwordForm.password}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Repetir contraseña</span>
              <input
                type="password"
                value={passwordForm.repetirPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    repetirPassword: e.target.value,
                  }))
                }
                style={styles.input}
                placeholder="Repetí la contraseña"
              />
            </label>

            <div style={styles.modalActions}>
              <button type="button" onClick={cerrarResetPassword} style={styles.smallSecondary}>
                Cancelar
              </button>

              <button type="submit" disabled={guardando} style={styles.smallPrimary}>
                {guardando ? "Guardando..." : "Restablecer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function renderRol(rol) {
  const encontrado = ROLES.find((item) => item.value === rol);
  return encontrado?.label || rol || "-";
}

function badgeRolStyle(rol) {
  if (rol === "administrador") return { background: "#fee2e2", color: "#991b1b" };
  if (rol === "encargado") return { background: "#dbeafe", color: "#1d4ed8" };
  if (rol === "mecanico") return { background: "#fef3c7", color: "#92400e" };
  return { background: "#f1f5f9", color: "#334155" };
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
  field: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  label: { color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  primaryButton: { border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 20px rgba(249,115,22,.22)" },
  smallPrimary: { border: "none", background: "#0f172a", color: "white", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallSecondary: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallDanger: { border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#334155", whiteSpace: "nowrap" },
  tableHeader: { padding: 18, borderBottom: "1px solid #e2e8f0" },
  filters: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 12, alignItems: "center", padding: 16, borderBottom: "1px solid #e2e8f0" },
  filtersMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "stretch", padding: 12, borderBottom: "1px solid #e2e8f0" },
  tableWrapper: { overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 820 },
  th: { textAlign: "left", padding: "12px 14px", background: "#f8fafc", color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" },
  td: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 800, color: "#334155" },
  tdStrong: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 1000, color: "#0f172a" },
  tdMutedText: { marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 },
  tdActions: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" },
  badge: { display: "inline-flex", borderRadius: 999, padding: "6px 10px", fontWeight: 1000, fontSize: 12 },
  badgeOk: { background: "#ecfdf5", color: "#047857" },
  badgeOff: { background: "#f1f5f9", color: "#64748b" },
  empty: { padding: 22, color: "#64748b", fontWeight: 900, textAlign: "center" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 20, zIndex: 100 },
  modalCard: { width: "min(420px, 100%)", background: "white", borderRadius: 22, padding: 18, boxShadow: "0 24px 70px rgba(15,23,42,.35)", display: "grid", gap: 12 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  fullWidth: { width: "100%" },
};
