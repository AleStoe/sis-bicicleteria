import { useEffect, useState } from "react";
import {
  corregirNumeroCuadroSerializada,
  listarCorreccionesNumeroCuadro,
} from "../../services/serializadasService";
import { normalizeTextUpper } from "../../utils/textNormalization";

function formatFecha(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("es-AR");
  } catch {
    return value;
  }
}

export default function CorregirNumeroCuadroModal({
  idBicicletaSerializada,
  numeroActual,
  contexto = "serializadas",
  onClose,
  onCorregido,
}) {
  const [numeroNuevo, setNumeroNuevo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function cargarHistorial() {
      if (!idBicicletaSerializada) return;

      try {
        setLoadingHistorial(true);
        const data = await listarCorreccionesNumeroCuadro(idBicicletaSerializada);
        if (!cancelado) setHistorial(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelado) setHistorial([]);
      } finally {
        if (!cancelado) setLoadingHistorial(false);
      }
    }

    cargarHistorial();

    return () => {
      cancelado = true;
    };
  }, [idBicicletaSerializada]);

  async function handleSubmit(e) {
    e.preventDefault();

    const normalizado = normalizeTextUpper(numeroNuevo);
    const motivoLimpio = motivo.trim();

    if (!normalizado) {
      setError("El nuevo número de cuadro es obligatorio");
      return;
    }

    if (!motivoLimpio) {
      setError("El motivo de corrección es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");

      const res = await corregirNumeroCuadroSerializada(
        idBicicletaSerializada,
        {
          numero_cuadro: normalizado,
          motivo: motivoLimpio,
        },
        { origen_accion: contexto }
      );

      onCorregido?.(res);
      onClose?.();
    } catch (err) {
      setError(err.message || "No se pudo corregir el número de cuadro");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <section style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header style={styles.header}>
          <div>
            <span style={styles.kicker}>Corrección auditada</span>
            <h2 style={styles.title}>Corregir número de cuadro</h2>
          </div>
          <button type="button" style={styles.close} onClick={onClose}>
            ×
          </button>
        </header>

        {error && <div style={styles.error}>Error: {error}</div>}

        <div style={styles.warning}>
          Esta acción corrige el número de cuadro de la misma unidad. No reemplaza
          la bicicleta asignada.
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.currentBox}>
            <span>Número actual</span>
            <strong>{numeroActual || "-"}</strong>
          </div>

          <label style={styles.field}>
            <span>Número nuevo</span>
            <input
              value={numeroNuevo}
              onChange={(e) => setNumeroNuevo(normalizeTextUpper(e.target.value))}
              style={styles.input}
              placeholder="Ej: JY25023453"
              autoFocus
            />
          </label>

          <label style={styles.field}>
            <span>Motivo</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={styles.textarea}
              placeholder="Ej: error de carga, se verificó el cuadro físico..."
            />
          </label>

          <section style={styles.history}>
            <h3>Correcciones de número de cuadro</h3>
            {loadingHistorial ? (
              <p>Cargando historial...</p>
            ) : historial.length === 0 ? (
              <p>Sin correcciones registradas.</p>
            ) : (
              <div style={styles.historyList}>
                {historial.map((item) => (
                  <article key={item.id} style={styles.historyItem}>
                    <strong>
                      {item.numero_cuadro_anterior || "-"} →{" "}
                      {item.numero_cuadro_nuevo || "-"}
                    </strong>
                    <span>
                      {formatFecha(item.fecha)} ·{" "}
                      {item.usuario_nombre || item.usuario_username || "Usuario"}
                    </span>
                    <small>{item.motivo || "-"}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div style={styles.actions}>
            <button type="button" style={styles.secondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" style={styles.primary} disabled={procesando}>
              {procesando ? "Guardando..." : "Guardar corrección"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, .58)",
    zIndex: 80,
    display: "grid",
    placeItems: "start center",
    padding: 20,
    overflowY: "auto",
  },
  modal: {
    width: "min(620px, 96vw)",
    background: "white",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 28px 80px rgba(15, 23, 42, .35)",
    border: "1px solid #e2e8f0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 12,
    marginBottom: 12,
  },
  kicker: {
    color: "#f97316",
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    fontSize: 12,
  },
  title: { margin: "3px 0 0", fontSize: 24, color: "#0f172a" },
  close: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 1000,
    cursor: "pointer",
  },
  warning: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#c2410c",
    borderRadius: 14,
    padding: 12,
    fontWeight: 800,
    marginBottom: 12,
  },
  error: {
    background: "#fff1f0",
    border: "1px solid #fecaca",
    color: "#b42318",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    fontWeight: 800,
  },
  form: { display: "grid", gap: 12 },
  currentBox: {
    display: "grid",
    gap: 4,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    borderRadius: 14,
    padding: 12,
  },
  field: { display: "grid", gap: 6, fontWeight: 900, color: "#334155" },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    fontWeight: 800,
    fontSize: 15,
  },
  textarea: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    fontWeight: 700,
    minHeight: 86,
    resize: "vertical",
    fontFamily: "inherit",
  },
  history: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
  },
  historyList: { display: "grid", gap: 8 },
  historyItem: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
    display: "grid",
    gap: 3,
  },
  actions: { display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 },
  secondary: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  primary: {
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 12,
    padding: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
};
