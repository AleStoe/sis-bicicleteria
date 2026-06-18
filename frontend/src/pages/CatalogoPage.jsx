import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listarCatalogoPOS,
  listarCategorias,
} from "../services/catalogoService";
import ProductImage from "../components/catalogo/ProductImage";
import EstadoBadge from "../components/catalogo/EstadoBadge";
import CatalogoDetalleModal from "../components/catalogo/CatalogoDetalleModal";
import { formatMoney, formatNumber } from "../utils/formatters";
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
  return [item.producto_nombre, item.nombre_variante].filter(Boolean).join(" - ");
}

function getMotivoTexto(item) {
  if (item.disponible_para_venta) return "Listo para vender";
  if (item.motivo_no_disponible === "sin_stock") return "Sin stock disponible";
  if (item.motivo_no_disponible === "precio_no_definido") return "Falta definir precio";
  return "Revisar antes de vender";
}

function tienePrecio(value) {
  return Number(value || 0) > 0;
}

function precioConsulta(value) {
  return tienePrecio(value) ? formatMoney(value) : "No definido";
}

function precioConsultaClipboard(value) {
  return precioConsulta(value).replace(/\$\s+/g, "$");
}

function getNombreConsulta(item) {
  return [item.producto_nombre, item.nombre_variante].filter(Boolean).join("\n");
}

async function copiarTextoPortapapeles(texto) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Sigue con fallback para celulares/navegadores que bloquean permisos.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = texto;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copiado = false;
  try {
    copiado = document.execCommand("copy");
  } catch {
    copiado = false;
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copiado) {
    window.prompt("Copiá este texto para responder la consulta:", texto);
  }

  return copiado;
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

export default function CatalogoPage() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
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
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [offset, categoriaId]);

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
        limit: LIMIT,
        offset: nextOffset,
      });

      setItems(data?.items || []);
      setTotal(Number(data?.total || 0));
    } catch (err) {
      setError(err.message || "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
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

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <span style={styles.kicker}>Catálogo operativo</span>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Catálogo</h1>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
            Productos y variantes listos para POS, stock, imágenes, precios y alertas de venta.
          </p>
        </div>

        <div style={{ ...styles.heroActions, ...(isMobile ? styles.heroActionsMobile : {}) }}>
          <button type="button" onClick={() => cargarCatalogo()} style={styles.secondaryHeroButton}>
            ↻ Refrescar
          </button>
          <button type="button" onClick={() => navigate("/mercaderia/alta")} style={styles.primaryHeroButton}>
            ＋ Alta mercadería
          </button>
          <button type="button" onClick={() => navigate("/mercaderia/bicicletas/alta")} style={styles.secondaryHeroButton}>
            ＋ Alta bicicleta
          </button>
        </div>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.alert}>Error: {error}</div>}

      <section style={{ ...styles.metricsGrid, ...(isMobile ? styles.metricsGridMobile : {}) }}>
        <Metric label="Total filtrado" value={total} tone="dark" />
        <Metric label="Disponibles" value={resumen.disponibles} tone="ok" />
        <Metric label="Stock disponible" value={formatNumber(resumen.stockDisponible)} tone="info" />
        <Metric label="Sin stock" value={resumen.sinStock} tone={resumen.sinStock > 0 ? "danger" : "muted"} />
        <Metric label="Sin precio" value={resumen.sinPrecio} tone={resumen.sinPrecio > 0 ? "warning" : "muted"} />
        <Metric label="Serializables" value={resumen.serializables} tone="orange" />
      </section>

      <section style={{ ...styles.filtersCard, ...(isMobile ? styles.filtersCardMobile : {}) }}>
        <div style={styles.searchBox}>
          <span>🔎</span>
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
            <div style={styles.empty}>Cargando catálogo...</div>
          ) : items.length === 0 ? (
            <div style={styles.empty}>No hay productos para mostrar.</div>
          ) : (
            <div style={{ ...styles.cardsGrid, ...(isMobile ? styles.cardsGridMobile : {}) }}>
              {items.map((item) => (
                <CatalogoCard
                  key={item.id_variante}
                  item={item}
                  selected={seleccionado?.id_variante === item.id_variante}
                  onSelect={() => setSeleccionadoId(item.id_variante)}
                  onOpenDetail={() => setDetalle(item)}
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
          onEdit={() => navigate(`/catalogo/productos/${detalle.id_producto}`)}
        />
      )}
    </div>
  );
}

