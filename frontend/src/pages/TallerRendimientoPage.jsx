import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Clipboard, RefreshCw, Search, X } from "lucide-react";
import { obtenerRendimientoTaller } from "../services/tallerService";
import { getPaqueteTrabajoTallerUrl } from "../services/documentosService";
import { formatDate, formatMoney } from "../utils/formatters";
import { copyTextToClipboard } from "../utils/clipboard";
import { EstadoBadge } from "./TallerListPage";

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "ingresada", label: "Ingresadas" },
  { value: "presupuestada", label: "Presupuestadas" },
  { value: "esperando_aprobacion", label: "Esperando aprobacion" },
  { value: "esperando_repuestos", label: "Esperando repuestos" },
  { value: "en_reparacion", label: "En reparacion" },
  { value: "terminada", label: "Terminadas" },
  { value: "facturada", label: "Facturadas" },
  { value: "lista_para_retirar", label: "Listas retiro" },
  { value: "retirada", label: "Retiradas" },
];

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function emptySummary() {
  return {
    ordenes: 0,
    items: 0,
    servicios: 0,
    repuestos: 0,
    items_sin_costo: 0,
    mano_obra: 0,
    repuestos_venta: 0,
    repuestos_sin_costo_venta: 0,
    costo_repuestos: 0,
    margen_repuestos: 0,
    total_cliente: 0,
    ganancia_estimada: 0,
  };
}

function buildSummary(rows) {
  return rows.reduce((acc, row) => {
    acc.ordenes += 1;
    acc.items += numberValue(row.items);
    acc.servicios += numberValue(row.servicios);
    acc.repuestos += numberValue(row.repuestos);
    acc.items_sin_costo += numberValue(row.items_sin_costo);
    acc.mano_obra += numberValue(row.mano_obra);
    acc.repuestos_venta += numberValue(row.repuestos_venta);
    acc.repuestos_sin_costo_venta += numberValue(row.repuestos_sin_costo_venta);
    acc.costo_repuestos += numberValue(row.costo_repuestos);
    acc.margen_repuestos += numberValue(row.margen_repuestos);
    acc.total_cliente += numberValue(row.total_cliente);
    acc.ganancia_estimada += numberValue(row.ganancia_estimada);
    return acc;
  }, emptySummary());
}

