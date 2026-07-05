import { useEffect, useMemo, useState } from "react";
import { listarCategorias } from "../services/catalogoService";
import {
  cargarConteoInventario,
  cancelarInventarioFisico,
  cerrarInventarioFisico,
  crearInventarioFisico,
  listarDiferenciasInventario,
  listarInventariosFisicos,
  obtenerInventarioFisico,
} from "../services/inventarioFisicoService";
import { useSession } from "../context/SessionContext";
import { formatProductoVariante } from "../utils/productPresentation";

const TIPOS_OPERATIVOS = [
  { value: "", label: "Todos los sectores" },
  { value: "bicicleta", label: "Bicicletas" },
  { value: "repuesto", label: "Repuestos" },
  { value: "accesorio", label: "Accesorios" },
  { value: "producto", label: "Productos" },
  { value: "no_bicicletas", label: "No bicicletas" },
];

export default function InventarioFisicoPage() {
  const { usuarioId, sucursalId } = useSession();
  const [inventarios, setInventarios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [diferencias, setDiferencias] = useState([]);
  const [actual, setActual] = useState(null);
  const [query, setQuery] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [tipoOperativo, setTipoOperativo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId]);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [inventariosData, categoriasData, diferenciasData] = await Promise.all([
        listarInventariosFisicos(),
        listarCategorias(),
        listarDiferenciasInventario({ id_sucursal: sucursalId, limit: 30 }),
      ]);

      setInventarios(inventariosData || []);
      setCategorias(categoriasData || []);
      setDiferencias(diferenciasData || []);

      if (!actual && inventariosData?.[0]) {
        const detalle = await obtenerInventarioFisico(inventariosData[0].id);
        setActual(detalle);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar inventarios");
    } finally {
      setLoading(false);
    }
  }

  async function abrirNuevo(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    try {
      const nuevo = await crearInventarioFisico({
        id_sucursal: sucursalId || 1,
        id_usuario: usuarioId,
        descripcion: descripcion.trim() || null,
        id_categoria: idCategoria ? Number(idCategoria) : null,
        tipo_operativo: tipoOperativo || null,
      });
      setActual(nuevo);
      setDescripcion("");
      await cargar();
      setMensaje("Inventario fisico abierto");
    } catch (err) {
      setError(err.message || "No se pudo abrir inventario");
    }
  }

  async function seleccionar(id) {
    setError("");
    const detalle = await obtenerInventarioFisico(id);
    setActual(detalle);
  }

  async function contar(item, value) {
    if (value === "") return;
    setError("");
    try {
      await cargarConteoInventario(actual.id, {
        id_variante: item.id_variante,
        stock_contado: value,
        id_usuario: usuarioId,
      });
      const detalle = await obtenerInventarioFisico(actual.id);
      setActual(detalle);
    } catch (err) {
      setError(err.message || "No se pudo guardar conteo");
    }
  }

  async function cerrar() {
    if (!actual) return;
    const resumen = calcularResumen(actual.items || []);
    const msg = [
      "Aprobar cierre de inventario?",
      "",
      `Items contados: ${actual.items_contados}/${actual.total_items}`,
      `Items con diferencia: ${resumen.itemsConDiferencia}`,
      `Diferencia neta: ${formatQty(resumen.diferenciaNeta)}`,
      `Impacto estimado: ${formatMoney(resumen.valorDiferencia)}`,
      "",
      "Al confirmar se aplican los ajustes de stock y queda historial.",
    ].join("\n");

    if (!window.confirm(msg)) return;

    setError("");
    try {
      const cerrado = await cerrarInventarioFisico(actual.id, { id_usuario: usuarioId });
      setActual(cerrado);
      await cargar();
      setMensaje("Inventario cerrado y ajustes aplicados");
    } catch (err) {
      setError(err.message || "No se pudo cerrar inventario");
    }
  }

  async function cancelar() {
    if (!actual) return;

    const msg = [
      "Cancelar inventario abierto?",
      "",
      "No se van a generar movimientos de stock.",
      "Los conteos cargados quedan como referencia del inventario cancelado.",
    ].join("\n");

    if (!window.confirm(msg)) return;

    setError("");
    setMensaje("");
    try {
      const cancelado = await cancelarInventarioFisico(actual.id, { id_usuario: usuarioId });
      setActual(cancelado);
      await cargar();
      setMensaje("Inventario cancelado sin afectar stock");
    } catch (err) {
      setError(err.message || "No se pudo cancelar inventario");
    }
  }

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = actual?.items || [];
    if (!q) return source;
    return source.filter((item) =>
      [
        item.producto_nombre,
        item.nombre_variante,
        item.sku,
        item.codigo_proveedor,
        item.categoria_nombre,
        item.tipo_operativo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [actual, query]);

  const resumenActual = useMemo(
    () => calcularResumen(actual?.items || []),
    [actual]
  );

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Control de stock</p>
          <h1 style={styles.title}>Inventario fisico</h1>
        </div>
        <button type="button" onClick={cargar} style={styles.secondary}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <section style={styles.layout}>
        <aside style={styles.card}>
          <h2 style={styles.cardTitle}>Abrir conteo</h2>
          <form onSubmit={abrirNuevo} style={styles.form}>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Repuestos deposito junio"
              style={styles.input}
            />
            <select
              value={tipoOperativo}
              onChange={(e) => setTipoOperativo(e.target.value)}
              style={styles.input}
            >
              {TIPOS_OPERATIVOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
            <select
              value={idCategoria}
              onChange={(e) => setIdCategoria(e.target.value)}
              style={styles.input}
            >
              <option value="">Todas las categorias</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
            <button type="submit" style={styles.primary}>
              Crear inventario
            </button>
          </form>

          <h2 style={styles.cardTitle}>Inventarios</h2>
          <div style={styles.list}>
            {inventarios.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => seleccionar(inv.id)}
                style={actual?.id === inv.id ? styles.itemActive : styles.item}
              >
                <strong>#{inv.id} - {inv.estado}</strong>
                <span>{inv.items_contados}/{inv.total_items} contados - {inv.items_con_diferencia} dif.</span>
              </button>
            ))}
          </div>
        </aside>

        <section style={styles.card}>
          {!actual ? (
            <div style={styles.empty}>Abri o selecciona un inventario.</div>
          ) : (
            <>
              <div style={styles.detailHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Inventario #{actual.id}</h2>
                  <p style={styles.muted}>
                    {actual.descripcion || "Sin descripcion"} - {actual.estado}
                  </p>
                </div>
                {actual.estado === "abierto" && (
                  <div style={styles.detailActions}>
                    <button type="button" onClick={cancelar} style={styles.danger}>
                      Cancelar
                    </button>
                    <button type="button" onClick={cerrar} style={styles.primary}>
                      Aprobar y cerrar
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.metricsGrid}>
                <Metric label="Contados" value={`${actual.items_contados}/${actual.total_items}`} />
                <Metric
                  label="Con diferencia"
                  value={resumenActual.itemsConDiferencia}
                  tone={resumenActual.itemsConDiferencia ? "warn" : "ok"}
                />
                <Metric label="Diferencia neta" value={formatQty(resumenActual.diferenciaNeta)} />
                <Metric
                  label="Impacto estimado"
                  value={formatMoney(resumenActual.valorDiferencia)}
                  tone={Number(resumenActual.valorDiferencia) ? "warn" : "ok"}
                />
              </div>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto, variante, codigo, categoria o sector"
                style={styles.input}
              />

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Producto</th>
                      <th style={styles.th}>Categoria / sector</th>
                      <th style={styles.th}>Sistema</th>
                      <th style={styles.th}>Contado</th>
                      <th style={styles.th}>Diferencia</th>
                      <th style={styles.th}>Valor dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <strong>
                            {formatProductoVariante(
                              item.producto_nombre,
                              item.nombre_variante
                            )}
                          </strong>
                          <div style={styles.muted}>
                            {item.codigo_proveedor || item.sku || "-"}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <strong>{item.categoria_nombre || "-"}</strong>
                          <div style={styles.muted}>{labelTipoOperativo(item.tipo_operativo)}</div>
                        </td>
                        <td style={styles.td}>{item.stock_sistema}</td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            defaultValue={item.stock_contado ?? ""}
                            disabled={actual.estado !== "abierto"}
                            onBlur={(e) => contar(item, e.target.value)}
                            style={styles.qty}
                          />
                        </td>
                        <td style={Number(item.diferencia) === 0 ? styles.td : styles.diff}>{item.diferencia}</td>
                        <td style={Number(item.valor_diferencia) === 0 ? styles.td : styles.diff}>{formatMoney(item.valor_diferencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </section>

      <section style={styles.historyCard}>
        <h2 style={styles.cardTitle}>Historial de diferencias</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Producto</th>
                <th style={styles.th}>Categoria / sector</th>
                <th style={styles.th}>Sistema</th>
                <th style={styles.th}>Contado</th>
                <th style={styles.th}>Diferencia</th>
                <th style={styles.th}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {diferencias.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.emptyCell}>
                    Sin diferencias cerradas todavia.
                  </td>
                </tr>
              ) : (
                diferencias.map((dif) => (
                  <tr key={`${dif.inventario_id}-${dif.id_variante}`}>
                    <td style={styles.td}>{formatDate(dif.fecha_cierre)}</td>
                    <td style={styles.td}>
                      <strong>
                        {formatProductoVariante(
                          dif.producto_nombre,
                          dif.nombre_variante
                        )}
                      </strong>
                      <div style={styles.muted}>
                        Inv. #{dif.inventario_id}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <strong>{dif.categoria_nombre || "-"}</strong>
                      <div style={styles.muted}>{labelTipoOperativo(dif.tipo_operativo)}</div>
                    </td>
                    <td style={styles.td}>{dif.stock_sistema}</td>
                    <td style={styles.td}>{dif.stock_contado}</td>
                    <td style={styles.diff}>{dif.diferencia}</td>
                    <td style={styles.diff}>{formatMoney(dif.valor_diferencia)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "neutral" }) {
  return (
    <div style={{ ...styles.metric, ...(styles[`metric_${tone}`] || {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function calcularResumen(items) {
  return items.reduce(
    (acc, item) => {
      const diferencia = Number(item.diferencia || 0);
      const valor = Number(item.valor_diferencia || 0);
      acc.diferenciaNeta += diferencia;
      acc.valorDiferencia += valor;
      if (
        diferencia !== 0 &&
        item.stock_contado !== null &&
        item.stock_contado !== undefined
      ) {
        acc.itemsConDiferencia += 1;
      }
      return acc;
    },
    { diferenciaNeta: 0, valorDiferencia: 0, itemsConDiferencia: 0 }
  );
}

function formatQty(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

function labelTipoOperativo(value) {
  const found = TIPOS_OPERATIVOS.find((tipo) => tipo.value === value);
  return found?.label || value || "-";
}

const styles = {
  page: { padding: 20, minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  kicker: { margin: 0, color: "#f97316", fontWeight: 1000, textTransform: "uppercase", fontSize: 12 },
  title: { margin: "3px 0 0", fontSize: 32 },
  layout: { display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, boxShadow: "0 12px 28px rgba(15,23,42,.05)" },
  historyCard: { marginTop: 16, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, boxShadow: "0 12px 28px rgba(15,23,42,.05)" },
  cardTitle: { margin: "0 0 10px", fontSize: 20 },
  form: { display: "grid", gap: 10, marginBottom: 18 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 11px", boxSizing: "border-box", fontWeight: 700 },
  qty: { width: 100, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 9px", fontWeight: 800 },
  primary: { border: "none", background: "#f97316", color: "white", borderRadius: 8, padding: "10px 12px", fontWeight: 1000, cursor: "pointer" },
  secondary: { border: "1px solid #cbd5e1", background: "white", borderRadius: 8, padding: "10px 12px", fontWeight: 900, cursor: "pointer" },
  danger: { border: "1px solid #fecaca", background: "#fef2f2", color: "#b42318", borderRadius: 8, padding: "10px 12px", fontWeight: 1000, cursor: "pointer" },
  detailActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  list: { display: "grid", gap: 8 },
  item: { display: "grid", gap: 4, textAlign: "left", border: "1px solid #e2e8f0", background: "white", borderRadius: 8, padding: 10, cursor: "pointer" },
  itemActive: { display: "grid", gap: 4, textAlign: "left", border: "1px solid #f97316", background: "#fff7ed", borderRadius: 8, padding: 10, cursor: "pointer" },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 },
  muted: { color: "#64748b", fontSize: 13, margin: 0 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 },
  metric: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f8fafc", display: "grid", gap: 4 },
  metric_ok: { background: "#ecfdf5", borderColor: "#bbf7d0" },
  metric_warn: { background: "#fff7ed", borderColor: "#fed7aa" },
  metricLabel: { color: "#64748b", fontSize: 12, fontWeight: 950, textTransform: "uppercase" },
  metricValue: { color: "#0f172a", fontSize: 20, fontWeight: 1000 },
  tableWrap: { overflowX: "auto", marginTop: 12 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 920 },
  th: { textAlign: "left", padding: 10, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" },
  td: { padding: 10, borderBottom: "1px solid #e2e8f0", fontWeight: 750 },
  diff: { padding: 10, borderBottom: "1px solid #e2e8f0", fontWeight: 1000, color: "#b42318" },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 12, fontWeight: 800 },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 12, fontWeight: 800 },
  empty: { color: "#64748b", fontWeight: 800, padding: 18, textAlign: "center" },
  emptyCell: { color: "#64748b", fontWeight: 800, padding: 18, textAlign: "center" },
};
