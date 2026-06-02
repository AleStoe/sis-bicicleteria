import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getImageUrl } from "../utils/images";
import {
  obtenerProducto,
  listarVariantes,
  obtenerFichaTecnicaProducto,
  listarCategorias,
  listarMarcas,
  listarCatalogoPOS,
} from "../services/catalogoService";
import { formatMoney, formatNumber } from "../utils/formatters";

const ID_SUCURSAL_DEFAULT = 1;
const TAB_OPERATIVO = "operativo";
const TAB_VARIANTES = "variantes";
const TAB_FICHA = "ficha";

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esBicicleta(producto, categoriaNombre) {
  const texto = normalizarTexto(
    [categoriaNombre, producto?.categoria_nombre, producto?.tipo_bicicleta].filter(Boolean).join(" ")
  );

  return texto.includes("bicicleta") || Boolean(producto?.serializable);
}

function valorMostrar(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return valor;
}

export default function CatalogoProductoDetallePage() {
  const { productoId } = useParams();
  const navigate = useNavigate();

  const [producto, setProducto] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [itemsPOS, setItemsPOS] = useState([]);
  const [fichaTecnica, setFichaTecnica] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [tabActiva, setTabActiva] = useState(TAB_OPERATIVO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargar();
  }, [productoId]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");

      const [productoData, variantesData, fichaData, categoriasData, marcasData] = await Promise.all([
        obtenerProducto(productoId),
        listarVariantes(),
        obtenerFichaTecnicaProducto(productoId),
        listarCategorias(),
        listarMarcas(),
      ]);

      const variantesFiltradas = (variantesData || []).filter(
        (v) => String(v.id_producto) === String(productoId)
      );

      setProducto(productoData);
      setVariantes(variantesFiltradas);
      setFichaTecnica(fichaData || []);
      setCategorias(categoriasData || []);
      setMarcas(marcasData || []);

      const posData = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL_DEFAULT,
        query: productoData?.nombre || undefined,
        limit: 100,
        offset: 0,
      });

      const items = Array.isArray(posData) ? posData : posData?.items || [];
      setItemsPOS(items.filter((item) => String(item.id_producto) === String(productoId)));
    } catch (err) {
      setError(err.message || "No se pudo cargar el producto");
    } finally {
      setLoading(false);
    }
  }

  const categoriaNombre = useMemo(() => {
    return (
      producto?.categoria_nombre ||
      categorias.find((c) => String(c.id) === String(producto?.id_categoria))?.nombre ||
      ""
    );
  }, [producto, categorias]);

  const marcaNombre = useMemo(() => {
    return (
      producto?.marca_nombre ||
      marcas.find((m) => String(m.id) === String(producto?.id_marca))?.nombre ||
      ""
    );
  }, [producto, marcas]);

  const esProductoBicicleta = useMemo(() => {
    return esBicicleta(producto, categoriaNombre);
  }, [producto, categoriaNombre]);

  const imagenPrincipal = useMemo(() => {
    const itemConImagen = itemsPOS.find((item) => item.imagen_principal);
    const varianteConImagen = variantes.find((v) => v.imagen_principal);
    return itemConImagen?.imagen_principal || varianteConImagen?.imagen_principal || null;
  }, [itemsPOS, variantes]);

  const resumenOperativo = useMemo(() => {
    const base = {
      variantes: variantes.length,
      variantesActivas: variantes.filter((v) => v.activo !== false).length,
      disponible: 0,
      fisico: 0,
      reservado: 0,
      pendienteEntrega: 0,
      sinStock: 0,
      sinPrecio: 0,
      serializables: 0,
      precioMinoristaMin: null,
      precioMinoristaMax: null,
      precioMayoristaMin: null,
      precioMayoristaMax: null,
      proveedorPrincipal: "",
      codigoPrincipal: "",
    };

    for (const item of itemsPOS) {
      base.disponible += Number(item.stock_disponible || 0);
      base.fisico += Number(item.stock_fisico || 0);
      base.reservado += Number(item.stock_reservado || 0);
      base.pendienteEntrega += Number(item.stock_vendido_pendiente_entrega || 0);
      if (item.motivo_no_disponible === "sin_stock") base.sinStock += 1;
      if (item.motivo_no_disponible === "precio_no_definido") base.sinPrecio += 1;
      if (item.serializable) base.serializables += 1;

      const minorista = Number(item.precio_minorista || 0);
      const mayorista = Number(item.precio_mayorista || 0);

      if (minorista > 0) {
        base.precioMinoristaMin = base.precioMinoristaMin == null ? minorista : Math.min(base.precioMinoristaMin, minorista);
        base.precioMinoristaMax = base.precioMinoristaMax == null ? minorista : Math.max(base.precioMinoristaMax, minorista);
      }

      if (mayorista > 0) {
        base.precioMayoristaMin = base.precioMayoristaMin == null ? mayorista : Math.min(base.precioMayoristaMin, mayorista);
        base.precioMayoristaMax = base.precioMayoristaMax == null ? mayorista : Math.max(base.precioMayoristaMax, mayorista);
      }

      if (!base.proveedorPrincipal && item.proveedor_preferido_nombre) {
        base.proveedorPrincipal = item.proveedor_preferido_nombre;
      }

      if (!base.codigoPrincipal && item.codigo_proveedor) {
        base.codigoPrincipal = item.codigo_proveedor;
      }
    }

    return base;
  }, [itemsPOS, variantes]);

  const estadoOperativo = useMemo(() => {
    if (!producto?.activo) return { label: "Producto inactivo", tone: "danger" };
    if (resumenOperativo.sinPrecio > 0) return { label: "Revisar precio", tone: "warning" };
    if (resumenOperativo.disponible <= 0 && producto?.stockeable) return { label: "Sin stock disponible", tone: "danger" };
    return { label: "Operativo", tone: "ok" };
  }, [producto, resumenOperativo]);

  if (loading) {
    return <div style={styles.state}>Cargando producto...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!producto) {
    return <div style={styles.error}>Producto no encontrado</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <button type="button" onClick={() => navigate("/catalogo")} style={styles.backButton}>
            ← Volver al catálogo
          </button>
          <p style={styles.kicker}>Detalle operativo</p>
          <h1 style={styles.title}>{producto.nombre}</h1>
          <p style={styles.subtitle}>Producto #{producto.id} · {valorMostrar(categoriaNombre)} · {valorMostrar(marcaNombre)}</p>
        </div>

        <div style={styles.headerActions}>
          <button type="button" onClick={cargar} style={styles.secondaryButton}>Refrescar</button>
          <button type="button" onClick={() => navigate("/catalogo")} style={styles.primaryButton}>Editar rápido en catálogo</button>
        </div>
      </header>

      <section style={styles.topGrid}>
        <article style={styles.imageCard}>
          {imagenPrincipal ? (
            <img src={getImageUrl(imagenPrincipal)} alt={producto.nombre} style={styles.heroImage} />
          ) : (
            <div style={styles.imagePlaceholder}>Sin imagen principal</div>
          )}
        </article>

        <article style={styles.summaryCard}>
          <div style={styles.summaryHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Estado del producto</h2>
              <p style={styles.muted}>Datos útiles para venta, stock y reposición.</p>
            </div>
            <StatusPill tone={estadoOperativo.tone}>{estadoOperativo.label}</StatusPill>
          </div>

          <div style={styles.stockGrid}>
            <Metric label="Disponible" value={formatNumber(resumenOperativo.disponible)} tone="ok" />
            <Metric label="Físico" value={formatNumber(resumenOperativo.fisico)} tone="info" />
            <Metric label="Reservado" value={formatNumber(resumenOperativo.reservado)} tone="muted" />
            <Metric label="Pendiente entrega" value={formatNumber(resumenOperativo.pendienteEntrega)} tone="warning" />
          </div>

          <div style={styles.businessGrid}>
            <Info label="Proveedor principal" value={resumenOperativo.proveedorPrincipal} />
            <Info label="Código proveedor" value={resumenOperativo.codigoPrincipal} />
            <Info label="Precio minorista" value={rangoPrecio(resumenOperativo.precioMinoristaMin, resumenOperativo.precioMinoristaMax)} />
            <Info label="Precio mayorista" value={rangoPrecio(resumenOperativo.precioMayoristaMin, resumenOperativo.precioMayoristaMax)} />
            <Info label="Variantes activas" value={`${resumenOperativo.variantesActivas} / ${resumenOperativo.variantes}`} />
            <Info label="Serializable" value={producto.serializable ? "Sí" : "No"} />
          </div>
        </article>
      </section>

      <nav style={styles.tabs}>
        <TabButton active={tabActiva === TAB_OPERATIVO} onClick={() => setTabActiva(TAB_OPERATIVO)}>Operativo</TabButton>
        <TabButton active={tabActiva === TAB_VARIANTES} onClick={() => setTabActiva(TAB_VARIANTES)}>Variantes ({resumenOperativo.variantes})</TabButton>
        <TabButton active={tabActiva === TAB_FICHA} onClick={() => setTabActiva(TAB_FICHA)}>Ficha técnica ({fichaTecnica.length})</TabButton>
      </nav>

      {tabActiva === TAB_OPERATIVO && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Información operativa</h2>
              <p style={styles.muted}>Lo estructural queda resumido. La edición se hace desde el panel rápido del catálogo.</p>
            </div>
          </div>

          <div style={styles.infoGrid}>
            <Info label="Nombre" value={producto.nombre} />
            <Info label="Categoría" value={categoriaNombre} />
            <Info label="Marca" value={marcaNombre} />
            <Info label="Tipo item" value={producto.tipo_item} />
            <Info label="Activo" value={producto.activo ? "Sí" : "No"} />
            <Info label="Maneja stock" value={producto.stockeable ? "Sí" : "No"} />
            {esProductoBicicleta && <Info label="Rodado" value={producto.rodado} />}
            {esProductoBicicleta && <Info label="Tipo bicicleta" value={producto.tipo_bicicleta} />}
            {esProductoBicicleta && <Info label="Material cuadro" value={producto.material_cuadro} />}
          </div>
        </section>
      )}

      {tabActiva === TAB_VARIANTES && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Variantes comerciales</h2>
              <p style={styles.muted}>Precios, códigos e inventario por variante.</p>
            </div>
          </div>

          {variantes.length === 0 ? (
            <div style={styles.empty}>Este producto no tiene variantes.</div>
          ) : (
            <div style={styles.variantesGrid}>
              {variantes.map((variante) => {
                const itemPOS = itemsPOS.find((item) => String(item.id_variante) === String(variante.id));

                return (
                  <article key={variante.id} style={styles.varianteCard}>
                    <div style={styles.varianteHeader}>
                      <div>
                        <strong style={styles.varianteTitle}>{variante.nombre_variante || "Única"}</strong>
                        <p style={styles.smallText}>Variante #{variante.id}</p>
                      </div>
                      <StatusPill tone={variante.activo === false ? "danger" : "ok"}>{variante.activo === false ? "Inactiva" : "Activa"}</StatusPill>
                    </div>

                    <div style={styles.varianteBody}>
                      <Info label="Disponible" value={formatNumber(itemPOS?.stock_disponible ?? 0)} />
                      <Info label="Físico" value={formatNumber(itemPOS?.stock_fisico ?? 0)} />
                      <Info label="Reservado" value={formatNumber(itemPOS?.stock_reservado ?? 0)} />
                      <Info label="Pendiente entrega" value={formatNumber(itemPOS?.stock_vendido_pendiente_entrega ?? 0)} />
                      <Info label="Minorista" value={formatMoney(variante.precio_minorista)} />
                      <Info label="Mayorista" value={formatMoney(variante.precio_mayorista)} />
                      <Info label="SKU" value={variante.sku} />
                      <Info label="EAN" value={variante.codigo_barras} />
                      <Info label="Código proveedor" value={variante.codigo_proveedor} />
                      {esProductoBicicleta && <Info label="Talle" value={variante.talle} />}
                      <Info label={esProductoBicicleta ? "Color" : "Color / presentación"} value={variante.color} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tabActiva === TAB_FICHA && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Ficha técnica</h2>
              <p style={styles.muted}>Componentes y especificaciones del producto base.</p>
            </div>
          </div>

          {fichaTecnica.length === 0 ? (
            <div style={styles.empty}>Este producto no tiene ficha técnica cargada.</div>
          ) : (
            <div style={styles.fichaGrid}>
              {fichaTecnica.map((item) => (
                <div key={item.id} style={styles.fichaItem}>
                  <div style={styles.fichaGrupo}>{item.grupo || "GENERAL"}</div>
                  <div style={styles.fichaClave}>{item.clave}</div>
                  <strong>{item.valor || "-"}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function rangoPrecio(min, max) {
  if (min == null && max == null) return "-";
  if (min === max) return formatMoney(min);
  return `${formatMoney(min)} - ${formatMoney(max)}`;
}

function StatusPill({ tone = "muted", children }) {
  return <span style={{ ...styles.statusPill, ...(styles.statusTones[tone] || {}) }}>{children}</span>;
}

function TabButton({ active, onClick, children }) {
  return <button type="button" onClick={onClick} style={active ? styles.tabActive : styles.tab}>{children}</button>;
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
      <strong>{valorMostrar(value)}</strong>
    </div>
  );
}

const tabBase = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "11px 14px",
  fontWeight: 1000,
  cursor: "pointer",
};

const styles = {
  page: {
    display: "grid",
    gap: 18,
    padding: 22,
    background: "#f1f5f9",
    minHeight: "100vh",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 16,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
  },
  backButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    marginBottom: 10,
    fontWeight: 900,
    color: "#0f172a",
    padding: 0,
  },
  kicker: {
    margin: 0,
    color: "#f97316",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 32,
    lineHeight: 1.12,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    color: "#64748b",
    margin: "7px 0 0",
    fontWeight: 700,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    background: "#0f172a",
    color: "white",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "340px minmax(0, 1fr)",
    gap: 16,
    alignItems: "stretch",
  },
  imageCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
    minHeight: 300,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    minHeight: 270,
    objectFit: "contain",
    borderRadius: 18,
    background: "#f8fafc",
  },
  imagePlaceholder: {
    height: "100%",
    minHeight: 270,
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    background: "#f8fafc",
    fontWeight: 900,
  },
  summaryCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
    display: "grid",
    gap: 14,
  },
  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  muted: {
    color: "#64748b",
    margin: "4px 0 0",
    fontWeight: 700,
  },
  stockGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(130px, 1fr))",
    gap: 10,
  },
  businessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  metric: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
    background: "#f8fafc",
  },
  metricTones: {
    ok: { background: "#ecfdf5", borderColor: "#bbf7d0", color: "#047857" },
    info: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" },
    warning: { background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" },
    muted: { background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" },
  },
  statusPill: {
    borderRadius: 999,
    padding: "8px 11px",
    fontWeight: 1000,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  statusTones: {
    ok: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
    warning: { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
    danger: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
    muted: { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" },
  },
  tabs: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
  },
  tab: {
    ...tabBase,
    background: "white",
    color: "#334155",
  },
  tabActive: {
    ...tabBase,
    background: "#2563eb",
    borderColor: "#2563eb",
    color: "white",
    boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)",
  },
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    marginBottom: 14,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
  },
  infoBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#ffffff",
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  variantesGrid: {
    display: "grid",
    gap: 12,
  },
  varianteCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    background: "#fff",
    display: "grid",
    gap: 12,
  },
  varianteHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
  },
  varianteTitle: {
    fontSize: 17,
  },
  varianteBody: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  smallText: {
    color: "#64748b",
    fontSize: 13,
    margin: "4px 0 0",
    fontWeight: 700,
  },
  fichaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  fichaItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  fichaGrupo: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  fichaClave: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 4,
    fontWeight: 800,
  },
  empty: {
    color: "#64748b",
    padding: 18,
    borderRadius: 14,
    background: "#f8fafc",
    fontWeight: 900,
  },
  state: {
    padding: 24,
    fontWeight: 900,
  },
  error: {
    padding: 24,
    color: "#b42318",
    fontWeight: 900,
  },
};
