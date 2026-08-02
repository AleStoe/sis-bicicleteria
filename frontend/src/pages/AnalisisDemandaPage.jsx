import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Search } from "lucide-react";
import { obtenerAnalisisDemanda } from "../services/stockService";
import { Button, Card, MetricCard, PageHeader } from "../components/ui";
import { formatDate, formatMoney, formatNumber } from "../utils/formatters";
import { esVarianteUnica } from "../utils/productPresentation";
import { colors, radius, shadows, spacing, typography } from "../theme";

const tipos = [
  { value: "todos", label: "Todos" },
  { value: "bicicleta", label: "Bicicletas" },
  { value: "repuesto", label: "Repuestos" },
  { value: "accesorio", label: "Accesorios" },
  { value: "producto", label: "Otros productos" },
  { value: "no_bicicletas", label: "Sin bicicletas" },
];

export default function AnalisisDemandaPage() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [meses, setMeses] = useState(12);
  const [limit, setLimit] = useState(80);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccionadaId, setSeleccionadaId] = useState(null);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const respuesta = await obtenerAnalisisDemanda({
        q: query.trim() || undefined,
        tipo_operativo: tipo === "todos" ? undefined : tipo,
        meses,
        limit,
      });
      setData(respuesta);
      setSeleccionadaId((actual) => {
        if (actual && respuesta.items?.some((item) => String(item.variante_id) === String(actual))) {
          return actual;
        }
        return respuesta.items?.[0]?.variante_id || null;
      });
    } catch (err) {
      setError(err.message || "No se pudo cargar el analisis de demanda");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data?.items || [];
  const seleccionada = useMemo(
    () => items.find((item) => String(item.variante_id) === String(seleccionadaId)) || items[0],
    [items, seleccionadaId],
  );
  const lectura = seleccionada ? crearLectura(seleccionada, data?.meses || meses) : null;

  function submit(event) {
    event.preventDefault();
    cargar();
  }

  return (
    <div style={styles.page}>
      <PageHeader
        eyebrow="Stock / Demanda"
        title="Análisis de demanda"
        subtitle="Mirá qué se vendió por mes, qué queda en stock y qué conviene estudiar para la próxima temporada."
        actions={(
          <Button variant="secondary" onClick={cargar} disabled={loading}>
            <RefreshCw size={17} />
            Actualizar
          </Button>
        )}
      />

      {error ? <div style={styles.error}>{error}</div> : null}

      <form style={styles.filters} onSubmit={submit}>
        <label style={styles.searchBox}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto, variante, SKU, código, marca o proveedor..."
            style={styles.searchInput}
          />
        </label>
        <select value={tipo} onChange={(event) => setTipo(event.target.value)} style={styles.input}>
          {tipos.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
          ))}
        </select>
        <select value={meses} onChange={(event) => setMeses(Number(event.target.value))} style={styles.input}>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
          <option value={18}>Últimos 18 meses</option>
          <option value={24}>Últimos 24 meses</option>
          <option value={36}>Últimos 36 meses</option>
        </select>
        <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} style={styles.input}>
          <option value={40}>Top 40</option>
          <option value={80}>Top 80</option>
          <option value={150}>Top 150</option>
          <option value={300}>Top 300</option>
        </select>
        <Button type="submit" disabled={loading}>
          Analizar
        </Button>
      </form>

      <section style={styles.metrics}>
        <MetricCard label="Ítems analizados" value={loading ? "..." : formatNumber(data?.total_items || 0)} />
        <MetricCard label="Unidades vendidas" value={loading ? "..." : formatNumber(data?.unidades_vendidas || 0)} tone="primary" />
        <MetricCard label="Venta neta" value={loading ? "..." : formatMoney(data?.venta_neta || 0)} tone="success" />
        <MetricCard label="Margen observado" value={loading ? "..." : data?.margen_bruto === null ? "Sin permiso" : formatMoney(data?.margen_bruto || 0)} tone="warning" />
      </section>

      <section style={styles.grid}>
        <Card style={styles.listCard}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Productos para estudiar</h2>
              <p style={styles.cardSubtitle}>Ordenado por venta neta del período. La cantidad ayuda a detectar rotación.</p>
            </div>
            <span style={styles.periodPill}>
              {data ? `${formatDate(data.fecha_desde)} - ${formatDate(data.fecha_hasta)}` : "-"}
            </span>
          </div>

          {loading ? (
            <p style={styles.muted}>Cargando demanda...</p>
          ) : items.length === 0 ? (
            <p style={styles.muted}>No encontré productos con esos filtros.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Vendido</th>
                    <th style={styles.th}>Stock</th>
                    <th style={styles.th}>Venta neta</th>
                    <th style={styles.th}>Última venta</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const active = String(item.variante_id) === String(seleccionada?.variante_id);
                    return (
                      <tr
                        key={item.variante_id}
                        onClick={() => setSeleccionadaId(item.variante_id)}
                        style={{
                          ...styles.row,
                          ...(active ? styles.rowActive : {}),
                        }}
                      >
                        <td style={styles.td}>
                          <strong>{item.producto_nombre}</strong>
                          <div style={styles.itemMeta}>
                            {varianteLabel(item)} · {item.marca_nombre || "Sin marca"} · {item.categoria_nombre || "Sin categoría"}
                          </div>
                        </td>
                        <td style={styles.tdStrong}>{formatNumber(item.unidades_vendidas)}</td>
                        <td style={styles.td}>
                          <strong>{formatNumber(item.stock_disponible)}</strong>
                          <div style={styles.itemMeta}>físico {formatNumber(item.stock_fisico)}</div>
                        </td>
                        <td style={styles.tdStrong}>{formatMoney(item.venta_neta)}</td>
                        <td style={styles.td}>{formatDate(item.ultima_venta)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card style={styles.detailCard}>
          {seleccionada ? (
            <>
              <div style={styles.detailTop}>
                <span style={styles.eyebrow}>Ficha de demanda</span>
                <h2 style={styles.detailTitle}>{seleccionada.producto_nombre}</h2>
                <p style={styles.cardSubtitle}>{varianteLabel(seleccionada)}</p>
              </div>

              <div style={styles.reading}>
                <strong>{lectura.titulo}</strong>
                <span>{lectura.detalle}</span>
              </div>

              <div style={styles.detailMetrics}>
                <Info label="Venta neta" value={formatMoney(seleccionada.venta_neta)} />
                <Info label="Unidades" value={formatNumber(seleccionada.unidades_vendidas)} />
                <Info label="Ventas" value={formatNumber(seleccionada.ventas_distintas)} />
                <Info label="Disponible" value={formatNumber(seleccionada.stock_disponible)} />
                <Info label="Proveedor" value={seleccionada.proveedor_nombre || "Sin proveedor"} />
                <Info label="Última venta" value={formatDate(seleccionada.ultima_venta)} />
              </div>

              <h3 style={styles.sectionTitle}>Evolución mensual</h3>
              <MonthlyBars meses={seleccionada.meses || []} />

              <h3 style={styles.sectionTitle}>Para decidir compra</h3>
              <ul style={styles.notes}>
                <li>Compará los meses altos contra el stock disponible actual.</li>
                <li>Si el producto se vende fuerte antes de una temporada, usalo como base para preparar sobrestock.</li>
                <li>Si hay stock alto y pocas ventas, revisá si conviene oferta o no reponer.</li>
              </ul>
            </>
          ) : (
            <p style={styles.muted}>Seleccioná un producto para ver su historia.</p>
          )}
        </Card>
      </section>
    </div>
  );
}

function MonthlyBars({ meses }) {
  const max = Math.max(...meses.map((mes) => Number(mes.unidades_vendidas || 0)), 1);

  return (
    <div style={styles.bars}>
      {meses.map((mes) => {
        const value = Number(mes.unidades_vendidas || 0);
        const height = Math.max(8, (value / max) * 112);
        return (
          <div key={mes.periodo} style={styles.barItem} title={`${mes.etiqueta}: ${formatNumber(value)} unidades`}>
            <div style={styles.barTrack}>
              <div style={{ ...styles.bar, height }} />
            </div>
            <span style={styles.barLabel}>{shortMonth(mes.etiqueta)}</span>
            <strong style={styles.barValue}>{formatNumber(value, { maximumFractionDigits: 0 })}</strong>
          </div>
        );
      })}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function varianteLabel(item) {
  return esVarianteUnica(item.nombre_variante)
    ? item.sku || `VAR-${item.variante_id}`
    : `${item.nombre_variante || "-"} · ${item.sku || `VAR-${item.variante_id}`}`;
}

function crearLectura(item, meses) {
  const unidades = Number(item.unidades_vendidas || 0);
  const promedio = meses > 0 ? unidades / meses : 0;
  const stock = Number(item.stock_disponible || 0);

  if (unidades <= 0) {
    return {
      titulo: "Sin ventas en el período",
      detalle: stock > 0
        ? "Hay stock, pero no registró ventas en este rango. Puede ser producto quieto, nuevo o con historial corto."
        : "No hay ventas ni stock disponible en este rango. Útil para no confundirlo con reposición urgente.",
    };
  }

  if (promedio >= 4) {
    return {
      titulo: "Demanda fuerte",
      detalle: `Promedia ${formatNumber(promedio, { maximumFractionDigits: 1 })} unidades por mes. Si es estacional, conviene mirar los meses pico para preparar compra.`,
    };
  }

  if (promedio >= 1) {
    return {
      titulo: "Demanda estable",
      detalle: `Promedia ${formatNumber(promedio, { maximumFractionDigits: 1 })} unidades por mes. Sirve para sostener stock sin sobredimensionar.`,
    };
  }

  return {
    titulo: "Movimiento bajo",
    detalle: "Se vendió, pero con baja frecuencia. Antes de sobrestockear, revisá margen, proveedor y tiempo sin venta.",
  };
}

function shortMonth(value) {
  const [, month] = String(value || "").split("-");
  const labels = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return labels[Number(month)] || value;
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
    borderRadius: radius.md,
    padding: spacing.md,
    fontWeight: 800,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) repeat(3, minmax(140px, 180px)) auto",
    gap: spacing.sm,
    alignItems: "center",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: "#fff",
    padding: "0 12px",
    minHeight: 44,
    minWidth: 0,
  },
  searchInput: {
    border: 0,
    outline: 0,
    width: "100%",
    fontSize: typography.body.fontSize,
    fontWeight: 700,
    minWidth: 0,
  },
  input: {
    minHeight: 44,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: "#fff",
    padding: "0 12px",
    fontWeight: 800,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: spacing.md,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(360px, .6fr)",
    gap: spacing.lg,
    alignItems: "start",
  },
  listCard: {
    padding: 0,
    overflow: "hidden",
  },
  detailCard: {
    padding: spacing.lg,
    position: "sticky",
    top: 12,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
  },
  cardTitle: {
    margin: 0,
    color: colors.text,
    fontSize: 22,
    lineHeight: 1.1,
  },
  cardSubtitle: {
    margin: "4px 0 0",
    color: colors.textMuted,
    fontSize: 14,
  },
  periodPill: {
    alignSelf: "flex-start",
    border: `1px solid ${colors.border}`,
    borderRadius: 999,
    padding: "7px 10px",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  tableWrap: {
    overflow: "auto",
  },
  table: {
    width: "100%",
    minWidth: 860,
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: 12,
    color: colors.textMuted,
    background: "#f8fafc",
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 12,
    textTransform: "uppercase",
  },
  row: {
    cursor: "pointer",
    borderBottom: `1px solid ${colors.borderSoft || "#f1f5f9"}`,
  },
  rowActive: {
    background: "#fff7ed",
    boxShadow: "inset 4px 0 0 #ff6a00",
  },
  td: {
    padding: 12,
    verticalAlign: "top",
  },
  tdStrong: {
    padding: 12,
    verticalAlign: "top",
    fontWeight: 950,
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: 700,
  },
  muted: {
    color: colors.textMuted,
    padding: spacing.lg,
  },
  detailTop: {
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  detailTitle: {
    margin: "4px 0 0",
    color: colors.text,
    fontSize: 24,
    lineHeight: 1.1,
  },
  reading: {
    display: "grid",
    gap: 5,
    padding: spacing.md,
    borderRadius: radius.md,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#7c2d12",
    marginBottom: spacing.md,
  },
  detailMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: spacing.sm,
  },
  info: {
    display: "grid",
    gap: 4,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: spacing.sm,
    background: "#fff",
    minWidth: 0,
  },
  sectionTitle: {
    margin: `${spacing.lg}px 0 ${spacing.sm}px`,
    fontSize: 16,
    color: colors.text,
  },
  bars: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(34px, 1fr))",
    gap: 8,
    alignItems: "end",
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: "#fff",
  },
  barItem: {
    display: "grid",
    gap: 4,
    justifyItems: "center",
    minWidth: 0,
  },
  barTrack: {
    height: 120,
    width: 18,
    display: "flex",
    alignItems: "end",
    justifyContent: "center",
    background: "#f1f5f9",
    borderRadius: 999,
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    background: "linear-gradient(180deg, #ff8a3d, #ff6a00)",
    borderRadius: 999,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 800,
  },
  barValue: {
    color: colors.text,
    fontSize: 11,
  },
  notes: {
    margin: 0,
    paddingLeft: 18,
    color: colors.textMuted,
    lineHeight: 1.5,
    fontWeight: 700,
  },
};
