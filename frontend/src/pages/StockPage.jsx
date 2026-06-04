import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { crearAjusteStock, crearIngresoStock, listarStock } from "../services/stockService";
import { listarProveedores } from "../services/proveedoresService";
import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../config/appConfig";
import { formatMoney, formatNumber } from "../utils/formatters";
import { getEstadoStock, calcularResumenStock } from "../utils/stockUtils";
import { buildIngresoStockPayload, buildAjusteStockPayload } from "../builders/stockPayloadBuilder";
import StockTable from "../components/stock/StockTable";
import StockDrawer from "../components/stock/StockDrawer";

const ID_USUARIO = CURRENT_USER_ID || 1;
const ID_SUCURSAL_DEFAULT = CURRENT_SUCURSAL_ID || 1;

export default function StockPage() {
  const navigate = useNavigate();

  const [stock, setStock] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ultimoIngreso, setUltimoIngreso] = useState(null);

  const [seleccionado, setSeleccionado] = useState(null);
  const [modoPanel, setModoPanel] = useState("detalle");

  const [ingresoForm, setIngresoForm] = useState({
    id_sucursal: ID_SUCURSAL_DEFAULT,
    id_variante: "",
    id_proveedor: "",
    cantidad_ingresada: "",
    costo_productos: "",
    gastos_adicionales: "0",
    origen_ingreso: "manual",
    observacion: "",
    id_usuario: ID_USUARIO,
  });

  const [ajusteForm, setAjusteForm] = useState({
    id_sucursal: ID_SUCURSAL_DEFAULT,
    id_variante: "",
    cantidad: "",
    nota: "",
    id_usuario: ID_USUARIO,
    origen_tipo: "ajuste_manual",
    origen_id: null,
  });

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    await Promise.all([cargarStock(), cargarProveedores()]);
  }

  async function cargarStock() {
    try {
      setLoading(true);
      setError("");
      const data = await listarStock();
      setStock(data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el stock");
    } finally {
      setLoading(false);
    }
  }

  async function cargarProveedores() {
    try {
      const data = await listarProveedores({ solo_activos: true });
      setProveedores(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar proveedores");
    }
  }

  function seleccionarItem(item, modo = "detalle") {
    setSeleccionado(item);
    setModoPanel(modo);

    setIngresoForm((p) => ({
      ...p,
      id_sucursal: item.sucursal_id,
      id_variante: item.variante_id,
    }));

    setAjusteForm((p) => ({
      ...p,
      id_sucursal: item.sucursal_id,
      id_variante: item.variante_id,
    }));
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setModoPanel("detalle");
  }

  const stockFiltrado = useMemo(() => {
    const q = query.trim().toLowerCase();

    return stock.filter((item) => {
      const texto = [
        item.sucursal_nombre,
        item.producto_nombre,
        item.nombre_variante,
        item.sku,
        item.codigo_barras,
        item.codigo_proveedor,
        item.variante_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideTexto = !q || texto.includes(q);
      const estado = getEstadoStock(item);
      const coincideEstado = filtroEstado === "todos" || filtroEstado === estado;

      return coincideTexto && coincideEstado;
    });
  }, [stock, query, filtroEstado]);

  const resumen = useMemo(() => calcularResumenStock(stock), [stock]);

  async function handleIngreso(e) {
    e.preventDefault();

    if (!ingresoForm.id_variante || !ingresoForm.id_proveedor) {
      setError("Ingreso: variante y proveedor son obligatorios");
      return;
    }

    if (!ingresoForm.cantidad_ingresada || Number(ingresoForm.cantidad_ingresada) <= 0) {
      setError("Ingreso: la cantidad debe ser mayor a 0");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      setUltimoIngreso(null);

      const payload = buildIngresoStockPayload({ ingresoForm, usuarioId: ID_USUARIO });
      const res = await crearIngresoStock(payload);

      setUltimoIngreso({ ...res, id_proveedor: payload.id_proveedor });

      setMensaje(
        `Ingreso registrado. Stock: ${formatNumber(res.stock_anterior)} → ${formatNumber(
          res.stock_nuevo
        )}. Costo promedio: ${formatMoney(res.costo_promedio_nuevo)}`
      );

      setIngresoForm((p) => ({
        ...p,
        cantidad_ingresada: "",
        costo_productos: "",
        gastos_adicionales: "0",
        observacion: "",
      }));
      
      await cargarStock();
    } catch (err) {
      setError(err.message || "No se pudo registrar el ingreso");
    } finally {
      setProcesando(false);
    }
  }

  async function handleAjuste(e) {
    e.preventDefault();

    if (!ajusteForm.id_variante) {
      setError("Ajuste: seleccioná una variante");
      return;
    }

    if (!ajusteForm.cantidad || Number(ajusteForm.cantidad) === 0) {
      setError("Ajuste: la cantidad no puede ser 0");
      return;
    }

    if (!ajusteForm.nota.trim()) {
      setError("Ajuste: el motivo es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      setUltimoIngreso(null);

      const payload = buildAjusteStockPayload({ ajusteForm, usuarioId: ID_USUARIO });
      const res = await crearAjusteStock(payload);

      setMensaje(`Ajuste registrado. Disponible nuevo: ${formatNumber(res.stock_disponible_nuevo)}`);

      setAjusteForm((p) => ({ ...p, cantidad: "", nota: "" }));

      await cargarStock();
    } catch (err) {
      setError(err.message || "No se pudo registrar el ajuste");
    } finally {
      setProcesando(false);
    }
  }

  const costoCambio =
    ultimoIngreso &&
    Number(ultimoIngreso.costo_promedio_anterior) !== Number(ultimoIngreso.costo_promedio_nuevo);

  if (loading) {
    return (
      <div style={styles.page}>
        <section style={styles.loadingCard}>Cargando stock...</section>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Inventario / Control operativo</p>
          <h1 style={styles.title}>Stock</h1>
          <p style={styles.subtitle}>
            Control de físico, reservado, pendiente de entrega y disponible.
          </p>
        </div>

        <div style={styles.actionsHeader}>
          <button type="button" onClick={cargarTodo} style={styles.secondaryButton}>
            Refrescar
          </button>
          <button type="button" onClick={() => navigate("/mercaderia/alta")} style={styles.primaryButton}>
            Alta mercadería
          </button>
        </div>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      {costoCambio && (
        <div style={styles.priceWarning}>
          <div>
            <strong>El costo promedio cambió.</strong>
            <div>
              Anterior: {formatMoney(ultimoIngreso.costo_promedio_anterior)} · Nuevo:{" "}
              {formatMoney(ultimoIngreso.costo_promedio_nuevo)}
            </div>
            <div style={styles.mutedSmall}>Conviene revisar precios desfasados.</div>
          </div>

          <button type="button" onClick={() => navigate("/precios")} style={styles.warningButton}>
            Ir a precios
          </button>
        </div>
      )}

      <section style={styles.metricGrid}>
        <Metric label="Variantes" value={resumen.variantes} />
        <Metric label="Físico" value={formatNumber(resumen.stockFisico)} />
        <Metric label="Reservado" value={formatNumber(resumen.stockReservado)} />
        <Metric label="Pendiente entrega" value={formatNumber(resumen.stockPendiente)} />
        <Metric label="Disponible" value={formatNumber(resumen.stockDisponible)} strong />
        <Metric label="Sin disponible" value={resumen.sinDisponible} danger={resumen.sinDisponible > 0} />
        <Metric label="Inconsistencias" value={resumen.inconsistentes} danger={resumen.inconsistentes > 0} />
      </section>

      <section style={styles.searchCard}>
        <div>
          <h2 style={styles.searchTitle}>Buscar en stock</h2>
          <p style={styles.searchHelp}>Producto, variante, código, SKU, sucursal o ID.</p>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.select();
            }
          }}
          placeholder="Buscar producto, variante, SKU, sucursal o ID..."
          style={styles.searchInput}
        />

        <div style={styles.filterButtons}>
          <FilterButton label="Todos" value="todos" current={filtroEstado} onClick={setFiltroEstado} />
          <FilterButton label="Sin stock" value="sin_disponible" current={filtroEstado} onClick={setFiltroEstado} />
          <FilterButton label="Reservado" value="reservado" current={filtroEstado} onClick={setFiltroEstado} />
          <FilterButton label="Pendiente" value="pendiente" current={filtroEstado} onClick={setFiltroEstado} />
          <FilterButton label="Inconsistente" value="inconsistente" current={filtroEstado} onClick={setFiltroEstado} />
        </div>
      </section>

      <section style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.cardTitle}>Inventario</h2>
            <p style={styles.mutedSmall}>
              {stockFiltrado.length} resultado(s). Click para detalle; Ingreso y Ajuste operan desde el panel lateral.
            </p>
          </div>
        </div>

        {stockFiltrado.length === 0 ? (
          <div style={styles.empty}>No hay stock para mostrar con esos filtros.</div>
        ) : (
          <div style={styles.tableWrap}>
            <StockTable
              stockFiltrado={stockFiltrado}
              seleccionado={seleccionado}
              seleccionarItem={seleccionarItem}
              EstadoBadge={EstadoBadge}
              styles={{
                table: styles.table,
                thead: styles.thead,
                th: styles.th,
                thNumber: styles.thNumber,
                td: styles.td,
                tdProduct: styles.tdProduct,
                tdNumber: styles.tdNumber,
                tdNumberStrong: styles.tdNumberStrong,
                mutedSmall: styles.mutedSmall,
                rowActions: styles.rowActions,
                tr: styles.tr,
                trActive: styles.trActive,
                productName: styles.productName,
                variantName: styles.variantName,
                actionButton: styles.actionButton,
                dangerOutlineButton: styles.dangerOutlineButton,
              }}
            />
          </div>
        )}
      </section>

      {seleccionado && (
        <StockDrawer
          seleccionado={seleccionado}
          cerrarPanel={cerrarPanel}
          modoPanel={modoPanel}
          setModoPanel={setModoPanel}
          handleIngreso={handleIngreso}
          handleAjuste={handleAjuste}
          ingresoForm={ingresoForm}
          setIngresoForm={setIngresoForm}
          ajusteForm={ajusteForm}
          setAjusteForm={setAjusteForm}
          proveedores={proveedores}
          procesando={procesando}
          InfoRow={InfoRow}
          ReadOnlyField={ReadOnlyField}
          TextInput={TextInput}
          styles={{
            overlay: styles.drawerOverlay,
            drawer: styles.drawer,
            header: styles.drawerHeader,
            eyebrow: styles.eyebrow,
            title: styles.drawerTitle,
            muted: styles.muted,
            closeButton: styles.closeButton,
            tabs: styles.drawerTabs,
            tab: styles.tab,
            activeTab: styles.activeTab,
            content: styles.drawerContent,
            actions: styles.drawerActions,
            note: styles.note,
            warningNote: styles.warningNote,
            field: styles.field,
            label: styles.label,
            input: styles.input,
            textarea: styles.textarea,
            primaryButton: styles.primaryButton,
            dangerButton: styles.dangerButton,
            previewBox: styles.previewBox,
            stockHero: styles.stockHero,
            readOnlyField: styles.readOnlyField,
            readOnlyLabel: styles.readOnlyLabel,
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, danger = false, strong = false }) {
  return (
    <div style={styles.metric}>
      <span style={styles.mutedSmall}>{label}</span>
      <strong style={{ ...styles.metricValue, color: danger ? "#991b1b" : strong ? "#1d4ed8" : "#111827" }}>
        {value}
      </strong>
    </div>
  );
}

function FilterButton({ label, value, current, onClick }) {
  return (
    <button
      type="button"
      style={current === value ? styles.activeFilter : styles.filter}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}

function EstadoBadge({ estado }) {
  if (estado === "ok") return <span style={styles.okPill}>OK</span>;
  if (estado === "sin_disponible") return <span style={styles.dangerPill}>Sin disponible</span>;
  if (estado === "reservado") return <span style={styles.bluePill}>Reservado</span>;
  if (estado === "pendiente") return <span style={styles.warningPill}>Pendiente</span>;
  if (estado === "inconsistente") return <span style={styles.dangerPill}>Inconsistente</span>;
  return <span style={styles.warningPill}>Revisar</span>;
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={styles.readOnlyField}>
      <span style={styles.readOnlyLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#f3f4f6",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  title: { margin: "2px 0 0", fontSize: "30px", fontWeight: 900 },
  subtitle: { margin: "6px 0 0", color: "#6b7280", fontSize: "14px" },
  actionsHeader: { display: "flex", gap: "10px", flexWrap: "wrap" },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerButton: {
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  error: {
    background: "#fef2f2",
    color: "#991b1b",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #fecaca",
    marginBottom: "14px",
    fontWeight: 700,
  },
  success: {
    background: "#ecfdf5",
    color: "#166534",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #bbf7d0",
    marginBottom: "14px",
    fontWeight: 700,
  },
  priceWarning: {
    background: "#fffbeb",
    color: "#92400e",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #fde68a",
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  warningButton: {
    border: "1px solid #d97706",
    background: "#ffffff",
    color: "#92400e",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  metric: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
    padding: "14px",
    display: "grid",
    gap: "6px",
  },
  metricValue: { fontSize: "24px" },
  searchCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    marginBottom: "18px",
    display: "grid",
    gap: "12px",
  },
  searchTitle: { margin: 0, fontSize: "20px", fontWeight: 900 },
  searchHelp: { margin: "4px 0 0", color: "#6b7280", fontSize: "14px" },
  searchInput: {
    width: "100%",
    padding: "14px 16px",
    border: "2px solid #2563eb",
    borderRadius: "14px",
    fontSize: "18px",
    boxSizing: "border-box",
    outline: "none",
    background: "#ffffff",
  },
  filterButtons: { display: "flex", gap: "8px", flexWrap: "wrap" },
  filter: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  activeFilter: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  },
  tableHeader: { padding: "16px 18px", borderBottom: "1px solid #e5e7eb" },
  cardTitle: { margin: 0, fontSize: "20px", fontWeight: 900 },
  muted: { color: "#6b7280", margin: "4px 0 0" },
  mutedSmall: { color: "#6b7280", fontSize: "13px", marginTop: "4px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1040px" },
  thead: { background: "#f9fafb" },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "12px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  thNumber: {
    textAlign: "right",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "12px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tr: { borderTop: "1px solid #f3f4f6", cursor: "pointer", background: "#ffffff" },
  trActive: { borderTop: "1px solid #bfdbfe", cursor: "pointer", background: "#eff6ff" },
  td: { padding: "12px 10px", verticalAlign: "top" },
  tdProduct: { padding: "12px 10px", verticalAlign: "top", minWidth: "280px" },
  tdNumber: { padding: "12px 10px", verticalAlign: "top", textAlign: "right" },
  tdNumberStrong: {
    padding: "12px 10px",
    verticalAlign: "top",
    textAlign: "right",
    fontWeight: 900,
    color: "#1d4ed8",
  },
  productName: { display: "block", fontSize: "14px" },
  variantName: { marginTop: "3px", color: "#374151" },
  rowActions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  actionButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerOutlineButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  okPill: badge("#ecfdf5", "#166534", "#bbf7d0"),
  warningPill: badge("#fffbeb", "#92400e", "#fde68a"),
  dangerPill: badge("#fef2f2", "#991b1b", "#fecaca"),
  bluePill: badge("#eff6ff", "#1d4ed8", "#bfdbfe"),
  drawerOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "flex-end",
  },
  drawer: {
    width: "min(500px, 100%)",
    background: "#ffffff",
    height: "100%",
    boxShadow: "-8px 0 30px rgba(0,0,0,.22)",
    overflowY: "auto",
  },
  drawerHeader: {
    padding: "18px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  drawerTitle: { margin: "2px 0 0", fontSize: "22px", fontWeight: 900 },
  closeButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "10px",
    width: "36px",
    height: "36px",
    fontSize: "22px",
    cursor: "pointer",
  },
  drawerTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    borderBottom: "1px solid #e5e7eb",
  },
  tab: {
    border: "none",
    background: "#ffffff",
    padding: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  activeTab: {
    border: "none",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  drawerContent: { padding: "18px", display: "grid", gap: "12px" },
  stockHero: {
    display: "grid",
    gap: "4px",
    padding: "16px",
    border: "1px solid #bfdbfe",
    borderRadius: "16px",
    background: "#eff6ff",
  },
  drawerActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" },
  field: { display: "flex", flexDirection: "column", gap: "7px" },
  label: { fontWeight: 900, fontSize: "14px" },
  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    fontSize: "15px",
    boxSizing: "border-box",
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    fontSize: "15px",
    boxSizing: "border-box",
    background: "#ffffff",
    minHeight: "80px",
    resize: "vertical",
  },
  readOnlyField: {
    display: "grid",
    gap: "4px",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    background: "#f9fafb",
  },
  readOnlyLabel: {
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  previewBox: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    background: "#eff6ff",
  },
  note: {
    background: "#f9fafb",
    borderLeft: "4px solid #2563eb",
    padding: "10px",
    borderRadius: "8px",
    color: "#374151",
    marginTop: "8px",
  },
  warningNote: {
    background: "#fffbeb",
    borderLeft: "4px solid #d97706",
    padding: "10px",
    borderRadius: "8px",
    color: "#92400e",
    marginTop: "8px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: "10px",
    color: "#374151",
  },
  empty: { padding: "22px", color: "#6b7280" },
  loadingCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
  },
};

function badge(bg, color, border) {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    fontWeight: 900,
    fontSize: "12px",
    background: bg,
    color,
    border: `1px solid ${border}`,
    whiteSpace: "nowrap",
  };
}