function CatalogoCard({ item, selected, onSelect, onOpenDetail, isMobile }) {
  const [copiado, setCopiado] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);
  const stockColumns = isMobile
    ? "1fr"
    : Number(item.stock_reservado || 0) > 0
      ? "repeat(3, 1fr)"
      : "repeat(2, 1fr)";
  const precioMinoristaDefinido = tienePrecio(item.precio_minorista);
  const precioMayoristaDefinido = tienePrecio(item.precio_mayorista);
  const puedeCopiarAmbos = precioMinoristaDefinido || precioMayoristaDefinido;
  const nombreConsulta = getNombreConsulta(item) || getTituloItem(item) || "VARIANTE";

  async function copiarConsulta(tipo) {
    let texto = "";

    if (tipo === "minorista") {
      texto = `${nombreConsulta}\nPrecio: ${precioConsultaClipboard(item.precio_minorista)}`;
    }

    if (tipo === "mayorista") {
      texto = `${nombreConsulta}\nPrecio mayorista: ${precioConsultaClipboard(item.precio_mayorista)}`;
    }

    if (tipo === "ambos") {
      texto = [
        nombreConsulta,
        `Precio: ${precioConsultaClipboard(item.precio_minorista)}`,
        `Mayorista: ${precioConsultaClipboard(item.precio_mayorista)}`,
      ].join("\n");
    }

    const copiadoOk = await copiarTextoPortapapeles(texto);
    setCopyFallback(!copiadoOk);

    if (copiadoOk) {
      setCopiado(tipo);
      setTimeout(() => setCopiado((actual) => (actual === tipo ? "" : actual)), 1400);
    } else {
      setTimeout(() => setCopyFallback(false), 3000);
    }
  }

  return (
    <article
      style={{
        ...(selected ? styles.cardSelected : styles.card),
        ...(isMobile ? styles.cardMobile : {}),
      }}
      onClick={onSelect}
    >
      <div
        style={{
          ...styles.cardImageWrap,
          ...(isMobile ? styles.cardImageWrapMobile : {}),
        }}
        onDoubleClick={onOpenDetail}
      >
        <ProductImage url={item.imagen_principal} size={isMobile ? 74 : 96} />
      </div>

      <div style={styles.cardBody}>
        <div style={{ ...styles.cardTop, ...(isMobile ? styles.cardTopMobile : {}) }}>
          <div style={styles.cardTitleWrap}>
            <strong style={styles.cardTitle}>{item.producto_nombre}</strong>
            <span style={styles.cardVariant}>{item.nombre_variante}</span>
          </div>
          <EstadoBadge item={item} />
        </div>

        <div style={styles.tagsRow}>
          {item.marca_nombre && <span style={styles.tag}>{item.marca_nombre}</span>}
          <span style={styles.tag}>{item.categoria_nombre}</span>
          {item.serializable && <span style={styles.serialTag}>Serializada</span>}
        </div>

        <div style={{ ...styles.stockStrip, gridTemplateColumns: stockColumns }}>
          <StockMini label="Disponible" value={item.stock_disponible} tone="ok" />
          <StockMini label="Físico" value={item.stock_fisico} tone="info" />

          {Number(item.stock_reservado || 0) > 0 && (
            <StockMini label="Reservado" value={item.stock_reservado} tone="muted" />
          )}
        </div>

        <div style={{ ...styles.priceGrid, ...(isMobile ? styles.priceGridMobile : {}) }}>
          <div style={styles.priceBox}>
            <span>Minorista</span>
            <strong>{precioConsulta(item.precio_minorista)}</strong>
          </div>
          <div style={styles.priceBox}>
            <span>Mayorista</span>
            <strong>{precioConsulta(item.precio_mayorista)}</strong>
          </div>
        </div>

        <div style={{ ...styles.copyActions, ...(isMobile ? styles.copyActionsMobile : {}) }}>
          <CopyButton
            label="Copiar minorista"
            copied={copiado === "minorista"}
            disabled={!precioMinoristaDefinido}
            onClick={(e) => {
              e.stopPropagation();
              copiarConsulta("minorista");
            }}
          />
          <CopyButton
            label="Copiar mayorista"
            copied={copiado === "mayorista"}
            disabled={!precioMayoristaDefinido}
            onClick={(e) => {
              e.stopPropagation();
              copiarConsulta("mayorista");
            }}
          />
          <CopyButton
            label="Copiar ambos"
            copied={copiado === "ambos"}
            disabled={!puedeCopiarAmbos}
            onClick={(e) => {
              e.stopPropagation();
              copiarConsulta("ambos");
            }}
          />
        </div>

        {copyFallback ? (
          <div style={styles.copyFallbackText}>
            Tu navegador bloqueó el copiado automático. Te dejé el texto abierto para copiar manual.
          </div>
        ) : null}

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

function CopyButton({ label, copied, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={disabled ? styles.copyButtonDisabled : copied ? styles.copyButtonCopied : styles.copyButton}
    >
      {copied ? "Copiado" : label}
    </button>
  );
}


function PanelPreviewCatalogo({ item, onDetalle }) {
  return (
    <section style={styles.previewPanel}>
      <div style={styles.previewHeader}>
        <span style={styles.sideKicker}>Preview operativo</span>
        <h2 style={styles.sideTitle}>{item.producto_nombre}</h2>
        <p style={styles.previewVariant}>{item.nombre_variante || "Variante única"}</p>
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

      <div style={styles.sideInfoGridLight}>
        <Info label="Disponible" value={formatNumber(item.stock_disponible)} />
        <Info label="Físico" value={formatNumber(item.stock_fisico)} />
        <Info label="Minorista" value={formatMoney(item.precio_minorista)} />
        <Info label="Mayorista" value={formatMoney(item.precio_mayorista)} />
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
    padding: 20,
    background: "#f1f5f9",
    color: "#0f172a",
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
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #86efac",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    fontWeight: 800,
  },
  alert: {
    background: "#fff1f0",
    color: "#b42318",
    border: "1px solid #fecdca",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    fontWeight: 800,
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
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: 12,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "0 12px",
    background: "#f8fafc",
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
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "white",
    padding: "12px 13px",
    fontWeight: 800,
    color: "#0f172a",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 370px",
    gap: 16,
    alignItems: "start",
  },
  catalogPanel: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    overflow: "hidden",
    boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)",
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
    fontSize: 22,
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
    gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
    gap: 12,
    padding: 16,
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    background: "white",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "112px minmax(0, 1fr)",
    gap: 12,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
  },
  cardSelected: {
    border: "1px solid #f97316",
    borderRadius: 20,
    background: "#fff7ed",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "112px minmax(0, 1fr)",
    gap: 12,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(249, 115, 22, 0.18)",
  },
  cardImageWrap: {
    borderRadius: 18,
    background: "#f8fafc",
    display: "grid",
    placeItems: "center",
    minHeight: 112,
  },
  cardBody: {
    minWidth: 0,
    display: "grid",
    gap: 10,
  },
  cardTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "start",
  },
  cardTitleWrap: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 1.25,
  },
  cardVariant: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
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
  priceGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  priceBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 9,
    display: "grid",
    gap: 3,
  },
  copyActions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  },
  copyActionsMobile: {
    gridTemplateColumns: "1fr",
  },
  copyButton: {
    minHeight: 34,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 10,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
    whiteSpace: "normal",
  },
  copyButtonCopied: {
    minHeight: 34,
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 10,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
    whiteSpace: "normal",
  },
  copyButtonDisabled: {
    minHeight: 34,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    borderRadius: 10,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "not-allowed",
    whiteSpace: "normal",
  },
  copyFallbackText: {
    marginTop: -2,
    marginBottom: 8,
    padding: "8px 10px",
    borderRadius: 10,
    background: "#fff7ed",
    color: "#9a3412",
    fontWeight: 800,
    fontSize: 12,
    lineHeight: 1.35,
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
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  secondaryButton: {
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
    gridTemplateColumns: "82px minmax(0, 1fr)",
    gap: 10,
    padding: 10,
    borderRadius: 16,
  },
  cardImageWrapMobile: {
    minHeight: 82,
    borderRadius: 14,
  },
  cardTopMobile: {
    gridTemplateColumns: "1fr",
  },
  priceGridMobile: {
    gridTemplateColumns: "1fr",
  },
  sidePanelMobile: {
    position: "static",
    top: "auto",
  },

};