export default function TallerRendimientoPage() {
  const [data, setData] = useState({ resumen: emptySummary(), ordenes: [] });
  const [estado, setEstado] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");
      const response = await obtenerRendimientoTaller({
        estado,
        solo_pendientes: soloPendientes,
      });
      setData(response || { resumen: emptySummary(), ordenes: [] });
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo cargar rendimiento de taller");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [estado, soloPendientes]);

  const ordenes = data?.ordenes || [];
  const ordenesFiltradas = useMemo(() => {
    const q = normalize(busqueda);
    if (!q) return ordenes;

    return ordenes.filter((orden) =>
      normalize([
        orden.id,
        orden.cliente_nombre,
        orden.bicicleta_descripcion,
        orden.bicicleta_numero_cuadro,
        orden.problema_reportado,
      ].filter(Boolean).join(" ")).includes(q)
    );
  }, [ordenes, busqueda]);

  useEffect(() => {
    const visibles = new Set(ordenesFiltradas.map((orden) => String(orden.id)));
    setSeleccionadas((actuales) => actuales.filter((id) => visibles.has(String(id))));
  }, [ordenesFiltradas]);

  const resumenFiltrado = useMemo(() => buildSummary(ordenesFiltradas), [ordenesFiltradas]);
  const seleccionSet = useMemo(() => new Set(seleccionadas.map(String)), [seleccionadas]);
  const ordenesSeleccionadas = useMemo(
    () => ordenesFiltradas.filter((orden) => seleccionSet.has(String(orden.id))),
    [ordenesFiltradas, seleccionSet],
  );
  const resumenSeleccionado = useMemo(
    () => buildSummary(ordenesSeleccionadas),
    [ordenesSeleccionadas],
  );

  function toggleOrden(id) {
    const key = String(id);
    setSeleccionadas((actuales) =>
      actuales.includes(key)
        ? actuales.filter((item) => item !== key)
        : [...actuales, key]
    );
  }

  function toggleTodas() {
    if (seleccionadas.length === ordenesFiltradas.length) {
      setSeleccionadas([]);
      return;
    }
    setSeleccionadas(ordenesFiltradas.map((orden) => String(orden.id)));
  }

  function limpiarSeleccion() {
    setSeleccionadas([]);
    setMensaje("");
  }

  async function copiarPaquete() {
    if (!ordenesSeleccionadas.length) return;

    const lineas = [
      "Paquete de trabajo - Taller",
      "",
      `OT seleccionadas: ${resumenSeleccionado.ordenes}`,
      `Mano de obra: ${formatMoney(resumenSeleccionado.mano_obra)}`,
      `Repuestos venta: ${formatMoney(resumenSeleccionado.repuestos_venta)}`,
      `Repuestos pendientes de costear: ${formatMoney(resumenSeleccionado.repuestos_sin_costo_venta)}`,
      `Costo repuestos: ${formatMoney(resumenSeleccionado.costo_repuestos)}`,
      `Margen repuestos: ${formatMoney(resumenSeleccionado.margen_repuestos)}`,
      `Ganancia confirmada: ${formatMoney(resumenSeleccionado.ganancia_estimada)}`,
      "",
      "Detalle:",
      ...ordenesSeleccionadas.map((orden) => (
        `- OT #${orden.id} - ${orden.cliente_nombre || "Cliente sin nombre"} - ${orden.bicicleta_descripcion || "Bicicleta sin descripcion"} - MO ${formatMoney(orden.mano_obra)} - Ganancia confirmada ${formatMoney(orden.ganancia_estimada)}${numberValue(orden.items_sin_costo) > 0 ? ` - Pendiente costear ${formatMoney(orden.repuestos_sin_costo_venta)}` : ""}`
      )),
    ];

    try {
      const copied = await copyTextToClipboard(lineas.join("\n"));
      setMensaje(
        copied
          ? "Resumen del paquete copiado al portapapeles"
          : "Resumen preparado para copiar manualmente"
      );
    } catch {
      setError("No se pudo copiar el resumen del paquete");
    }
  }

  function abrirPdfPaquete() {
    if (!ordenesSeleccionadas.length) return;
    window.open(
      getPaqueteTrabajoTallerUrl(ordenesSeleccionadas.map((orden) => orden.id)),
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Taller / rendimiento</p>
          <h1 style={styles.title}>Rendimiento por OT</h1>
          <p style={styles.subtitle}>
            Mirá mano de obra, repuestos y margen confirmado por trabajo.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" onClick={cargar} style={styles.secondaryButton}>
            <RefreshCw size={17} /> Refrescar
          </button>
          <Link to="/taller" style={styles.secondaryButton}>
            <ArrowLeft size={17} /> Volver a taller
          </Link>
        </div>
      </header>

      {error ? <div style={styles.error}>{error}</div> : null}
      {mensaje ? <div style={styles.success}>{mensaje}</div> : null}

      <section style={styles.summaryGrid}>
        <Metric title="Ganancia confirmada" value={formatMoney(resumenFiltrado.ganancia_estimada)} tone="success" />
        <Metric title="Mano de obra" value={formatMoney(resumenFiltrado.mano_obra)} tone="orange" />
        <Metric title="Margen repuestos" value={formatMoney(resumenFiltrado.margen_repuestos)} tone="info" />
        <Metric title="Pendiente costear" value={formatMoney(resumenFiltrado.repuestos_sin_costo_venta)} tone="warning" />
        <Metric title="Total cliente" value={formatMoney(resumenFiltrado.total_cliente)} />
        <Metric title="OTs" value={resumenFiltrado.ordenes} />
      </section>

      <section style={styles.controls}>
        <label style={styles.searchBox}>
          <Search size={18} />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar OT, cliente, bici, cuadro o problema..."
            style={styles.searchInput}
          />
        </label>
        <select value={estado} onChange={(event) => setEstado(event.target.value)} style={styles.select}>
          {ESTADOS.map((item) => (
            <option key={item.value || "todos"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(event) => setSoloPendientes(event.target.checked)}
          />
          Solo taller activo
        </label>
      </section>

      <section style={styles.selectionPanel}>
        <div>
          <p style={styles.eyebrow}>Paquete seleccionado</p>
          <h2 style={styles.panelTitle}>
            {resumenSeleccionado.ordenes > 0
              ? `${resumenSeleccionado.ordenes} OT para evaluar`
              : "Seleccioná OTs para armar un paquete"}
          </h2>
          <p style={styles.selectionHint}>
            {resumenSeleccionado.ordenes > 0
              ? "Resumen listo para copiar, comparar o preparar el reparto de trabajo."
              : "Marcá las órdenes que querés juntar y el sistema suma el potencial."}
          </p>
        </div>
        <div style={styles.selectionMetrics}>
          <Mini label="Mano de obra" value={formatMoney(resumenSeleccionado.mano_obra)} />
          <Mini label="Repuestos venta" value={formatMoney(resumenSeleccionado.repuestos_venta)} />
          <Mini label="Costo repuestos" value={formatMoney(resumenSeleccionado.costo_repuestos)} />
          <Mini label="Pendiente costear" value={formatMoney(resumenSeleccionado.repuestos_sin_costo_venta)} />
          <Mini label="Ganancia confirmada" value={formatMoney(resumenSeleccionado.ganancia_estimada)} strong />
        </div>
        <div style={styles.selectionActions}>
          <button
            type="button"
            disabled={!ordenesSeleccionadas.length}
            onClick={abrirPdfPaquete}
            style={{
              ...styles.primaryDarkButton,
              opacity: ordenesSeleccionadas.length ? 1 : 0.45,
              cursor: ordenesSeleccionadas.length ? "pointer" : "not-allowed",
            }}
          >
            PDF hoja de ruta
          </button>
          <button
            type="button"
            disabled={!ordenesSeleccionadas.length}
            onClick={copiarPaquete}
            style={{
              ...styles.clearDarkButton,
              opacity: ordenesSeleccionadas.length ? 1 : 0.45,
              cursor: ordenesSeleccionadas.length ? "pointer" : "not-allowed",
            }}
          >
            <Clipboard size={17} /> Copiar resumen
          </button>
          <button
            type="button"
            disabled={!ordenesSeleccionadas.length}
            onClick={limpiarSeleccion}
            style={{
              ...styles.clearDarkButton,
              opacity: ordenesSeleccionadas.length ? 1 : 0.45,
              cursor: ordenesSeleccionadas.length ? "pointer" : "not-allowed",
            }}
          >
            Limpiar paquete
          </button>
        </div>
        {ordenesSeleccionadas.length > 0 ? (
          <div style={styles.selectedList}>
            {ordenesSeleccionadas.map((orden) => (
              <span key={orden.id} style={styles.selectedChip}>
                OT #{orden.id} · {orden.cliente_nombre || "Sin cliente"}
                <button
                  type="button"
                  onClick={() => toggleOrden(orden.id)}
                  style={styles.selectedChipButton}
                  aria-label={`Quitar OT ${orden.id}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section style={styles.tableCard}>
        <div style={styles.tableTop}>
          <div>
            <h2 style={styles.panelTitle}>Ordenes</h2>
            <p style={styles.muted}>
              {loading ? "Cargando..." : `${ordenesFiltradas.length} resultado(s)`}
            </p>
          </div>
          <button
            type="button"
            disabled={!ordenesFiltradas.length}
            onClick={toggleTodas}
            style={styles.secondaryButton}
          >
            {seleccionadas.length === ordenesFiltradas.length ? "Limpiar selección" : "Seleccionar visibles"}
          </button>
        </div>

        {loading ? (
          <div style={styles.empty}>Cargando rendimiento de taller...</div>
        ) : ordenesFiltradas.length === 0 ? (
          <div style={styles.empty}>No hay OTs para esos filtros.</div>
        ) : (
          <div style={styles.rows}>
            {ordenesFiltradas.map((orden) => (
              <OrdenRow
                key={orden.id}
                orden={orden}
                selected={seleccionSet.has(String(orden.id))}
                onToggle={() => toggleOrden(orden.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ title, value, tone = "neutral" }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Mini({ label, value, strong = false }) {
  return (
    <div style={strong ? styles.miniStrong : styles.mini}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OrdenRow({ orden, selected, onToggle }) {
  const sinCosto = numberValue(orden.items_sin_costo) > 0;

  return (
    <article style={selected ? styles.rowSelected : styles.row}>
      <label style={styles.checkCell}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </label>
      <div style={styles.orderMain}>
        <div style={styles.orderTitleLine}>
          <Link to={`/taller/${orden.id}`} style={styles.orderLink}>OT #{orden.id}</Link>
          <EstadoBadge estado={orden.estado} />
          {orden.prioridad === "urgente" ? <span style={styles.urgent}>Urgente</span> : null}
        </div>
        <strong>{orden.cliente_nombre || "Cliente sin nombre"}</strong>
        <p>{orden.bicicleta_descripcion || "Bicicleta sin descripcion"}</p>
        <small>
          Ingreso {formatDate(orden.fecha_ingreso)}
          {orden.fecha_prometida ? ` · Prometida ${formatDate(orden.fecha_prometida)}` : ""}
          {numberValue(orden.dias_demorados) > 0 ? ` · ${orden.dias_demorados} dia(s) demorada` : ""}
        </small>
      </div>
      <div style={styles.problem}>{orden.problema_reportado}</div>
      <div style={styles.moneyGrid}>
        <Amount label="Mano de obra" value={orden.mano_obra} />
        <Amount label="Rep. venta" value={orden.repuestos_venta} />
        <Amount label="Costo rep." value={orden.costo_repuestos} />
        <Amount
          label={sinCosto ? "Confirmada" : "Ganancia"}
          value={orden.ganancia_estimada}
          strong
        />
      </div>
      <div style={styles.flags}>
        <span>{orden.items} item(s)</span>
        <span>{orden.servicios} servicio(s)</span>
        <span>{orden.repuestos} repuesto(s)</span>
        {sinCosto ? (
          <>
          <span style={styles.warning}>
            <AlertTriangle size={14} /> {orden.items_sin_costo} sin costo
          </span>
          <span style={styles.warningSoft}>Pendiente {formatMoney(orden.repuestos_sin_costo_venta)}</span>
          </>
        ) : null}
      </div>
    </article>
  );
}

function Amount({ label, value, strong = false }) {
  return (
    <div style={strong ? styles.amountStrong : styles.amount}>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </div>
  );
}

const styles = {
  page: { display: "grid", gap: 18, padding: 20, color: "#0f172a" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 10px 26px rgba(15,23,42,.06)",
  },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  title: { margin: "4px 0 0", fontSize: 34, fontWeight: 900, letterSpacing: 0 },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontWeight: 700 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  secondaryButton: {
    minHeight: 42,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 12,
    padding: "10px 13px",
    fontWeight: 800,
    textDecoration: "none",
    cursor: "pointer",
  },
  error: { border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 14, padding: 12, fontWeight: 800 },
  success: { border: "1px solid #86efac", background: "#ecfdf5", color: "#047857", borderRadius: 14, padding: 12, fontWeight: 800 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 },
  metric: { background: "#ffffff", border: "1px solid #dbe3ef", borderRadius: 16, padding: 15, display: "grid", gap: 6, boxShadow: "0 8px 20px rgba(15,23,42,.05)" },
  metricTones: {
    success: { background: "#ecfdf5", borderColor: "#86efac", color: "#047857" },
    orange: { background: "#fff7ed", borderColor: "#fed7aa", color: "#c2410c" },
    info: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" },
    warning: { background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" },
  },
  controls: { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 230px 180px", gap: 12, alignItems: "center" },
  searchBox: { minHeight: 48, display: "flex", alignItems: "center", gap: 10, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 14, padding: "0 14px" },
  searchInput: { width: "100%", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0f172a" },
  select: { minHeight: 48, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 14, padding: "0 12px", fontWeight: 800 },
  toggle: { minHeight: 48, display: "flex", alignItems: "center", gap: 9, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 14, padding: "0 12px", fontWeight: 800 },
  selectionPanel: { display: "grid", gridTemplateColumns: "minmax(220px, .75fr) minmax(0, 1.1fr) 220px", gap: 14, alignItems: "center", background: "#111827", color: "#ffffff", borderRadius: 18, padding: 18, boxShadow: "0 14px 34px rgba(15,23,42,.16)" },
  selectionHint: { margin: "6px 0 0", color: "#cbd5e1", fontWeight: 700, lineHeight: 1.35 },
  panelTitle: { margin: 0, fontSize: 22, fontWeight: 900 },
  selectionMetrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 },
  selectionActions: { display: "grid", gap: 9 },
  primaryDarkButton: { minHeight: 42, border: "none", background: "#f97316", color: "#ffffff", borderRadius: 12, padding: "10px 12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8, fontWeight: 900 },
  clearDarkButton: { minHeight: 42, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.06)", color: "#ffffff", borderRadius: 12, padding: "10px 12px", fontWeight: 900 },
  selectedList: { gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)" },
  selectedChip: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.08)", borderRadius: 999, padding: "7px 8px 7px 10px", color: "#ffffff", fontSize: 12, fontWeight: 800 },
  selectedChipButton: { width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(255,255,255,.12)", color: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 },
  mini: { border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", borderRadius: 14, padding: 11, display: "grid", gap: 4 },
  miniStrong: { border: "1px solid #86efac", background: "rgba(34,197,94,.12)", color: "#bbf7d0", borderRadius: 14, padding: 11, display: "grid", gap: 4 },
  tableCard: { background: "#ffffff", border: "1px solid #dbe3ef", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 26px rgba(15,23,42,.06)" },
  tableTop: { padding: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" },
  muted: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  empty: { padding: 22, color: "#64748b", fontWeight: 800 },
  rows: { display: "grid" },
  row: { display: "grid", gridTemplateColumns: "34px minmax(240px, 1.1fr) minmax(180px, .8fr) minmax(330px, 1.3fr) 140px", gap: 14, alignItems: "center", padding: 15, borderBottom: "1px solid #eef2f7" },
  rowSelected: { display: "grid", gridTemplateColumns: "34px minmax(240px, 1.1fr) minmax(180px, .8fr) minmax(330px, 1.3fr) 140px", gap: 14, alignItems: "center", padding: 15, borderBottom: "1px solid #bfdbfe", background: "#eff6ff" },
  checkCell: { display: "grid", placeItems: "center" },
  orderMain: { display: "grid", gap: 4, minWidth: 0 },
  orderTitleLine: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  orderLink: { color: "#1d4ed8", fontWeight: 900, textDecoration: "none" },
  urgent: { borderRadius: 999, padding: "5px 8px", background: "#fee2e2", color: "#b91c1c", fontSize: 12, fontWeight: 900 },
  problem: { color: "#334155", fontWeight: 800, lineHeight: 1.35 },
  moneyGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 },
  amount: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 9, display: "grid", gap: 3, color: "#475569", fontSize: 12 },
  amountStrong: { border: "1px solid #86efac", background: "#ecfdf5", borderRadius: 12, padding: 9, display: "grid", gap: 3, color: "#047857", fontSize: 12 },
  flags: { display: "grid", gap: 5, color: "#475569", fontWeight: 800, fontSize: 12 },
  warning: { display: "inline-flex", alignItems: "center", gap: 5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 999, padding: "5px 8px" },
  warningSoft: { display: "inline-flex", alignItems: "center", color: "#92400e", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 999, padding: "5px 8px" },
};
