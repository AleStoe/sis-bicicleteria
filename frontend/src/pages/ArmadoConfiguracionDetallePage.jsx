import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Hammer, PlayCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { colors, radius, shadows, spacing } from "../theme";
import { formatMoney, formatNumber } from "../utils/formatters";
import {
  activarConfiguracionArmado,
  archivarConfiguracionArmado,
  crearOrdenArmado,
  eliminarItemConfiguracionArmado,
  listarSucursalesArmado,
  obtenerConfiguracionArmado,
  simularConfiguracionArmado,
} from "../services/armadoService";

export default function ArmadoConfiguracionDetallePage() {
  const { configuracionId } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [simulacion, setSimulacion] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function cargar(idSucursal = sucursalId) {
    setLoading(true);
    setError("");
    try {
      const [configData, sucursalesData] = await Promise.all([
        obtenerConfiguracionArmado(configuracionId),
        listarSucursalesArmado(),
      ]);
      setConfig(configData);
      setSucursales(sucursalesData);
      const idSucursalFinal = idSucursal || sucursalesData[0]?.id;
      if (idSucursalFinal) {
        setSucursalId(String(idSucursalFinal));
        const sim = await simularConfiguracionArmado({
          id_configuracion: Number(configuracionId),
          id_sucursal: Number(idSucursalFinal),
        });
        setSimulacion(sim);
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar la configuracion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [configuracionId]);

  async function cambiarSucursal(value) {
    setSucursalId(value);
    await cargar(value);
  }

  async function activar() {
    try {
      await activarConfiguracionArmado(configuracionId);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo activar la configuracion");
    }
  }

  async function archivar() {
    if (!window.confirm("¿Archivar esta configuracion de armado?")) return;
    try {
      await archivarConfiguracionArmado(configuracionId);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo archivar la configuracion");
    }
  }

  async function eliminarItem(itemId) {
    if (!window.confirm("¿Eliminar este componente de la configuracion en borrador?")) return;
    try {
      await eliminarItemConfiguracionArmado(configuracionId, itemId);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo eliminar el componente");
    }
  }

  async function crearOrden() {
    if (!sucursalId) {
      setError("Selecciona una sucursal para crear la orden de armado");
      return;
    }
    try {
      const orden = await crearOrdenArmado({
        id_configuracion: Number(configuracionId),
        id_sucursal: Number(sucursalId),
      });
      navigate(`/armado/ordenes/${orden.id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear la orden de armado");
    }
  }

  return (
    <div>
      <PageHeader
        title={config ? `${config.modelo_nombre} · ${config.version_nombre}` : "Configuracion de armado"}
        subtitle={config ? `${config.nombre} · revision tecnica #${config.numero_revision}` : "Detalle tecnico"}
        actions={
          <>
            <select value={sucursalId} onChange={(event) => cambiarSucursal(event.target.value)} style={styles.select}>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => cargar()}>
              <RefreshCw size={16} /> Refrescar
            </Button>
          </>
        }
      />

      {error ? <div style={styles.error}>{error}</div> : null}
      {loading ? <div style={styles.empty}>Cargando configuracion...</div> : null}

      {config ? (
        <>
          <section style={styles.summaryGrid}>
            <Metric title="Estado" value={config.estado} tone={config.estado === "activa" ? "success" : "warning"} />
            <Metric title="Costo estimado" value={formatMoney(config.costo_estimado_total)} />
            <Metric title="Fabricables hoy" value={simulacion?.cantidad_fabricable ?? "-"} tone="info" />
            <Metric title="Calculo" value={simulacion?.calculo_completo ? "Completo" : "Con avisos"} tone={simulacion?.calculo_completo ? "success" : "warning"} />
          </section>

          <section style={styles.notice}>
            La revision tecnica se asignara automaticamente por cada version comercial.
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.eyebrow}>Componentes</div>
                <h2 style={styles.title}>Receta tecnica</h2>
              </div>
              <div style={styles.actions}>
                <Link to={`/armado/configuraciones/${configuracionId}/simular`} style={styles.linkButton}>
                  <PlayCircle size={16} /> Abrir simulador
                </Link>
                {config.estado === "activa" ? (
                  <button type="button" onClick={crearOrden} style={styles.linkButton}>
                    <Hammer size={16} /> Crear Orden de Armado
                  </button>
                ) : null}
                {config.estado === "borrador" ? (
                  <button type="button" onClick={activar} style={styles.softButton}>
                    <CheckCircle2 size={16} /> Activar
                  </button>
                ) : null}
                {config.estado !== "archivada" ? (
                  <button type="button" onClick={archivar} style={styles.softButton}>
                    Archivar
                  </button>
                ) : null}
              </div>
            </div>

            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span>Componente</span>
                <span>Grupo</span>
                <span>Cantidad</span>
                <span>Costo</span>
                <span>Stock</span>
                <span>Accion</span>
              </div>
              {(simulacion?.componentes || config.items).map((item) => (
                <div key={item.id || item.id_variante} style={styles.row}>
                  <div>
                    <strong>{item.producto_nombre}</strong>
                    <small>{item.nombre_variante} · {item.sku || "Sin SKU"}</small>
                  </div>
                  <span>{item.grupo_tecnico || "-"}</span>
                  <span>{formatNumber(item.cantidad)}</span>
                  <span>
                    {item.subtotal_estimado !== null && item.subtotal_estimado !== undefined
                      ? formatMoney(item.subtotal_estimado)
                      : "Falta costo"}
                  </span>
                  <span>
                    {item.stock_disponible !== undefined
                      ? `${formatNumber(item.stock_disponible)} disp.`
                      : "-"}
                  </span>
                  <span>
                    {config.estado === "borrador" && item.id ? (
                      <button type="button" style={styles.iconButton} onClick={() => eliminarItem(item.id)}>
                        <Trash2 size={15} /> Quitar
                      </button>
                    ) : (
                      <span style={styles.muted}>Solo lectura</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {simulacion?.advertencias?.length ? (
            <section style={styles.warningBox}>
              <strong>Advertencias de simulacion</strong>
              {simulacion.advertencias.map((advertencia) => (
                <div key={advertencia}>{advertencia}</div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Metric({ title, value, tone = "neutral" }) {
  const palette = {
    neutral: [colors.surface, colors.border, colors.textStrong],
    success: [colors.successSoft, "#bbf7d0", colors.successDark],
    warning: [colors.warningSoft, "#fde68a", colors.warningDark],
    info: [colors.infoSoft, "#bfdbfe", colors.info],
  }[tone];
  return (
    <div style={{ ...styles.metric, background: palette[0], borderColor: palette[1], color: palette[2] }}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  select: { minHeight: 42, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 12px", fontWeight: 800, background: "#fff" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 12, marginBottom: spacing.lg },
  notice: { marginBottom: spacing.lg, padding: 12, border: `1px solid ${colors.infoSoft}`, borderRadius: radius.md, background: colors.infoSoft, color: colors.info, fontWeight: 900 },
  metric: { border: "1px solid", borderRadius: radius.lg, padding: 14, display: "grid", gap: 7, boxShadow: shadows.sm },
  panel: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: spacing.lg },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 },
  eyebrow: { color: colors.primary, fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  title: { margin: "4px 0 0", fontSize: 22, color: colors.textStrong },
  actions: { display: "flex", flexWrap: "wrap", gap: 8 },
  linkButton: { minHeight: 38, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: radius.md, background: colors.primary, color: "#fff", textDecoration: "none", fontWeight: 900 },
  softButton: { minHeight: 38, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: radius.md, background: "#fff", border: `1px solid ${colors.border}`, fontWeight: 900, cursor: "pointer" },
  iconButton: { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: "#fff", padding: "6px 8px", fontWeight: 800, cursor: "pointer" },
  table: { display: "grid", border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, overflow: "hidden" },
  tableHeader: { display: "grid", gridTemplateColumns: "2fr 1fr .7fr .9fr .9fr .8fr", gap: 10, padding: "10px 12px", background: colors.surfaceMuted, fontSize: 12, fontWeight: 900, color: colors.textMuted, textTransform: "uppercase" },
  row: { display: "grid", gridTemplateColumns: "2fr 1fr .7fr .9fr .9fr .8fr", gap: 10, alignItems: "center", padding: "12px", borderTop: `1px solid ${colors.borderSoft}` },
  muted: { color: colors.textMuted, fontSize: 13 },
  warningBox: { marginTop: 14, padding: 14, border: `1px solid ${colors.warning}`, borderRadius: radius.md, background: colors.warningSoft, color: colors.warningDark, display: "grid", gap: 4 },
  error: { marginBottom: 14, padding: 12, borderRadius: radius.md, background: colors.dangerSoft, color: colors.dangerDark, fontWeight: 800 },
  empty: { padding: 18, background: colors.surfaceMuted, borderRadius: radius.md, color: colors.textMuted, fontWeight: 800 },
};
