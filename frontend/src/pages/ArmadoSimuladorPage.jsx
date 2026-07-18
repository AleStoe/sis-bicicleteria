import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calculator, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { colors, radius, shadows, spacing } from "../theme";
import { formatMoney, formatNumber, formatPercent } from "../utils/formatters";
import { listarCatalogoPOS } from "../services/catalogoService";
import {
  listarSucursalesArmado,
  obtenerConfiguracionArmado,
  simularConfiguracionArmado,
} from "../services/armadoService";

export default function ArmadoSimuladorPage() {
  const { configuracionId } = useParams();
  const [config, setConfig] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState("");
  const [componentes, setComponentes] = useState([]);
  const [simulacion, setSimulacion] = useState(null);
  const [extras, setExtras] = useState({
    costo_mano_obra: "0",
    costo_consumibles_no_inventariados: "0",
    costo_trabajos_externos: "0",
    otros_costos: "0",
    precio_comercial: "",
    margen_objetivo: "35",
  });
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const payload = useMemo(() => ({
    id_configuracion: Number(configuracionId),
    id_sucursal: Number(sucursalId),
    componentes: componentes.map((item) => ({
      id_variante: Number(item.id_variante),
      cantidad: String(item.cantidad || "1"),
      grupo_tecnico: item.grupo_tecnico || null,
      opcional: Boolean(item.opcional),
    })),
    costo_mano_obra: extras.costo_mano_obra || "0",
    costo_consumibles_no_inventariados: extras.costo_consumibles_no_inventariados || "0",
    costo_trabajos_externos: extras.costo_trabajos_externos || "0",
    otros_costos: extras.otros_costos || "0",
    precio_comercial: extras.precio_comercial || null,
    margen_objetivo: extras.margen_objetivo || null,
  }), [configuracionId, sucursalId, componentes, extras]);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [configData, sucursalesData] = await Promise.all([
        obtenerConfiguracionArmado(configuracionId),
        listarSucursalesArmado(),
      ]);
      const sucursal = sucursalId || sucursalesData[0]?.id;
      setConfig(configData);
      setSucursales(sucursalesData);
      setSucursalId(String(sucursal || ""));
      setComponentes(configData.items.map((item) => ({
        id_variante: item.id_variante_componente,
        producto_nombre: item.producto_nombre,
        nombre_variante: item.nombre_variante,
        sku: item.sku,
        cantidad: item.cantidad,
        grupo_tecnico: item.grupo_tecnico,
        opcional: false,
      })));
    } catch (err) {
      setError(err.message || "No se pudo cargar el simulador");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [configuracionId]);

  useEffect(() => {
    if (!sucursalId || !componentes.length) return;
    calcular();
  }, [payload]);

  async function calcular() {
    try {
      setError("");
      setSimulacion(await simularConfiguracionArmado(payload));
    } catch (err) {
      setError(err.message || "No se pudo simular");
    }
  }

  async function buscar() {
    const q = busqueda.trim();
    if (!q || !sucursalId) return;
    try {
      const data = await listarCatalogoPOS({
        id_sucursal: sucursalId,
        query: q,
        limit: 10,
        offset: 0,
      });
      setResultados(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || "No se pudo buscar componentes");
    }
  }

  function agregarResultado(item) {
    const idVariante = item.id_variante || item.variante_id || item.id;
    if (!idVariante || componentes.some((actual) => Number(actual.id_variante) === Number(idVariante))) {
      return;
    }
    setComponentes((prev) => [
      ...prev,
      {
        id_variante: idVariante,
        producto_nombre: item.producto_nombre,
        nombre_variante: item.nombre_variante,
        sku: item.sku,
        cantidad: "1",
        grupo_tecnico: "",
        opcional: false,
      },
    ]);
    setBusqueda("");
    setResultados([]);
  }

  function actualizarComponente(index, patch) {
    setComponentes((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  function quitarComponente(index) {
    setComponentes((prev) => prev.filter((_, idx) => idx !== index));
  }

  return (
    <div>
      <PageHeader
        title="Simulador de armado"
        subtitle={config ? `${config.modelo_nombre} · ${config.version_nombre} · ${config.nombre}` : "Costos y disponibilidad sin guardar cambios"}
        actions={
          <>
            <Link to={`/armado/configuraciones/${configuracionId}`} style={styles.softLink}>
              Volver a configuracion
            </Link>
            <Button variant="outline" onClick={cargar}>
              <RefreshCw size={16} /> Reiniciar
            </Button>
          </>
        }
      />

      {error ? <div style={styles.error}>{error}</div> : null}
      {loading ? <div style={styles.empty}>Cargando simulador...</div> : null}

      <section style={styles.layout}>
        <div style={styles.panel}>
          <div style={styles.eyebrow}>Componentes temporales</div>
          <h2 style={styles.title}>Receta simulada</h2>
          <div style={styles.table}>
            {componentes.map((item, index) => (
              <div key={`${item.id_variante}-${index}`} style={styles.row}>
                <div>
                  <strong>{item.producto_nombre}</strong>
                  <small>{item.nombre_variante} · {item.sku || "Sin SKU"}</small>
                </div>
                <input
                  value={item.cantidad}
                  onChange={(event) => actualizarComponente(index, { cantidad: event.target.value })}
                  style={styles.smallInput}
                />
                <label style={styles.check}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.opcional)}
                    onChange={(event) => actualizarComponente(index, { opcional: event.target.checked })}
                  />
                  Opcional
                </label>
                <button type="button" onClick={() => quitarComponente(index)} style={styles.iconButton}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div style={styles.searchBox}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar componente por nombre, SKU o codigo..."
                style={styles.input}
                onKeyDown={(event) => {
                  if (event.key === "Enter") buscar();
                }}
              />
              <Button variant="outline" onClick={buscar}>
                <Search size={16} /> Buscar
              </Button>
            </div>
            {resultados.length ? (
              <div style={styles.results}>
                {resultados.map((item) => (
                  <button key={item.id_variante || item.id} type="button" style={styles.result} onClick={() => agregarResultado(item)}>
                    <strong>{item.producto_nombre}</strong>
                    <span>{item.nombre_variante} · Stock {item.stock_disponible ?? item.disponible ?? "-"}</span>
                    <Plus size={16} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <aside style={styles.panel}>
          <div style={styles.eyebrow}>Calculo</div>
          <h2 style={styles.title}>Costos y precio</h2>
          <select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)} style={styles.input}>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
            ))}
          </select>
          <MoneyInput label="Mano de obra" value={extras.costo_mano_obra} onChange={(value) => setExtras((prev) => ({ ...prev, costo_mano_obra: value }))} />
          <MoneyInput label="Consumibles no inventariados" value={extras.costo_consumibles_no_inventariados} onChange={(value) => setExtras((prev) => ({ ...prev, costo_consumibles_no_inventariados: value }))} />
          <MoneyInput label="Trabajos externos" value={extras.costo_trabajos_externos} onChange={(value) => setExtras((prev) => ({ ...prev, costo_trabajos_externos: value }))} />
          <MoneyInput label="Otros costos" value={extras.otros_costos} onChange={(value) => setExtras((prev) => ({ ...prev, otros_costos: value }))} />
          <MoneyInput label="Precio comercial" value={extras.precio_comercial} onChange={(value) => setExtras((prev) => ({ ...prev, precio_comercial: value }))} />
          <MoneyInput label="Margen objetivo %" value={extras.margen_objetivo} onChange={(value) => setExtras((prev) => ({ ...prev, margen_objetivo: value }))} />
        </aside>
      </section>

      {simulacion ? (
        <section style={styles.resultPanel}>
          <div style={styles.summary}>
            <Metric label="Costo total" value={formatMoney(simulacion.costo_total)} />
            <Metric label="Fabricables" value={simulacion.cantidad_fabricable ?? "-"} />
            <Metric label="Precio sugerido" value={simulacion.precio_sugerido ? formatMoney(simulacion.precio_sugerido) : "-"} />
            <Metric label="Utilidad estimada" value={simulacion.utilidad_estimada ? formatMoney(simulacion.utilidad_estimada) : "-"} />
            <Metric label="Margen sobre venta" value={simulacion.margen_sobre_venta ? formatPercent(simulacion.margen_sobre_venta) : "-"} />
          </div>

          <div style={styles.componentsGrid}>
            {simulacion.componentes.map((item) => (
              <article key={item.id_variante} style={styles.componentCard}>
                <strong>{item.producto_nombre}</strong>
                <span>{item.grupo_tecnico} · {formatNumber(item.cantidad)} u.</span>
                <span>{item.estado_costo} · {item.estado_disponibilidad}</span>
                <b>{item.subtotal_estimado ? formatMoney(item.subtotal_estimado) : "Falta costo"}</b>
              </article>
            ))}
          </div>

          {simulacion.advertencias?.length ? (
            <div style={styles.warningBox}>
              {simulacion.advertencias.map((advertencia) => (
                <div key={advertencia}>{advertencia}</div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MoneyInput({ label, value, onChange }) {
  return (
    <label style={styles.label}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
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
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, .8fr)", gap: spacing.lg, alignItems: "start" },
  panel: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: spacing.lg },
  eyebrow: { color: colors.primary, fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  title: { margin: "4px 0 14px", fontSize: 22, color: colors.textStrong },
  table: { display: "grid", gap: 8 },
  row: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 110px auto", gap: 10, alignItems: "center", border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: 10 },
  smallInput: { minHeight: 38, border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: "6px 8px", fontWeight: 800 },
  input: { width: "100%", minHeight: 40, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 10px", fontWeight: 800, background: "#fff" },
  label: { display: "grid", gap: 6, marginTop: 10, fontWeight: 800 },
  check: { display: "flex", alignItems: "center", gap: 6, fontWeight: 800 },
  iconButton: { minHeight: 36, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: "#fff", cursor: "pointer" },
  searchBox: { marginTop: 14, padding: 12, borderRadius: radius.md, background: colors.surfaceMuted },
  results: { display: "grid", gap: 8, marginTop: 10 },
  result: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 4, textAlign: "left", padding: 10, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: "#fff", cursor: "pointer" },
  resultPanel: { marginTop: spacing.lg, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: spacing.lg },
  summary: { display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: 10 },
  metric: { background: colors.surfaceMuted, borderRadius: radius.md, padding: 12, display: "grid", gap: 6 },
  componentsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 14 },
  componentCard: { border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: 12, display: "grid", gap: 5 },
  softLink: { minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: radius.md, background: "#fff", color: colors.textStrong, border: `1px solid ${colors.border}`, textDecoration: "none", fontWeight: 900 },
  warningBox: { marginTop: 14, padding: 12, borderRadius: radius.md, background: colors.warningSoft, color: colors.warningDark, fontWeight: 800 },
  error: { marginBottom: 14, padding: 12, borderRadius: radius.md, background: colors.dangerSoft, color: colors.dangerDark, fontWeight: 800 },
  empty: { padding: 18, background: colors.surfaceMuted, borderRadius: radius.md, color: colors.textMuted, fontWeight: 800 },
};
