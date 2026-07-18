import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, Plus, RefreshCw } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { colors, radius, shadows, spacing } from "../theme";
import { formatMoney } from "../utils/formatters";
import {
  cambiarEstadoModeloArmado,
  crearModeloArmado,
  listarModelosArmado,
} from "../services/armadoService";

export default function ArmadoPage() {
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", descripcion: "" });

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setModelos(await listarModelosArmado({ incluir_inactivos: true }));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los modelos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(event) {
    event.preventDefault();
    if (!form.nombre.trim()) return;
    setError("");
    try {
      await crearModeloArmado(form);
      setForm({ nombre: "", descripcion: "" });
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo crear el modelo");
    }
  }

  async function cambiarEstado(modelo) {
    try {
      await cambiarEstadoModeloArmado(modelo.id, { activo: !modelo.activo });
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el modelo");
    }
  }

  return (
    <div>
      <PageHeader
        title="Armado de bicicletas"
        subtitle="Modelos, versiones y configuraciones tecnicas para fabricar bicis propias."
        actions={
          <Button variant="outline" onClick={cargar}>
            <RefreshCw size={16} /> Refrescar
          </Button>
        }
      />

      {error ? <div style={styles.error}>{error}</div> : null}

      <section style={styles.grid}>
        <form onSubmit={crear} style={styles.panel}>
          <div style={styles.eyebrow}>Nuevo modelo</div>
          <h2 style={styles.panelTitle}>Modelo comercial</h2>
          <label style={styles.label}>
            Nombre
            <input
              value={form.nombre}
              onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
              placeholder="Ej: Agus R29"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Descripcion
            <textarea
              value={form.descripcion}
              onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
              placeholder="Linea, uso o criterio comercial"
              style={{ ...styles.input, minHeight: 90 }}
            />
          </label>
          <Button type="submit" fullWidth>
            <Plus size={16} /> Crear modelo
          </Button>
        </form>

        <div style={styles.panel}>
          <div style={styles.eyebrow}>Listado</div>
          <h2 style={styles.panelTitle}>Modelos cargados</h2>
          {loading ? (
            <div style={styles.empty}>Cargando modelos...</div>
          ) : modelos.length ? (
            <div style={styles.cards}>
              {modelos.map((modelo) => (
                <article key={modelo.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <Bike size={20} color={colors.primary} />
                    <div style={{ minWidth: 0 }}>
                      <h3 style={styles.cardTitle}>{modelo.nombre}</h3>
                      <p style={styles.muted}>{modelo.descripcion || "Sin descripcion"}</p>
                    </div>
                    <span style={modelo.activo ? styles.badgeOk : styles.badgeMuted}>
                      {modelo.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div style={styles.metrics}>
                    <Metric label="Versiones" value={modelo.versiones_activas ?? modelo.versiones ?? 0} />
                    <Metric label="Costo min." value={modelo.costo_estimado_min ? formatMoney(modelo.costo_estimado_min) : "-"} />
                    <Metric label="Costo max." value={modelo.costo_estimado_max ? formatMoney(modelo.costo_estimado_max) : "-"} />
                  </div>
                  <div style={styles.actions}>
                    <Link to={`/armado/modelos/${modelo.id}`} style={styles.linkButton}>
                      Ver modelo
                    </Link>
                    <button type="button" onClick={() => cambiarEstado(modelo)} style={styles.softButton}>
                      {modelo.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>Todavia no hay modelos de armado.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
    gap: spacing.lg,
    alignItems: "start",
  },
  panel: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    padding: spacing.lg,
  },
  eyebrow: { color: colors.primary, fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  panelTitle: { margin: "4px 0 14px", fontSize: 22, color: colors.textStrong },
  label: { display: "grid", gap: 6, fontWeight: 800, color: colors.textStrong, marginBottom: 12 },
  input: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    minHeight: 42,
    padding: "10px 12px",
    fontWeight: 700,
  },
  cards: { display: "grid", gap: 12 },
  card: { border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 14, background: "#fff" },
  cardHeader: { display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "start" },
  cardTitle: { margin: 0, fontSize: 18, color: colors.textStrong },
  muted: { margin: "4px 0 0", color: colors.textMuted, fontSize: 13 },
  badgeOk: { ...badgeBase(), background: "#dcfce7", color: "#047857" },
  badgeMuted: { ...badgeBase(), background: "#f1f5f9", color: "#64748b" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 },
  metric: { background: "#f8fafc", borderRadius: radius.sm, padding: 10, display: "grid", gap: 4 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  linkButton: {
    minHeight: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: radius.md,
    background: colors.primary,
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
  },
  softButton: {
    minHeight: 38,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  error: { marginBottom: 14, padding: 12, borderRadius: radius.md, background: "#fef2f2", color: "#b91c1c", fontWeight: 800 },
  empty: { padding: 18, background: "#f8fafc", borderRadius: radius.md, color: colors.textMuted, fontWeight: 800 },
};

function badgeBase() {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
  };
}
