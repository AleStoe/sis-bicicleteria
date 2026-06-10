import { useState } from "react";
import { useSession } from "../context/SessionContext";

export default function LoginPage() {
  const { iniciarSesion } = useSession();
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      setError("Ingresá usuario y contraseña");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await iniciarSesion({
        username,
        password,
      });
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logoCircle}>🚲</div>

        <div>
          <p style={styles.kicker}>Emprendimiento Agus</p>
          <h1 style={styles.title}>Iniciar sesión</h1>
          <p style={styles.subtitle}>Acceso interno al ERP / POS</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Usuario</span>
            <input
              autoFocus
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              autoComplete="username"
              placeholder="Ej: angel"
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Contraseña</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              autoComplete="current-password"
              placeholder="Tu contraseña"
              style={styles.input}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(circle at top left, rgba(249,115,22,.18), transparent 28%), #0f172a",
    color: "#0f172a",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 26,
    padding: 28,
    boxShadow: "0 24px 70px rgba(0,0,0,.28)",
    display: "grid",
    gap: 20,
    boxSizing: "border-box",
  },
  logoCircle: {
    width: 58,
    height: 58,
    display: "grid",
    placeItems: "center",
    borderRadius: 18,
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "white",
    fontSize: 28,
    boxShadow: "0 14px 28px rgba(249,115,22,.28)",
  },
  kicker: {
    margin: 0,
    color: "#f97316",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: ".08em",
  },
  title: {
    margin: "4px 0 0",
    fontSize: 32,
    letterSpacing: "-.04em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontWeight: 800,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 7,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 14px",
    fontWeight: 800,
    color: "#0f172a",
    boxSizing: "border-box",
    outline: "none",
  },
  error: {
    background: "#fff1f0",
    color: "#b42318",
    border: "1px solid #fecdca",
    borderRadius: 14,
    padding: 12,
    fontWeight: 900,
  },
  button: {
    border: "none",
    borderRadius: 15,
    padding: "14px 16px",
    background: "#f97316",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(249,115,22,.25)",
  },
};
