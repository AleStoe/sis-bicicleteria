import { useSession } from "../context/SessionContext";

export default function SeleccionUsuarioPage() {
  const {
    usuarios,
    cargandoSesion,
    errorSesion,
    seleccionarUsuario,
    recargarUsuariosSesion,
  } = useSession();

  return (
    <div style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>🚲</div>

        <p style={styles.kicker}>Sesión operativa</p>
        <h1 style={styles.title}>¿Quién está usando el sistema?</h1>
        <p style={styles.subtitle}>
          Seleccioná el usuario para registrar auditoría, caja, ventas y taller con responsable real.
        </p>

        {errorSesion && (
          <div style={styles.error}>
            {errorSesion}
            <button type="button" style={styles.retryButton} onClick={recargarUsuariosSesion}>
              Reintentar
            </button>
          </div>
        )}

        {cargandoSesion ? (
          <div style={styles.loading}>Cargando usuarios...</div>
        ) : (
          <div style={styles.grid}>
            {usuarios.map((usuario) => (
              <button
                key={usuario.id}
                type="button"
                style={styles.userButton}
                onClick={() => seleccionarUsuario(usuario)}
              >
                <span style={styles.avatar}>{usuario.nombre?.[0]?.toUpperCase() || "U"}</span>
                <span style={styles.userInfo}>
                  <strong>{usuario.nombre}</strong>
                  <small>@{usuario.username} · {renderRol(usuario.rol)}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <p style={styles.note}>
          Esto todavía no es login con contraseña. Es una sesión operativa LAN para eliminar usuarios hardcodeados.
        </p>
      </section>
    </div>
  );
}

function renderRol(rol) {
  if (rol === "administrador") return "Administrador";
  if (rol === "encargado") return "Encargado";
  if (rol === "mecanico") return "Mecánico";
  if (rol === "operador") return "Operador";
  return rol || "Sin rol";
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(circle at 20% 20%, rgba(249,115,22,.20), transparent 28%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #111827 100%)",
    color: "#0f172a",
  },
  card: {
    width: "min(720px, 100%)",
    background: "white",
    borderRadius: 28,
    padding: 30,
    boxShadow: "0 30px 80px rgba(2,6,23,.35)",
    border: "1px solid rgba(255,255,255,.12)",
  },
  logo: {
    width: 64,
    height: 64,
    display: "grid",
    placeItems: "center",
    borderRadius: 22,
    background: "#ff6b00",
    color: "white",
    fontSize: 30,
    boxShadow: "0 18px 38px rgba(249,115,22,.28)",
    marginBottom: 18,
  },
  kicker: {
    margin: 0,
    color: "#f97316",
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    fontSize: 12,
  },
  title: {
    margin: "6px 0 8px",
    fontSize: 34,
    letterSpacing: "-.04em",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 24,
  },
  userButton: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "white",
    fontWeight: 1000,
  },
  userInfo: {
    display: "grid",
    gap: 3,
  },
  loading: {
    marginTop: 24,
    color: "#64748b",
    fontWeight: 900,
  },
  error: {
    marginTop: 18,
    background: "#fff1f0",
    border: "1px solid #fecaca",
    color: "#b42318",
    borderRadius: 14,
    padding: 12,
    fontWeight: 800,
  },
  retryButton: {
    marginLeft: 10,
    border: 0,
    background: "#b42318",
    color: "white",
    borderRadius: 10,
    padding: "6px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  note: {
    margin: "22px 0 0",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
};