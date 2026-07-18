import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCatalogoBicicletasPdfUrl,
  getCatalogoMayoristaPdfUrl,
  listarCatalogoPOS,
  listarCategorias,
  listarMarcas,
} from "../services/catalogoService";
import ProductImage from "../components/catalogo/ProductImage";
import EstadoBadge from "../components/catalogo/EstadoBadge";
import CatalogoDetalleModal from "../components/catalogo/CatalogoDetalleModal";
import PreciosComercialesCatalogo from "../components/catalogo/PreciosComercialesCatalogo";
import { formatNumber } from "../utils/formatters";
import {
  esVarianteUnica,
  formatProductoVariante,
} from "../utils/productPresentation";
import {
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  ResponsiveMetricsGrid,
} from "../components/ui";
import {
  Bike,
  FileDown,
  Flame,
  ImageDown,
  PackagePlus,
  RefreshCw,
  Search,
} from "lucide-react";
import { getHistoriaVarianteUrl } from "../services/documentosService";
import { useSession } from "../context/SessionContext";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";
const ID_SUCURSAL_DEFAULT = 1;
const LIMIT = 24;
const MOBILE_BREAKPOINT = 760;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [breakpoint]);

  return isMobile;
}

function getTituloItem(item) {
  return formatProductoVariante(item.producto_nombre, item.nombre_variante);
}

