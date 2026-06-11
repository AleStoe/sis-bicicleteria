import { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";

const MOBILE_BREAKPOINT = 900;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

export default function LoginPage() {
  const { iniciarSesion, errorSesion } = useSession();
  const isMobile = useIsMobile();

  const [form, setForm] = useState({ username: "", password: "" });
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const username = form.username.trim();
    const password = form.password.trim();

    if (!username || !password) {
      setError("Completá usuario y contraseña para ingresar.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await iniciarSesion({ username, password });
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <section style={{ ...styles.shell, ...(isMobile ? styles.shellMobile : {}) }}>
        <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
          <div style={styles.brand}>
            <div style={styles.brandIcon}>🚲</div>
            <span>Emprendimiento Agus</span>
          </div>

          <div style={{ ...styles.heroContent, ...(isMobile ? styles.heroContentMobile : {}) }}>
            <div style={styles.pill}>
              <span style={styles.dot} />
              Servidor LAN interno
            </div>

            <h1 style={{ ...styles.heroTitle, ...(isMobile ? styles.heroTitleMobile : {}) }}>
              Sistema interno de bicicletería
            </h1>

            <p style={{ ...styles.heroText, ...(isMobile ? styles.heroTextMobile : {}) }}>
              Acceso para mostrador, taller, caja y stock. Pensado para uso local dentro de la red del negocio.
            </p>

            <div style={{ ...styles.miniCards, ...(isMobile ? styles.miniCardsMobile : {}) }}>
              <MiniCard title="LAN" text="Acceso interno" />
              <MiniCard title="POS" text="Ventas y caja" />
              <MiniCard title="Taller" text="Órdenes y repuestos" />
            </div>
          </div>
        </section>

        <section style={{ ...styles.loginArea, ...(isMobile ? styles.loginAreaMobile : {}) }}>
          <form style={styles.loginCard} onSubmit={handleSubmit}>
            <div style={styles.loginTop}>
              <div style={styles.bikeBadge}>🚲</div>
              <h2 style={styles.loginTitle}>Ingresar</h2>
              <p style={styles.loginText}>Usá tu usuario del sistema</p>
            </div>

            <div style={styles.server}>
              <span>Servidor</span>
              <strong>{window.location.hostname || "local"}</strong>
            </div>

            <label style={styles.label}>Usuario</label>
            <div style={styles.field}>
              <span style={styles.iconLeft}>👤</span>
              <input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                type="text"
                placeholder="admin, caja o taller"
                autoComplete="username"
                style={styles.input}
                disabled={guardando}
              />
            </div>

            <label style={styles.label}>Contraseña</label>
            <div style={styles.field}>
              <span style={styles.iconLeft}>🔒</span>
              <input
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                type={mostrarPassword ? "text" : "password"}
                placeholder="Ingresá tu contraseña"
                autoComplete="current-password"
                style={styles.input}
                disabled={guardando}
              />

              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                style={styles.iconRight}
                disabled={guardando}
              >
                {mostrarPassword ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={styles.row}>
              <span>Uso interno</span>
              <span>Red local / LAN</span>
            </div>

            <button type="submit" disabled={guardando} style={styles.primary}>
              {guardando ? "Ingresando..." : "Entrar al sistema"} <span>→</span>
            </button>

            {(error || errorSesion) && (
              <div style={styles.messageError}>{error || errorSesion}</div>
            )}

            <div style={styles.footerNote}>
              No es una pantalla pública. Ideal para red local / LAN.
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

function MiniCard({ title, text }) {
  return (
    <div style={styles.miniCard}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 28,
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at 15% 20%, rgba(37, 99, 235, 0.35), transparent 30%), radial-gradient(circle at 90% 10%, rgba(14, 165, 233, 0.22), transparent 25%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)",
    color: "white",
    boxSizing: "border-box",
  },
  pageMobile: {
    padding: 14,
    alignItems: "start",
  },
  shell: {
    width: "min(1180px, 100%)",
    minHeight: 680,
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    borderRadius: 26,
    overflow: "hidden",
    boxShadow: "0 30px 80px rgba(2, 6, 23, 0.35)",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },
  shellMobile: {
    minHeight: "auto",
    gridTemplateColumns: "1fr",
    borderRadius: 22,
  },
  hero: {
    position: "relative",
    padding: 42,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(2,6,23,0.98), rgba(15,23,42,0.72)), radial-gradient(circle at 70% 20%, rgba(37,99,235,.35), transparent 30%)",
  },
  heroMobile: {
    minHeight: "auto",
    padding: 24,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    fontWeight: 800,
    fontSize: 19,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: "rgba(255,255,255,0.12)",
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 26,
    flexShrink: 0,
  },
  heroContent: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 42,
  },
  heroContentMobile: {
    position: "relative",
    left: "auto",
    right: "auto",
    bottom: "auto",
    marginTop: 44,
  },
  pill: {
    width: "fit-content",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(22, 163, 74, 0.15)",
    border: "1px solid rgba(34, 197, 94, 0.35)",
    color: "#bbf7d0",
    fontSize: 13,
    marginBottom: 18,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#16a34a",
    boxShadow: "0 0 0 6px rgba(22, 163, 74, 0.18)",
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: "clamp(36px, 5vw, 60px)",
    lineHeight: 0.95,
    margin: "0 0 18px",
    letterSpacing: -1.7,
  },
  heroTitleMobile: {
    fontSize: 34,
    lineHeight: 1,
  },
  heroText: {
    maxWidth: 520,
    margin: 0,
    color: "#cbd5e1",
    fontSize: 18,
    lineHeight: 1.55,
  },
  heroTextMobile: {
    fontSize: 15,
  },
  miniCards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 28,
  },
  miniCardsMobile: {
    gridTemplateColumns: "1fr",
  },
  miniCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(15,23,42,0.62)",
    border: "1px solid rgba(255,255,255,0.13)",
    display: "grid",
    gap: 3,
  },
  loginArea: {
    background:
      "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.96))",
    color: "#0f172a",
    display: "grid",
    placeItems: "center",
    padding: 42,
  },
  loginAreaMobile: {
    padding: 24,
  },
  loginCard: {
    width: "min(440px, 100%)",
  },
  loginTop: {
    textAlign: "center",
    marginBottom: 28,
  },
  bikeBadge: {
    width: 74,
    height: 74,
    margin: "0 auto 16px",
    display: "grid",
    placeItems: "center",
    borderRadius: 26,
    background: "#dbeafe",
    color: "#2563eb",
    fontSize: 38,
  },
  loginTitle: {
    margin: "0 0 8px",
    fontSize: 34,
    letterSpacing: -1,
  },
  loginText: {
    margin: 0,
    color: "#64748b",
  },
  server: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    background: "#f8fafc",
    color: "#64748b",
    marginBottom: 18,
    fontSize: 13,
    flexWrap: "wrap",
  },
  label: {
    display: "block",
    fontWeight: 700,
    fontSize: 14,
    margin: "18px 0 8px",
  },
  field: {
    position: "relative",
  },
  input: {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    padding: "15px 48px 15px 46px",
    fontSize: 16,
    outline: "none",
    background: "white",
    boxSizing: "border-box",
  },
  iconLeft: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    left: 15,
    color: "#64748b",
  },
  iconRight: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    right: 14,
    cursor: "pointer",
    border: 0,
    background: "transparent",
    padding: 4,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    margin: "16px 0 22px",
    color: "#64748b",
    fontSize: 14,
    flexWrap: "wrap",
  },
  primary: {
    width: "100%",
    border: 0,
    borderRadius: 15,
    padding: 16,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 14px 30px rgba(37, 99, 235, .25)",
  },
  messageError: {
    marginTop: 16,
    padding: "13px 14px",
    borderRadius: 14,
    fontSize: 14,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },
  footerNote: {
    textAlign: "center",
    marginTop: 22,
    color: "#94a3b8",
    fontSize: 13,
  },
};