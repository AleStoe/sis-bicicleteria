import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getImageUrl } from "../utils/images";
import {
  obtenerProducto,
  listarVariantes,
  obtenerFichaTecnicaProducto,
  listarCategorias,
  listarMarcas,
  editarProducto,
  editarVariante,
  subirImagenCatalogo,
  listarImagenesProducto,
  eliminarImagenCatalogo,
  listarCatalogoPOS,
} from "../services/catalogoService";
import { actualizarPrecioVariante } from "../services/preciosService";
import { listarProveedores } from "../services/proveedoresService";
import { useSession } from "../context/SessionContext";
import { formatMoney, formatNumber } from "../utils/formatters";
import { Button, EmptyState, PageHeader } from "../components/ui";
import { ArrowLeft, PackageSearch, RefreshCw } from "lucide-react";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";

const ID_SUCURSAL_DEFAULT = 1;
const TAB_OPERATIVO = "operativo";
const TAB_VARIANTES = "variantes";
const TAB_FICHA = "ficha";
const MOBILE_BREAKPOINT = 760;
const RUBROS_PRODUCTO = ["BICICLETAS", "REPUESTOS", "ACCESORIOS", "INDUMENTARIA", "SERVICIOS"];

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => setIsMobile(event.matches);

    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);

    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

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
  const { usuarioId } = useSession();
  const isMobile = useIsMobile();

  const [producto, setProducto] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [itemsPOS, setItemsPOS] = useState([]);
  const [fichaTecnica, setFichaTecnica] = useState([]);
  const [productoImagenes, setProductoImagenes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [tabActiva, setTabActiva] = useState(TAB_OPERATIVO);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [productoForm, setProductoForm] = useState(null);
  const [variantesForm, setVariantesForm] = useState({});
  const [imagenForm, setImagenForm] = useState({});
  const [productoImagenArchivo, setProductoImagenArchivo] = useState(null);
  const [productoImagenPreview, setProductoImagenPreview] = useState("");

  useEffect(() => {
    cargar();
  }, [productoId]);

  useEffect(() => {
    if (!productoImagenArchivo) {
      setProductoImagenPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(productoImagenArchivo);
    setProductoImagenPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [productoImagenArchivo]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");

      const [productoData, variantesData, fichaData, categoriasData, marcasData, proveedoresData, imagenesProductoData] = await Promise.all([
        obtenerProducto(productoId),
        listarVariantes(),
        obtenerFichaTecnicaProducto(productoId),
        listarCategorias(),
        listarMarcas(),
        listarProveedores({ solo_activos: true }),
        listarImagenesProducto(productoId),
      ]);

      const variantesFiltradas = (variantesData || []).filter(
        (v) => String(v.id_producto) === String(productoId)
      );

      setProducto(productoData);
      setVariantes(variantesFiltradas);
      setFichaTecnica(fichaData || []);
      setProductoImagenes(imagenesProductoData || []);
      setCategorias(categoriasData || []);
      setMarcas(marcasData || []);
      setProveedores(proveedoresData || []);
      setProductoForm({
        nombre: productoData?.nombre || "",
        rubro: productoData?.rubro || "REPUESTOS",
        id_categoria: productoData?.id_categoria || "",
        id_marca: productoData?.id_marca || "",
        rodado: productoData?.rodado || "",
        tipo_bicicleta: productoData?.tipo_bicicleta || "",
        material_cuadro: productoData?.material_cuadro || "",
      });
      setVariantesForm(
        Object.fromEntries(
          variantesFiltradas.map((v) => [
            v.id,
            {
              nombre_variante: v.nombre_variante || "",
              codigo_proveedor: v.codigo_proveedor || "",
              proveedor_preferido_id: v.proveedor_preferido_id || "",
              talle: v.talle || "",
              color: v.color || "",
              precio_minorista: v.precio_minorista ?? "0",
              precio_mayorista: v.precio_mayorista ?? "0",
            },
          ])
        )
      );
      setImagenForm({});
      setProductoImagenArchivo(null);

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

  function setProductoCampo(campo, valor) {
    setProductoForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function setVarianteCampo(varianteId, campo, valor) {
    setVariantesForm((prev) => ({
      ...prev,
      [varianteId]: {
        ...(prev[varianteId] || {}),
        [campo]: valor,
      },
    }));
  }

  async function guardarProducto(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await editarProducto(producto.id, {
        nombre: productoForm.nombre,
        rubro: productoForm.rubro || "REPUESTOS",
        id_categoria: Number(productoForm.id_categoria),
        id_marca: productoForm.id_marca ? Number(productoForm.id_marca) : null,
        rodado: productoForm.rodado || null,
        tipo_bicicleta: productoForm.tipo_bicicleta || null,
        material_cuadro: productoForm.material_cuadro || null,
      });

      setMensaje("Producto actualizado.");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el producto");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarImagenProducto() {
    if (!productoImagenArchivo) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await subirImagenCatalogo({
        archivo: productoImagenArchivo,
        id_producto: producto.id,
        es_principal: true,
        orden: 0,
      });

      setMensaje("Imagen principal actualizada.");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la imagen principal");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarImagenPrincipalProducto() {
    if (!imagenProductoPrincipal) return;

    const confirmar = window.confirm("¿Eliminar la imagen principal de este producto?");
    if (!confirmar) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await eliminarImagenCatalogo(imagenProductoPrincipal.id);

      setMensaje("Imagen principal eliminada.");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo eliminar la imagen principal");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarVariante(variante) {
    const form = variantesForm[variante.id] || {};

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await editarVariante(variante.id, {
        nombre_variante: form.nombre_variante,
        codigo_proveedor: form.codigo_proveedor || null,
        proveedor_preferido_id: form.proveedor_preferido_id ? Number(form.proveedor_preferido_id) : null,
        talle: form.talle || null,
        color: form.color || null,
      });

      const precioCambio =
        Number(form.precio_minorista || 0) !== Number(variante.precio_minorista || 0) ||
        Number(form.precio_mayorista || 0) !== Number(variante.precio_mayorista || 0);

      if (precioCambio) {
        await actualizarPrecioVariante(variante.id, {
          precio_minorista: form.precio_minorista || "0",
          precio_mayorista: form.precio_mayorista || "0",
          motivo: "Corrección operativa desde catálogo",
          id_usuario: usuarioId,
          tipo_movimiento: "actualizacion_manual",
          origen_tipo: "catalogo",
          origen_id: producto.id,
        });
      }

      const archivo = imagenForm[variante.id];
      if (archivo) {
        await subirImagenCatalogo({
          archivo,
          id_variante: variante.id,
          es_principal: true,
          orden: 0,
        });
      }

      setMensaje("Variante actualizada.");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la variante");
    } finally {
      setGuardando(false);
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

  const imagenProductoPrincipal = useMemo(() => {
    return (
      productoImagenes.find((imagen) => imagen.es_principal && imagen.activo !== false) ||
      productoImagenes.find((imagen) => imagen.activo !== false) ||
      null
    );
  }, [productoImagenes]);

  const imagenPrincipal = useMemo(() => {
    const itemConImagen = itemsPOS.find((item) => item.imagen_principal);
    const varianteConImagen = variantes.find((v) => v.imagen_principal);
    return imagenProductoPrincipal?.url || itemConImagen?.imagen_principal || varianteConImagen?.imagen_principal || null;
  }, [imagenProductoPrincipal, itemsPOS, variantes]);

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
    return <EmptyState icon={PackageSearch} title="Cargando producto..." description="Actualizando ficha, variantes y stock." />;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!producto) {
    return <EmptyState icon={PackageSearch} title="Producto no encontrado" description="Volvé al catálogo e intentá nuevamente." />;
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title={producto.nombre}
        subtitle={`Producto #${producto.id} · ${valorMostrar(categoriaNombre)} · ${valorMostrar(marcaNombre)}`}
        eyebrow="Detalle operativo"
        actions={(
          <>
            <Button type="button" variant="outline" onClick={() => navigate("/catalogo")}><ArrowLeft size={16} /> Volver</Button>
            <Button type="button" onClick={() => setTabActiva(TAB_OPERATIVO)}>Editar producto</Button>
            <Button type="button" variant="outline" onClick={cargar}><RefreshCw size={16} /> Refrescar</Button>
          </>
        )}
      />

      {mensaje && <div style={styles.successBox}>{mensaje}</div>}

      <section style={{ ...styles.topGrid, ...(isMobile ? styles.topGridMobile : {}) }}>
        <article style={{ ...styles.imageCard, ...(isMobile ? styles.imageCardMobile : {}) }}>
          {imagenPrincipal ? (
            <img src={getImageUrl(imagenPrincipal)} alt={producto.nombre} style={{ ...styles.heroImage, ...(isMobile ? styles.heroImageMobile : {}) }} />
          ) : (
            <div style={{ ...styles.imagePlaceholder, ...(isMobile ? styles.imagePlaceholderMobile : {}) }}>Sin imagen principal</div>
          )}
        </article>

        <article style={{ ...styles.summaryCard, ...(isMobile ? styles.summaryCardMobile : {}) }}>
          <div style={{ ...styles.summaryHeader, ...(isMobile ? styles.summaryHeaderMobile : {}) }}>
            <div>
              <h2 style={styles.sectionTitle}>Estado del producto</h2>
              <p style={styles.muted}>Datos útiles para venta, stock y reposición.</p>
            </div>
            <StatusPill tone={estadoOperativo.tone}>{estadoOperativo.label}</StatusPill>
          </div>

          <div style={{ ...styles.stockGrid, ...(isMobile ? styles.stockGridMobile : {}) }}>
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

      <nav style={{ ...styles.tabs, ...(isMobile ? styles.tabsMobile : {}) }}>
        <TabButton active={tabActiva === TAB_OPERATIVO} onClick={() => setTabActiva(TAB_OPERATIVO)}>Operativo</TabButton>
        <TabButton active={tabActiva === TAB_VARIANTES} onClick={() => setTabActiva(TAB_VARIANTES)}>Variantes ({resumenOperativo.variantes})</TabButton>
        <TabButton active={tabActiva === TAB_FICHA} onClick={() => setTabActiva(TAB_FICHA)}>Ficha técnica ({fichaTecnica.length})</TabButton>
      </nav>

      {tabActiva === TAB_OPERATIVO && (
        <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Información operativa</h2>
              <p style={styles.muted}>Resumen de datos estructurales. La edición completa queda pendiente para este detalle.</p>
            </div>
          </div>

          <form onSubmit={guardarProducto} style={styles.editForm}>
            <label style={styles.field}>
              <span>Nombre del producto</span>
              <input style={styles.input} value={productoForm?.nombre || ""} onChange={(e) => setProductoCampo("nombre", e.target.value)} />
            </label>
            <label style={styles.field}>
              <span>Rubro</span>
              <select style={styles.input} value={productoForm?.rubro || "REPUESTOS"} onChange={(e) => setProductoCampo("rubro", e.target.value)}>
                {RUBROS_PRODUCTO.map((rubro) => <option key={rubro} value={rubro}>{rubro}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span>Categoría</span>
              <select style={styles.input} value={productoForm?.id_categoria || ""} onChange={(e) => setProductoCampo("id_categoria", e.target.value)}>
                <option value="">Seleccionar...</option>
                {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span>Marca</span>
              <select style={styles.input} value={productoForm?.id_marca || ""} onChange={(e) => setProductoCampo("id_marca", e.target.value)}>
                <option value="">Sin marca</option>
                {marcas.map((marca) => <option key={marca.id} value={marca.id}>{marca.nombre}</option>)}
              </select>
            </label>
            {esProductoBicicleta && (
              <>
                <label style={styles.field}><span>Rodado</span><input style={styles.input} value={productoForm?.rodado || ""} onChange={(e) => setProductoCampo("rodado", e.target.value)} /></label>
                <label style={styles.field}><span>Tipo bicicleta</span><input style={styles.input} value={productoForm?.tipo_bicicleta || ""} onChange={(e) => setProductoCampo("tipo_bicicleta", e.target.value)} /></label>
                <label style={styles.field}><span>Material cuadro</span><input style={styles.input} value={productoForm?.material_cuadro || ""} onChange={(e) => setProductoCampo("material_cuadro", e.target.value)} /></label>
              </>
            )}
            <div style={styles.formActions}>
              <button type="submit" disabled={guardando} style={styles.primaryButton}>{guardando ? "Guardando..." : "Guardar producto"}</button>
            </div>
          </form>

          <div style={styles.imageManager}>
            <div>
              <h3 style={styles.imageManagerTitle}>Imagen principal</h3>
              <p style={styles.muted}>Sirve para catalogo, ventas, PDFs y consulta rapida.</p>
            </div>

            <div style={{ ...styles.imageManagerGrid, ...(isMobile ? styles.imageManagerGridMobile : {}) }}>
              <div style={styles.imagePreviewBox}>
                <span style={styles.previewLabel}>Actual</span>
                {imagenProductoPrincipal?.url ? (
                  <img src={getImageUrl(imagenProductoPrincipal.url)} alt={producto.nombre} style={styles.imagePreview} />
                ) : (
                  <div style={styles.imagePreviewEmpty}>Sin imagen principal</div>
                )}
              </div>

              <div style={styles.imagePreviewBox}>
                <span style={styles.previewLabel}>Nueva imagen</span>
                {productoImagenPreview ? (
                  <img src={productoImagenPreview} alt="Preview nueva imagen" style={styles.imagePreview} />
                ) : (
                  <div style={styles.imagePreviewEmpty}>Selecciona un archivo para previsualizar</div>
                )}
              </div>

              <div style={styles.imageActionsBox}>
                <label style={styles.field}>
                  <span>{imagenProductoPrincipal?.url ? "Reemplazar imagen" : "Agregar imagen"}</span>
                  <input
                    style={styles.input}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProductoImagenArchivo(e.target.files?.[0] || null)}
                  />
                </label>

                <div style={styles.formActions}>
                  <button
                    type="button"
                    disabled={guardando || !productoImagenArchivo}
                    onClick={guardarImagenProducto}
                    style={styles.primaryButton}
                  >
                    {guardando ? "Guardando..." : imagenProductoPrincipal?.url ? "Guardar reemplazo" : "Guardar imagen"}
                  </button>
                  {imagenProductoPrincipal?.url && (
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={eliminarImagenPrincipalProducto}
                      style={styles.dangerButton}
                    >
                      Eliminar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.infoGrid, ...(isMobile ? styles.infoGridMobile : {}) }}>
            <Info label="Nombre" value={producto.nombre} />
            <Info label="Rubro" value={producto.rubro} />
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
        <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Variantes comerciales</h2>
              <p style={styles.muted}>Precios, códigos e inventario por variante.</p>
            </div>
          </div>

          {variantes.length === 0 ? (
            <div style={styles.empty}>Este producto no tiene variantes.</div>
          ) : (
            <div style={{ ...styles.variantesGrid, ...(isMobile ? styles.variantesGridMobile : {}) }}>
              {variantes.map((variante) => {
                const itemPOS = itemsPOS.find((item) => String(item.id_variante) === String(variante.id));

                return (
                  <article key={variante.id} style={{ ...styles.varianteCard, ...(isMobile ? styles.varianteCardMobile : {}) }}>
                    <div style={{ ...styles.varianteHeader, ...(isMobile ? styles.varianteHeaderMobile : {}) }}>
                      <div>
                        <strong style={styles.varianteTitle}>{variante.nombre_variante || "Única"}</strong>
                        <p style={styles.smallText}>Variante #{variante.id}</p>
                      </div>
                      <StatusPill tone={variante.activo === false ? "danger" : "ok"}>{variante.activo === false ? "Inactiva" : "Activa"}</StatusPill>
                    </div>

                    <div style={{ ...styles.varianteBody, ...(isMobile ? styles.varianteBodyMobile : {}) }}>
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

                    <div style={styles.variantEditBox}>
                      <h3 style={styles.variantEditTitle}>Editar variante</h3>
                      <div style={styles.editForm}>
                        <label style={styles.field}>
                          <span>Nombre variante</span>
                          <input style={styles.input} value={variantesForm[variante.id]?.nombre_variante || ""} onChange={(e) => setVarianteCampo(variante.id, "nombre_variante", e.target.value)} />
                        </label>
                        <label style={styles.field}>
                          <span>Proveedor preferido</span>
                          <select style={styles.input} value={variantesForm[variante.id]?.proveedor_preferido_id || ""} onChange={(e) => setVarianteCampo(variante.id, "proveedor_preferido_id", e.target.value)}>
                            <option value="">Sin proveedor</option>
                            {proveedores.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>#{proveedor.id} - {proveedor.nombre}</option>)}
                          </select>
                        </label>
                        <label style={styles.field}><span>Código proveedor</span><input style={styles.input} value={variantesForm[variante.id]?.codigo_proveedor || ""} onChange={(e) => setVarianteCampo(variante.id, "codigo_proveedor", e.target.value)} /></label>
                        <label style={styles.field}><span>Talle</span><input style={styles.input} value={variantesForm[variante.id]?.talle || ""} onChange={(e) => setVarianteCampo(variante.id, "talle", e.target.value)} /></label>
                        <label style={styles.field}><span>Color / presentación</span><input style={styles.input} value={variantesForm[variante.id]?.color || ""} onChange={(e) => setVarianteCampo(variante.id, "color", e.target.value)} /></label>
                        <label style={styles.field}><span>Precio minorista</span><input style={styles.input} type="number" value={variantesForm[variante.id]?.precio_minorista || ""} onChange={(e) => setVarianteCampo(variante.id, "precio_minorista", e.target.value)} /></label>
                        <label style={styles.field}><span>Precio mayorista</span><input style={styles.input} type="number" value={variantesForm[variante.id]?.precio_mayorista || ""} onChange={(e) => setVarianteCampo(variante.id, "precio_mayorista", e.target.value)} /></label>
                        <label style={styles.field}><span>Imagen principal</span><input style={styles.input} type="file" accept="image/*" onChange={(e) => setImagenForm((prev) => ({ ...prev, [variante.id]: e.target.files?.[0] || null }))} /></label>
                      </div>
                      <div style={styles.formActions}>
                        <button type="button" disabled={guardando} onClick={() => guardarVariante(variante)} style={styles.primaryButton}>{guardando ? "Guardando..." : "Guardar variante"}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tabActiva === TAB_FICHA && (
        <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Ficha técnica</h2>
              <p style={styles.muted}>Componentes y especificaciones del producto base.</p>
            </div>
          </div>

          {fichaTecnica.length === 0 ? (
            <div style={styles.empty}>Este producto no tiene ficha técnica cargada.</div>
          ) : (
            <div style={{ ...styles.fichaGrid, ...(isMobile ? styles.fichaGridMobile : {}) }}>
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
  minHeight: controls.minHeight,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: controls.padding,
  fontWeight: typography.button.fontWeight,
  cursor: "pointer",
};

const styles = {
  page: {
    display: "grid",
    gap: spacing.xl,
    minHeight: "100vh",
    color: colors.text,
    fontFamily: typography.fontFamily,
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
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    boxShadow: shadows.sm,
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
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    boxShadow: shadows.sm,
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
    fontSize: typography.sectionTitle.fontSize,
    fontWeight: typography.sectionTitle.fontWeight,
  },
  muted: {
    color: colors.textMuted,
    margin: "4px 0 0",
    lineHeight: typography.body.lineHeight,
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
  editForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  field: {
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 11px",
    fontWeight: 800,
    color: "#0f172a",
    background: "white",
    boxSizing: "border-box",
  },
  formActions: {
    display: "flex",
    gap: 10,
    alignItems: "end",
    flexWrap: "wrap",
  },
  successBox: {
    border: "1px solid #86efac",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 14,
    padding: 12,
    fontWeight: 900,
  },
  imageManager: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    background: "#f8fbff",
    padding: 14,
    marginBottom: 14,
    display: "grid",
    gap: 12,
  },
  imageManagerTitle: {
    margin: 0,
    fontSize: 17,
  },
  imageManagerGrid: {
    display: "grid",
    gridTemplateColumns: "170px 170px minmax(240px, 1fr)",
    gap: 12,
    alignItems: "stretch",
  },
  imagePreviewBox: {
    border: "1px solid #dbeafe",
    borderRadius: 14,
    background: "white",
    padding: 10,
    display: "grid",
    gap: 7,
    minHeight: 150,
  },
  previewLabel: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
  },
  imagePreview: {
    width: "100%",
    height: 112,
    objectFit: "contain",
    borderRadius: 10,
    background: "#f8fafc",
  },
  imagePreviewEmpty: {
    minHeight: 112,
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    padding: 10,
    color: "#64748b",
    fontWeight: 900,
    fontSize: 13,
  },
  imageActionsBox: {
    display: "grid",
    alignContent: "center",
    gap: 12,
    minWidth: 0,
  },
  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
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
  variantEditBox: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 12,
    display: "grid",
    gap: 10,
  },
  variantEditTitle: {
    margin: 0,
    fontSize: 16,
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
  pageMobile: {
    padding: 10,
    gap: 12,
    overflowX: "hidden",
  },
  headerMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    padding: 14,
    borderRadius: 18,
  },
  titleMobile: {
    fontSize: 25,
    lineHeight: 1.15,
  },
  subtitleMobile: {
    fontSize: 13,
    lineHeight: 1.35,
  },
  headerActionsMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    width: "100%",
  },
  topGridMobile: {
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  imageCardMobile: {
    padding: 12,
    borderRadius: 18,
    minHeight: 0,
  },
  heroImageMobile: {
    minHeight: 190,
    maxHeight: 230,
  },
  imagePlaceholderMobile: {
    minHeight: 180,
  },
  summaryCardMobile: {
    padding: 14,
    borderRadius: 18,
  },
  summaryHeaderMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
  },
  stockGridMobile: {
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  tabsMobile: {
    flexWrap: "nowrap",
    overflowX: "auto",
    paddingBottom: 4,
    WebkitOverflowScrolling: "touch",
  },
  cardMobile: {
    padding: 14,
    borderRadius: 18,
  },
  infoGridMobile: {
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  imageManagerGridMobile: {
    gridTemplateColumns: "1fr",
  },
  variantesGridMobile: {
    gap: 10,
  },
  varianteCardMobile: {
    padding: 12,
    borderRadius: 16,
  },
  varianteHeaderMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  varianteBodyMobile: {
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  fichaGridMobile: {
    gridTemplateColumns: "1fr",
    gap: 8,
  },

};
