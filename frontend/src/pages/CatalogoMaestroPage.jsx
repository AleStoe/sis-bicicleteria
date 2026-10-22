import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, RefreshCw, Tags } from "lucide-react";
import { listarProductos, listarRubros, listarVariantes } from "../services/catalogoService";
import { Button, EmptyState, MetricCard, PageHeader, ResponsiveMetricsGrid } from "../components/ui";
import SearchField from "../components/ui/SearchField";
import { formatMoney } from "../utils/formatters";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";

const RUBROS = [
  { value: "todos", label: "Todos los rubros" },
  { value: "BICICLETAS", label: "Bicicletas" },
  { value: "TRICICLOS", label: "Triciclos" },
  { value: "CUATRICICLOS", label: "Cuatriciclos" },
  { value: "REPUESTOS", label: "Repuestos" },
  { value: "ACCESORIOS", label: "Accesorios" },
  { value: "INDUMENTARIA", label: "Indumentaria" },
  { value: "HERRAMIENTAS", label: "Herramientas" },
  { value: "CUBIERTAS AUTO", label: "Cubiertas auto" },
  { value: "SERVICIOS", label: "Servicios" },
];

const ESTADOS = [
  { value: "todos", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
  { value: "serializables", label: "Serializables" },
];

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sumarRango(resumen, campo, valor) {
  if (valor === null || valor === undefined || valor === "") return;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return;

  const minKey = `${campo}Min`;
  const maxKey = `${campo}Max`;
  resumen[minKey] = resumen[minKey] === null ? numero : Math.min(resumen[minKey], numero);
  resumen[maxKey] = resumen[maxKey] === null ? numero : Math.max(resumen[maxKey], numero);
}

function formatRangoDinero(min, max) {
  if (min === null || min === undefined) return "-";
  if (max === null || max === undefined || Number(min) === Number(max)) return formatMoney(min);
  return `${formatMoney(min)} - ${formatMoney(max)}`;
}

export default function CatalogoMaestroPage() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [query, setQuery] = useState("");
  const [rubro, setRubro] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      const [productosData, variantesData, rubrosData] = await Promise.all([
        listarProductos(),
        listarVariantes(),
        listarRubros(),
      ]);
      setProductos(productosData || []);
      setVariantes(variantesData || []);
      setRubros(rubrosData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el maestro de productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const rubrosOpciones = useMemo(() => {
    if (!rubros.length) return RUBROS;
    return [
      { value: "todos", label: "Todos los rubros" },
      ...rubros.map((item) => ({ value: item.nombre, label: item.label || item.nombre })),
    ];
  }, [rubros]);

  const resumenPorProducto = useMemo(() => {
    const mapa = new Map();

    variantes.forEach((variante) => {
      const productoId = variante.id_producto;
      if (!mapa.has(productoId)) {
        mapa.set(productoId, {
          variantes: 0,
          activas: 0,
          minoristaMin: null,
          minoristaMax: null,
          mayoristaMin: null,
          mayoristaMax: null,
          costoMin: null,
          costoMax: null,
        });
      }

      const resumen = mapa.get(productoId);
      resumen.variantes += 1;
      if (variante.activo !== false) resumen.activas += 1;
      sumarRango(resumen, "minorista", variante.precio_minorista);
      sumarRango(resumen, "mayorista", variante.precio_mayorista);
      sumarRango(resumen, "costo", variante.costo_promedio_vigente);
    });

    return mapa;
  }, [variantes]);

  const filtrados = useMemo(() => {
    const tokens = normalizarTexto(query).split(/\s+/).filter(Boolean);

    return productos.filter((producto) => {
      if (rubro !== "todos" && producto.rubro !== rubro) return false;
      if (estado === "activos" && producto.activo === false) return false;
      if (estado === "inactivos" && producto.activo !== false) return false;
      if (estado === "serializables" && !producto.serializable) return false;

      if (!tokens.length) return true;

      const texto = normalizarTexto([
        producto.nombre,
        producto.rubro,
        producto.categoria_nombre,
        producto.marca_nombre,
        producto.rodado,
        producto.tipo_bicicleta,
        producto.material_cuadro,
      ].filter(Boolean).join(" "));

      return tokens.every((token) => texto.includes(token));
    });
  }, [productos, query, rubro, estado]);

  const resumen = useMemo(() => {
    return productos.reduce(
      (acc, producto) => {
        acc.total += 1;
        if (producto.activo !== false) acc.activos += 1;
        if (producto.serializable) acc.serializables += 1;
        if (producto.rubro === "BICICLETAS") acc.bicicletas += 1;
        return acc;
      },
      { total: 0, activos: 0, serializables: 0, bicicletas: 0 },
    );
  }, [productos]);

  function abrirProducto(productoId) {
    navigate(`/catalogo/productos/${productoId}?lectura=1&origen=maestro`);
  }

  return (
    <div style={styles.page}>
      <PageHeader
        eyebrow="Catalogo administrativo"
        title="Maestro de productos"
        subtitle="Busqueda completa para administracion: incluye productos sin stock, historicos e inactivos."
        actions={(
          <Button variant="secondary" onClick={cargar} disabled={loading}>
            <RefreshCw size={17} />
            Actualizar
          </Button>
        )}
      />

      {error ? <div style={styles.error}>{error}</div> : null}

      <ResponsiveMetricsGrid>
        <MetricCard label="Productos" value={loading ? "..." : resumen.total} />
        <MetricCard label="Activos" value={loading ? "..." : resumen.activos} tone="success" />
        <MetricCard label="Bicicletas" value={loading ? "..." : resumen.bicicletas} tone="primary" />
        <MetricCard label="Serializables" value={loading ? "..." : resumen.serializables} tone="warning" />
      </ResponsiveMetricsGrid>

      <section style={styles.filters}>
        <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar por producto, marca, categoria, rodado o rubro..."
            style={styles.searchBox}
            inputStyle={styles.searchInput}
        />
        <select value={rubro} onChange={(event) => setRubro(event.target.value)} style={styles.input}>
          {rubrosOpciones.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
          ))}
        </select>
        <select value={estado} onChange={(event) => setEstado(event.target.value)} style={styles.input}>
          {ESTADOS.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
          ))}
        </select>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Productos encontrados</h2>
            <p style={styles.cardSubtitle}>
              {loading ? "Cargando..." : `${filtrados.length} resultado(s). Esta vista no depende del stock disponible.`}
            </p>
          </div>
          <span style={styles.modePill}>Solo consulta</span>
        </div>

        {loading ? (
          <div style={styles.muted}>Cargando maestro...</div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No encontre productos"
            description="Probá con otro nombre, marca, rodado o rubro."
          />
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Rubro</th>
                  <th style={styles.th}>Categoria</th>
                  <th style={styles.th}>Marca</th>
                  <th style={styles.th}>Minorista</th>
                  <th style={styles.th}>Mayorista</th>
                  <th style={styles.th}>Costo</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((producto) => {
                  const resumenProducto = resumenPorProducto.get(producto.id) || {};
                  return (
                  <tr key={producto.id} style={styles.row}>
                    <td style={styles.td}>
                      <strong style={styles.productName}>{producto.nombre}</strong>
                      <div style={styles.meta}>
                        Producto #{producto.id}
                        {producto.rodado ? ` · Rodado ${producto.rodado}` : ""}
                        {producto.tipo_bicicleta ? ` · ${producto.tipo_bicicleta}` : ""}
                        {resumenProducto.variantes ? ` · ${resumenProducto.activas}/${resumenProducto.variantes} variantes activas` : ""}
                      </div>
                    </td>
                    <td style={styles.td}>{producto.rubro || "-"}</td>
                    <td style={styles.td}>{producto.categoria_nombre || "-"}</td>
                    <td style={styles.td}>{producto.marca_nombre || "-"}</td>
                    <td style={styles.tdMoney}>{formatRangoDinero(resumenProducto.minoristaMin, resumenProducto.minoristaMax)}</td>
                    <td style={styles.tdMoney}>{formatRangoDinero(resumenProducto.mayoristaMin, resumenProducto.mayoristaMax)}</td>
                    <td style={styles.tdMoney}>{formatRangoDinero(resumenProducto.costoMin, resumenProducto.costoMax)}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.status, ...(producto.activo === false ? styles.statusOff : styles.statusOn) }}>
                        {producto.activo === false ? "Inactivo" : "Activo"}
                      </span>
                      {producto.serializable ? <span style={styles.serializable}>Serializable</span> : null}
                    </td>
                    <td style={styles.td}>
                      <button type="button" style={styles.openButton} onClick={() => abrirProducto(producto.id)}>
                        <Eye size={16} />
                        Ver ficha
                      </button>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: spacing.lg,
  },
  error: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: radius.lg,
    padding: spacing.md,
    fontWeight: 700,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 220px 180px",
    gap: spacing.sm,
    alignItems: "center",
  },
  searchBox: {
    minHeight: controls.minHeight,
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    background: colors.surface,
    padding: "0 14px",
    boxShadow: shadows.sm,
  },
  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: "14px",
    fontFamily: typography.fontFamily,
    fontWeight: 700,
    background: "transparent",
  },
  input: {
    minHeight: controls.minHeight,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: controls.padding,
    background: colors.surface,
    fontWeight: 700,
    fontFamily: typography.fontFamily,
    fontSize: "14px",
    boxShadow: shadows.sm,
  },
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    boxShadow: shadows.sm,
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: spacing.md,
    alignItems: "center",
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 800,
  },
  cardSubtitle: {
    margin: "4px 0 0",
    color: colors.textMuted,
    fontWeight: 500,
  },
  modePill: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: colors.accent,
    borderRadius: 999,
    padding: "7px 12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  muted: {
    padding: spacing.lg,
    color: colors.textMuted,
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1180,
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    color: colors.textMuted,
    fontSize: "12px",
    textTransform: "uppercase",
    borderBottom: `1px solid ${colors.border}`,
  },
  row: {
    borderBottom: `1px solid ${colors.border}`,
  },
  td: {
    padding: "13px 16px",
    verticalAlign: "middle",
    fontWeight: 700,
  },
  tdMoney: {
    padding: "13px 16px",
    verticalAlign: "middle",
    textAlign: "right",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  productName: {
    display: "block",
    maxWidth: 460,
  },
  meta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: "13px",
    fontWeight: 500,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 800,
    marginRight: 6,
  },
  statusOn: {
    background: "#dcfce7",
    color: "#047857",
  },
  statusOff: {
    background: "#f1f5f9",
    color: "#64748b",
  },
  serializable: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#eff6ff",
    color: colors.primary,
    fontSize: "12px",
    fontWeight: 800,
  },
  openButton: {
    minHeight: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: colors.surface,
    color: colors.text,
    padding: "0 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
