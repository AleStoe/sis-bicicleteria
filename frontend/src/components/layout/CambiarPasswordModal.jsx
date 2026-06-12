import { useState } from "react";
import { cambiarPasswordPropia } from "../../services/usuariosService";
import { useSession } from "../../context/SessionContext";

export default function CambiarPasswordModal({ open, onClose }) {
  const { usuarioActual } = useSession();
  const [form, setForm] = useState({
    password_actual: "",
    password_nueva: "",
    repetir_password_nueva: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  if (!open) return null;

  function actualizarCampo(event) {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  }

  async function guardar(event) {
    event.preventDefault();
    setError("");
    setOk("");

    if (!usuarioActual?.id) {
      setError("No se pudo identificar el usuario actual.");
      return;
    }

    if (form.password_nueva !== form.repetir_password_nueva) {
      setError("La nueva contraseña y la repetición no coinciden.");
      return;
    }

    if (form.password_actual === form.password_nueva) {
      setError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    try {
      setGuardando(true);

      await cambiarPasswordPropia(usuarioActual.id, {
        password_actual: form.password_actual,
        password_nueva: form.password_nueva,
      });

      setOk("Contraseña actualizada correctamente.");
      setForm({
        password_actual: "",
        password_nueva: "",
        repetir_password_nueva: "",
      });
    } catch (err) {
      setError(err.message || "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Cambiar contraseña</h2>
            <p style={styles.subtitle}>
              Actualizá tu contraseña de acceso al sistema.
            </p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <form onSubmit={guardar} style={styles.form}>
          <label style={styles.label}>
            Contraseña actual
            <input
              type="password"
              name="password_actual"
              value={form.password_actual}
              onChange={actualizarCampo}
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Nueva contraseña
            <input
              type="password"
              name="password_nueva"
              value={form.password_nueva}
              onChange={actualizarCampo}
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Repetir nueva contraseña
            <input
              type="password"
              name="repetir_password_nueva"
              value={form.repetir_password_nueva}
              onChange={actualizarCampo}
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              style={styles.input}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}
          {ok && <div style={styles.ok}>{ok}</div>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.secondaryButton}>
              Cancelar
            </button>

            <button type="submit" disabled={guardando} style={styles.primaryButton}>
              {guardando ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "rgba(15, 23, 42, 0.55)",
  },
  modal: {
    width: "min(460px, 100%)",
    borderRadius: 20,
    background: "white",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
    padding: 22,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 1000,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
  },
  closeButton: {
    border: "none",
    background: "#f1f5f9",
    color: "#0f172a",
    borderRadius: 12,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontSize: 26,
    lineHeight: "32px",
    fontWeight: 900,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 7,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    fontSize: 15,
    outline: "none",
  },
  error: {
    borderRadius: 12,
    background: "#fef2f2",
    color: "#991b1b",
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 13,
  },
  ok: {
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#065f46",
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 13,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: "10px 13px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 12,
    padding: "10px 13px",
    fontWeight: 1000,
    cursor: "pointer",
  },
};