function getMotivoTexto(item) {
  if (
    item.serializable &&
    Number(item.serializadas_disponibles || 0) <= 0 &&
    Number(item.stock_disponible || 0) > 0
  ) {
    return "Pendiente de armado";
  }
  if (item.disponible_para_venta) return "Listo para vender";
  if (item.motivo_no_disponible === "sin_stock") return "Sin exhibición";
  if (item.motivo_no_disponible === "precio_no_definido") return "Falta definir precio";
  return "Revisar antes de vender";
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function esCategoriaBicicletaPorNombre(nombre) {
  const normalizado = normalizarTexto(nombre);
  return normalizado === "bicicletas" || normalizado.includes("bicicleta");
}

function categoriaEsBicicleta(categorias, idCategoria) {
  const categoria = categorias.find((cat) => String(cat.id) === String(idCategoria));
  return esCategoriaBicicletaPorNombre(categoria?.nombre);
}

function fechaDescargaActual() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CatalogoPage() {
  const navigate = useNavigate();
  const { esAdministrador, esEncargado } = useSession();
  const puedeEditarCatalogo = esAdministrador || esEncargado;
  const searchRef = useRef(null);

  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    cargarCategorias();
    cargarMarcas();
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [offset, categoriaId, marcaId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      cargarCatalogo({ nextOffset: 0 });
    }, 320);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }

      if (e.key === "Escape") {
        setDetalle(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function cargarCategorias() {
    try {
      const data = await listarCategorias();
      setCategorias(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las categorías");
    }
  }

  async function cargarCatalogo(options = {}) {
    const nextOffset = options.nextOffset ?? offset;

    try {
      setLoading(true);
      setError("");

      const data = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL_DEFAULT,
        query: query.trim() || undefined,
        categoria_id: categoriaId || undefined,
        marca_id: marcaId || undefined,
        limit: LIMIT,
        offset: nextOffset,
        solo_disponibles: true,
      });

      setItems(data?.items || []);
      setTotal(Number(data?.total || 0));
    } catch (err) {
      setError(err.message || "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }

  async function cargarMarcas() {
    try {
      const data = await listarMarcas();
      setMarcas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las marcas");
    }
  }

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.mostrados += 1;
        acc.stockDisponible += Number(item.stock_disponible || 0);
        acc.stockFisico += Number(item.stock_fisico || 0);
        if (item.disponible_para_venta) acc.disponibles += 1;
        if (item.motivo_no_disponible === "sin_stock") acc.sinStock += 1;
        if (item.motivo_no_disponible === "precio_no_definido") acc.sinPrecio += 1;
        if (item.serializable) acc.serializables += 1;
        return acc;
      },
      {
        mostrados: 0,
        disponibles: 0,
        stockDisponible: 0,
        stockFisico: 0,
        sinStock: 0,
        sinPrecio: 0,
        serializables: 0,
      }
    );
  }, [items]);

  const seleccionado = useMemo(() => {
    return items.find((item) => item.id_variante === seleccionadoId) || items[0] || null;
  }, [items, seleccionadoId]);


  const paginaActual = Math.floor(offset / LIMIT) + 1;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMIT));
  const puedeAnterior = offset > 0;
  const puedeSiguiente = offset + LIMIT < total;

  function irAnterior() {
    if (!puedeAnterior) return;
    setOffset(Math.max(0, offset - LIMIT));
  }

  function irSiguiente() {
    if (!puedeSiguiente) return;
    setOffset(offset + LIMIT);
  }

  function descargarCatalogoMayoristaPdf() {
    const url = getCatalogoMayoristaPdfUrl({
      id_sucursal: ID_SUCURSAL_DEFAULT,
      categoria_id: categoriaId || undefined,
      marca_id: marcaId || undefined,
    });

    const link = document.createElement("a");
    link.href = url;
    link.download = `Catalogo-Mayorista-${fechaDescargaActual()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function descargarCatalogoBicicletasPdf() {
    const url = getCatalogoBicicletasPdfUrl({
      id_sucursal: ID_SUCURSAL_DEFAULT,
      marca_id: marcaId || undefined,
    });

    const link = document.createElement("a");
    link.href = url;
    link.download = `Catalogo-Bicicletas-${fechaDescargaActual()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title="Catálogo"
        subtitle="Productos y variantes listos para POS, stock, imágenes, precios y alertas de venta."
        eyebrow="Catálogo operativo"
        actions={(
          <>
            <Button type="button" variant="outline" onClick={() => cargarCatalogo()}><RefreshCw size={16} /> Refrescar</Button>
            {puedeEditarCatalogo && (
              <>
                <Button type="button" onClick={() => navigate("/mercaderia/alta")}><PackagePlus size={16} /> Alta mercadería</Button>
                <Button type="button" variant="outline" onClick={() => navigate("/mercaderia/bicicletas/alta")}><Bike size={16} /> Alta bicicleta</Button>
              </>
            )}
          </>
        )}
      />

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.alert}>Error: {error}</div>}

      <ResponsiveMetricsGrid minWidth={145} mobileColumns={2}>
        <MetricCard label="Total filtrado" value={total} />
        <MetricCard label="Disponibles" value={resumen.disponibles} tone="success" />
        <MetricCard label="Stock disponible" value={formatNumber(resumen.stockDisponible)} tone="primary" />
        <MetricCard label="Sin stock" value={resumen.sinStock} tone={resumen.sinStock > 0 ? "danger" : "default"} />
        <MetricCard label="Sin precio" value={resumen.sinPrecio} tone={resumen.sinPrecio > 0 ? "warning" : "default"} />
        <MetricCard label="Serializables" value={resumen.serializables} tone="primary" />
      </ResponsiveMetricsGrid>

      <section style={{ ...styles.filtersCard, ...(isMobile ? styles.filtersCardMobile : {}) }}>
        <div style={styles.searchBox}>
          <Search size={18} color={colors.textMuted} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.select();
              }
            }}
            placeholder="Buscar por producto, variante, marca, SKU, código de barras o proveedor..."
            style={styles.searchInput}
          />
          {!isMobile && <kbd style={styles.kbd}>/</kbd>}
        </div>

        <select
          value={categoriaId}
          onChange={(e) => {
            setCategoriaId(e.target.value);
            setOffset(0);
          }}
          style={styles.select}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>

        <select
          value={marcaId}
          onChange={(e) => {
            setMarcaId(e.target.value);
            setOffset(0);
          }}
          style={styles.select}
        >
          <option value="">Todas las marcas</option>
          {marcas.map((marca) => (
            <option key={marca.id} value={marca.id}>
              {marca.nombre}
            </option>
          ))}
        </select>

        <Button type="button" variant="outline" onClick={descargarCatalogoMayoristaPdf}><FileDown size={16} /> Catálogo mayorista</Button>
        <Button type="button" variant="outline" onClick={descargarCatalogoBicicletasPdf}><FileDown size={16} /> Catálogo bicicletas</Button>
      </section>

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={styles.catalogPanel}>
          <div style={{ ...styles.panelHeader, ...(isMobile ? styles.panelHeaderMobile : {}) }}>
            <div>
              <h2 style={styles.panelTitle}>Listado</h2>
              <p style={styles.panelSubtitle}>
                Página {paginaActual} de {totalPaginas} · {total} resultado(s)
              </p>
            </div>

            <div style={{ ...styles.pager, ...(isMobile ? styles.pagerMobile : {}) }}>
              <button type="button" disabled={!puedeAnterior} onClick={irAnterior} style={puedeAnterior ? styles.pagerButton : styles.pagerButtonDisabled}>
                ← Anterior
              </button>
              <button type="button" disabled={!puedeSiguiente} onClick={irSiguiente} style={puedeSiguiente ? styles.pagerButton : styles.pagerButtonDisabled}>
                Siguiente →
              </button>
            </div>
          </div>

          {loading ? (
            <EmptyState title="Cargando catálogo..." description="Actualizando productos y precios comerciales." />
          ) : items.length === 0 ? (
            <EmptyState title="No hay productos para mostrar" description="Probá otra categoría, marca o búsqueda." />
          ) : (
            <div style={{ ...styles.cardsGrid, ...(isMobile ? styles.cardsGridMobile : {}) }}>
              {items.map((item) => (
                <CatalogoCard
                  key={item.id_variante}
                  item={item}
                  selected={seleccionado?.id_variante === item.id_variante}
                  onSelect={() => setSeleccionadoId(item.id_variante)}
                  onOpenDetail={() => setDetalle(item)}
                  onDownloadStory={() => {
                    window.open(
                      getHistoriaVarianteUrl(item.id_variante),
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </section>

        <aside style={{ ...styles.sidePanel, ...(isMobile ? styles.sidePanelMobile : {}) }}>
          {seleccionado ? (
            <PanelPreviewCatalogo
              item={seleccionado}
              onDetalle={() => setDetalle(seleccionado)}
            />
          ) : (
            <section style={styles.sideCardDark}>
              <h2 style={styles.sideTitle}>Sin selección</h2>
              <p style={styles.sideMuted}>Elegí un producto para ver el resumen operativo.</p>
            </section>
          )}
        </aside>
      </main>

      {detalle && (
        <CatalogoDetalleModal
          item={detalle}
          onClose={() => setDetalle(null)}
          onOpenProduct={() => navigate(`/catalogo/productos/${detalle.id_producto}`)}
          puedeEditar={puedeEditarCatalogo}
        />
      )}
    </div>
  );
}

function CatalogoCard({
  item,
  selected,
  onSelect,
  onOpenDetail,
  onDownloadStory,
  isMobile,
}) {
  const stockColumns = isMobile
    ? "1fr"
    : Number(item.stock_reservado || 0) > 0
      ? "repeat(3, 1fr)"
      : "repeat(2, 1fr)";

  return (
    <article
      style={{
        ...(selected ? styles.cardSelected : styles.card),
        ...(isMobile ? styles.cardMobile : {}),
      }}
      onClick={onSelect}
    >
      <div style={styles.cardBody}>
        <div style={styles.cardTop}>
          <div style={styles.cardTitleWrap}>
            <strong style={styles.cardTitle}>{item.producto_nombre}</strong>
            {!esVarianteUnica(item.nombre_variante) && (
              <span style={styles.cardVariant}>{item.nombre_variante}</span>
            )}
          </div>
        </div>

        <div
          style={{
            ...styles.cardImageWrap,
            ...(isMobile ? styles.cardImageWrapMobile : {}),
          }}
          onDoubleClick={onOpenDetail}
        >
          <ProductImage
            url={item.imagen_principal}
            width="100%"
            height={isMobile ? 170 : 200}
          />
        </div>

        <div style={styles.cardMetaRow}>
          <div style={styles.tagsRow}>
            {item.marca_nombre && <span style={styles.tag}>{item.marca_nombre}</span>}
            <span style={styles.tag}>{item.categoria_nombre}</span>
            {item.serializable && <span style={styles.serialTag}>Serializada</span>}
          </div>
          <div style={styles.statusGroup}>
            <EstadoBadge item={item} />
            {item.en_oferta ? (
              <span style={styles.offerBadge}>
                <Flame size={11} fill="currentColor" />
                OFERTA
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ ...styles.stockStrip, gridTemplateColumns: stockColumns }}>
          <StockMini label="Disponible" value={item.stock_disponible} tone="ok" />
          <StockMini label="Físico" value={item.stock_fisico} tone="info" />

          {Number(item.stock_reservado || 0) > 0 && (
            <StockMini label="Reservado" value={item.stock_reservado} tone="muted" />
          )}
        </div>

        <PreciosComercialesCatalogo
          item={item}
          nombre={getTituloItem(item)}
        />

        <div
          style={{
            ...styles.codesBox,
            gridTemplateColumns: isMobile
              ? "1fr"
              : `repeat(${[item.sku, item.codigo_barras, item.codigo_proveedor].filter(Boolean).length || 1}, minmax(0,1fr))`,
          }}
        >
          {item.sku && <CodePill label="SKU" value={item.sku} />}
          {item.codigo_barras && <CodePill label="EAN" value={item.codigo_barras} />}
          {item.codigo_proveedor && <CodePill label="Prov" value={item.codigo_proveedor} />}
        </div>

        <div style={styles.cardActions}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDownloadStory();
            }}
            style={styles.storyButton}
          >
            <ImageDown size={16} />
            Descargar historia
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            style={styles.secondaryButton}
          >
            Ver detalle
          </button>
        </div>
      </div>
    </article>
  );
}

function PanelPreviewCatalogo({ item, onDetalle }) {
  return (
    <section style={styles.previewPanel}>
      <div style={styles.previewHeader}>
        <span style={styles.sideKicker}>Preview operativo</span>
        <h2 style={styles.sideTitle}>{item.producto_nombre}</h2>
        {!esVarianteUnica(item.nombre_variante) && item.nombre_variante && (
          <p style={styles.previewVariant}>{item.nombre_variante}</p>
        )}
      </div>

      <div style={styles.sideImageBoxSoft}>
        <ProductImage url={item.imagen_principal} size={150} />
      </div>

      <div style={styles.statusBoxLight}>
        <EstadoBadge item={item} />
        <small>{getMotivoTexto(item)}</small>
      </div>

      <div style={styles.availableHero}>
        <span>Disponible</span>
        <strong>{formatNumber(item.stock_disponible)}</strong>
      </div>

      <PreciosComercialesCatalogo
        item={item}
        nombre={getTituloItem(item)}
        compact
        mostrarCopiado={false}
      />

      <div style={styles.sideInfoGridLight}>
        <Info label="Disponible" value={formatNumber(item.stock_disponible)} />
        <Info label="Físico" value={formatNumber(item.stock_fisico)} />
        <Info label="Código proveedor" value={item.codigo_proveedor} />
        <Info label="SKU" value={item.sku} />
      </div>

      <button type="button" onClick={onDetalle} style={styles.orangeButtonFull}>
        Ver detalle completo
      </button>
    </section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function StockMini({ label, value, tone }) {
  return (
    <div style={{ ...styles.stockMini, ...(styles.stockMiniTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function CodePill({ label, value }) {
  return (
    <div style={styles.codePill}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gap: spacing.xl,
    color: colors.text,
    fontFamily: typography.fontFamily,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: 22,
    borderRadius: 24,
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "white",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
    marginBottom: 16,
  },
  kicker: {
    display: "block",
    color: "#fb923c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontWeight: 700,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryHeroButton: {
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(249, 115, 22, 0.28)",
  },
  secondaryHeroButton: {
    border: "1px solid rgba(255,255,255,.22)",
    background: "rgba(255,255,255,.08)",
    color: "white",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  success: {
    background: colors.successSoft,
    color: colors.successDark,
    border: `1px solid ${colors.success}`,
    borderRadius: radius.md,
    padding: spacing.md,
    fontWeight: typography.label.fontWeight,
  },
  alert: {
    background: colors.dangerSoft,
    color: colors.dangerDark,
    border: `1px solid ${colors.danger}`,
    borderRadius: radius.md,
    padding: spacing.md,
    fontWeight: typography.label.fontWeight,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  metric: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 5,
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  },
  metricTones: {
    dark: { color: "#0f172a" },
    ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" },
    info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" },
    warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" },
    danger: { color: "#b42318", background: "#fff1f0", borderColor: "#fecdca" },
    muted: { color: "#475569", background: "#f8fafc" },
    orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" },
  },
  filtersCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 200px 200px auto auto",
    gap: 12,
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.md,
    boxShadow: shadows.sm,
  },
  searchBox: {
    minHeight: controls.minHeight,
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "0 12px",
    background: colors.surfaceMuted,
  },
  searchInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    outline: "none",
    padding: "13px 0",
    fontSize: 15,
    fontWeight: 700,
    minWidth: 0,
  },
  kbd: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "3px 7px",
    color: "#64748b",
    background: "white",
    fontWeight: 900,
  },
  select: {
    width: "100%",
    minHeight: controls.minHeight,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: colors.surface,
    padding: controls.padding,
    fontWeight: typography.label.fontWeight,
    color: colors.text,
  },
  pdfButton: {
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "white",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  pdfClientButton: {
    border: "1px solid #047857",
    background: "#047857",
    color: "white",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 370px",
    gap: spacing.lg,
    alignItems: "start",
  },
  catalogPanel: {
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    overflow: "hidden",
    boxShadow: shadows.sm,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottom: "1px solid #e2e8f0",
  },
  panelTitle: {
    margin: 0,
    fontSize: typography.sectionTitle.fontSize,
    fontWeight: typography.sectionTitle.fontWeight,
  },
  panelSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
    fontSize: 13,
  },
  pager: {
    display: "flex",
    gap: 8,
  },
  pagerButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  pagerButtonDisabled: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "not-allowed",
  },
  empty: {
    padding: 22,
    color: "#64748b",
    fontWeight: 900,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 480px), 1fr))",
    gap: 12,
    padding: 16,
  },
  card: {
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.sm,
    background: colors.surface,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
  },
  cardSelected: {
    border: `1px solid ${colors.primary}`,
    borderRadius: radius.sm,
    background: colors.primarySoft,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    cursor: "pointer",
    boxShadow: shadows.md,
  },
  cardImageWrap: {
    borderRadius: 8,
    background: "#f8fafc",
    display: "grid",
    placeItems: "center",
    minHeight: 200,
    minWidth: 0,
  },
  cardBody: {
    minWidth: 0,
    display: "grid",
    gap: 10,
  },
  cardTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  cardTitleWrap: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 1.25,
  },
  cardVariant: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  cardMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  tagsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
  serialTag: {
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
  stockStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  stockMini: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "8px 9px",
    background: "#f8fafc",
    fontSize: 12,
  },
  stockMiniTones: {
    ok: { background: "#ecfdf5", borderColor: "#bbf7d0", color: "#047857" },
    info: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" },
    muted: { background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" },
  },
  codesBox: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  },
  codePill: {
    minWidth: 0,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "6px 8px",
    background: "white",
    display: "grid",
    gap: 2,
    fontSize: 11,
  },
  cardActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 8,
  },
  offerBadge: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    minHeight: 21,
    padding: "2px 6px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 1000,
    lineHeight: 1,
  },
  statusGroup: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 5,
  },
  storyButton: {
    minHeight: 40,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryButton: {
    minHeight: 40,
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    background: "#0f172a",
    color: "white",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },

  previewPanel: {
    background: "white",
    color: "#0f172a",
    borderRadius: 22,
    padding: 16,
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
    display: "grid",
    gap: 12,
  },
  previewHeader: {
    paddingBottom: 12,
    borderBottom: "1px solid #e2e8f0",
  },
  previewVariant: {
    margin: "6px 0 0",
    color: "#64748b",
    fontWeight: 800,
  },
  availableHero: {
    display: "grid",
    gap: 4,
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #bbf7d0",
    borderRadius: 18,
    padding: 16,
  },
  editorPanel: {
    background: "white",
    color: "#0f172a",
    borderRadius: 22,
    padding: 16,
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
  },
  editorHeader: {
    paddingBottom: 12,
    borderBottom: "1px solid #e2e8f0",
    marginBottom: 12,
  },
  sideImageBoxSoft: {
    minHeight: 165,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    placeItems: "center",
    padding: 12,
    marginBottom: 12,
  },
  statusBoxLight: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  contextBox: {
    display: "grid",
    gap: 3,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    color: "#9a3412",
    fontSize: 12,
    fontWeight: 900,
  },
  editorTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  editorTab: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#334155",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  editorTabActive: {
    border: "1px solid #f97316",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  editorLoading: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 16,
    color: "#64748b",
    fontWeight: 900,
    textAlign: "center",
  },
  editorForm: {
    display: "grid",
    gap: 10,
  },
  editorField: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 1000,
    color: "#334155",
  },
  editorInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 11px",
    fontWeight: 800,
    color: "#0f172a",
    boxSizing: "border-box",
    background: "white",
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  editorCheck: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
  },
  orangeButtonFull: {
    width: "100%",
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 13,
    padding: "12px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(249, 115, 22, 0.25)",
  },
  secondaryButtonFull: {
    width: "100%",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 13,
    padding: "12px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  dangerButton: {
    width: "100%",
    border: "1px solid #fecaca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 13,
    padding: "12px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  sideInfoGridLight: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  sidePanel: {
    display: "grid",
    gap: 14,
    position: "sticky",
    top: 16,
  },
  sideCardDark: {
    background: "#0f172a",
    color: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
  },
  sideKicker: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sideTitle: {
    margin: "8px 0 4px",
    fontSize: 24,
    lineHeight: 1.15,
  },
  sideMuted: {
    margin: 0,
    color: "#cbd5e1",
    fontWeight: 700,
  },
  sideImageBox: {
    marginTop: 14,
    minHeight: 190,
    borderRadius: 18,
    background: "white",
    display: "grid",
    placeItems: "center",
    padding: 12,
  },
  statusBox: {
    marginTop: 14,
    background: "#1e293b",
    borderRadius: 16,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sideInfoGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  infoBox: {
    background: "#1e293b",
    borderRadius: 14,
    padding: 10,
    display: "grid",
    gap: 4,
    color: "#cbd5e1",
  },
  sidePriceCard: {
    marginTop: 14,
    background: "rgba(249, 115, 22, 0.14)",
    border: "1px solid rgba(251, 146, 60, 0.32)",
    color: "#fed7aa",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 4,
  },
  sideActions: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  secondaryDarkButton: {
    border: "1px solid rgba(255,255,255,.18)",
    background: "#1e293b",
    color: "white",
    borderRadius: 12,
    padding: "11px 12px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  orangeButton: {
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 12,
    padding: "11px 12px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  pageMobile: {
    padding: 10,
    overflowX: "hidden",
  },
  heroMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "start",
    padding: 16,
    borderRadius: 18,
  },
  titleMobile: {
    fontSize: 26,
  },
  subtitleMobile: {
    fontSize: 13,
    lineHeight: 1.35,
  },
  heroActionsMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    width: "100%",
  },
  metricsGridMobile: {
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  filtersCardMobile: {
    gridTemplateColumns: "1fr",
    padding: 10,
    borderRadius: 16,
  },
  layoutMobile: {
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  panelHeaderMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "stretch",
    padding: 12,
  },
  pagerMobile: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
  },
  cardsGridMobile: {
    gridTemplateColumns: "1fr",
    padding: 10,
  },
  cardMobile: {
    gridTemplateColumns: "minmax(0, 1fr)",
    padding: 10,
    borderRadius: 8,
  },
  cardImageWrapMobile: {
    minHeight: 170,
    borderRadius: 8,
  },
  sidePanelMobile: {
    position: "static",
    top: "auto",
  },

};
