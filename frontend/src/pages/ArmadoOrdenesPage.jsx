import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, RefreshCw } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { colors, radius, shadows, spacing } from "../theme";
import { formatMoney, formatNumber } from "../utils/formatters";
import { listarOrdenesArmado } from "../services/armadoService";

const ESTADOS = [
  ["", "Todos"],
  ["borrador", "Borrador"],
  ["pendiente_componentes", "Pendiente componentes"],
  ["lista_para_armar", "Lista para armar"],
  ["cancelada", "Cancelada"],
];

export default function ArmadoOrdenesPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setOrdenes(await listarOrdenesArmado({ estado }));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ordenes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [estado]);

  return (
    <div>
      <PageHeader
        title="Ordenes de armado"
        subtitle="Borradores de fabricacion sin movimientos de stock ni bicicletas creadas."
        actions={
          <Button variant="outline" onClick={cargar}>
            <RefreshCw size={16} /> Refrescar
          </Button>
        }
      />

      {error ? <div style={styles.error}>{error}</div> : null}

      <section style={styles.filters}>
        <label style={styles.label}>
          Estado
          <select value={estado} onChange={(event) => setEstado(event.target.value)} style={styles.input}>
            {ESTADOS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <div style={styles.eyebrow}>Fabricacion</div>
            <h2 style={styles.title}>Ordenes cargadas</h2>
          </div>
          <span style={styles.count}>{ordenes.length}</span>
        </div>

        {loading ? (
          <div style={styles.empty}>Cargando ordenes...</div>
        ) : ordenes.length ? (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span>Orden</span>
              <span>Modelo</span>
              <span>Estado</span>
              <span>Disponibilidad</span>
              <span>Costo previsto</span>
              <span>Accion</span>
            </div>
            {ordenes.map((orden) => (
              <div key={orden.id} style={styles.row}>
                <div>
                  <strong>{orden.codigo}</strong>
                  <small>{orden.talle || "Sin talle"} · {orden.color || "Sin color"}</small>
                </div>
                <div>
                  <strong>{orden.modelo_nombre}</strong>
                  <small>{orden.version_nombre} · Rev. {orden.configuracion_revision}</small>
                </div>
                <span style={badgeFor(orden.estado)}>{labelEstado(orden.estado)}</span>
                <div>
                  <strong>{orden.cantidad_fabricable ?? "-"}</strong>
                  <small>{orden.advertencias?.length ? `${orden.advertencias.length} aviso(s)` : "Sin avisos"}</small>
                </div>
                <div>
                  <strong>{formatMoney(orden.costo_total_previsto)}</strong>
                  <small>{formatNumber(orden.items?.length || 0)} componente(s)</small>
                </div>
                <Link to={`/armado/ordenes/${orden.id}`} style={styles.linkButton}>
                  Ver orden
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.empty}>
            <Bike size={18} /> Todavia no hay ordenes de armado.
          </div>
        )}
      </section>
    </div>
  );
}

function labelEstado(estado) {
  return {
    borrador: "Borrador",
    pendiente_componentes: "Pendiente componentes",
    lista_para_armar: "Lista para armar",
    cancelada: "Cancelada",
  }[estado] || estado;
}

function badgeFor(estado) {
  const palette = {
    borrador: [colors.infoSoft, colors.info],
    pendiente_componentes: [colors.warningSoft, colors.warningDark],
    lista_para_armar: [colors.successSoft, colors.successDark],
    cancelada: [colors.dangerSoft, colors.dangerDark],
  }[estado] || [colors.surfaceMuted, colors.textMuted];
  return { ...styles.badge, background: palette[0], color: palette[1] };
}

const styles = {
  filters: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: spacing.lg, marginBottom: spacing.lg },
  label: { display: "grid", gap: 6, fontWeight: 900, color: colors.textStrong, maxWidth: 280 },
  input: { minHeight: 42, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 12px", fontWeight: 800, background: "#fff" },
  panel: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: spacing.lg },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 },
  eyebrow: { color: colors.primary, fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  title: { margin: "4px 0 0", fontSize: 22, color: colors.textStrong },
  count: { minWidth: 38, minHeight: 30, borderRadius: 999, background: colors.surfaceMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 },
  table: { display: "grid", border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, overflow: "hidden" },
  tableHeader: { display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr 1fr .8fr", gap: 10, padding: "10px 12px", background: colors.surfaceMuted, fontSize: 12, fontWeight: 900, color: colors.textMuted, textTransform: "uppercase" },
  row: { display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr 1fr .8fr", gap: 10, alignItems: "center", padding: 12, borderTop: `1px solid ${colors.borderSoft}` },
  badge: { display: "inline-flex", justifyContent: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  linkButton: { minHeight: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 10px", borderRadius: radius.md, background: colors.primary, color: "#fff", textDecoration: "none", fontWeight: 900 },
  empty: { padding: 18, background: colors.surfaceMuted, borderRadius: radius.md, color: colors.textMuted, fontWeight: 800, display: "flex", gap: 8, alignItems: "center" },
  error: { marginBottom: 14, padding: 12, borderRadius: radius.md, background: colors.dangerSoft, color: colors.dangerDark, fontWeight: 800 },
};
