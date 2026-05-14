import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cambiarEstadoVariante,
  subirImagenCatalogo,
  editarProducto,
  editarVariante,
  listarCatalogoPOS,
  listarCategorias,
  listarMarcas,
  obtenerFichaTecnicaProducto,
  reemplazarFichaTecnicaProducto,
} from "../services/catalogoService";
import ProductImage from "../components/catalogo/ProductImage";
import EstadoBadge from "../components/catalogo/EstadoBadge";
import CodeLine from "../components/catalogo/CodeLine";
import CatalogoDetalleModal from "../components/catalogo/CatalogoDetalleModal";

const ID_SUCURSAL_DEFAULT = 1;
const ID_USUARIO = 1;
const LIMIT = 20;

export default function CatalogoPage() {
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [seleccionado, setSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState(null);
  const [productoForm, setProductoForm] = useState(null);
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenPreview, setImagenPreview] = useState("");
  const [fichaTecnica, setFichaTecnica] = useState([]);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  useEffect(() => {
    cargarCategorias();
    cargarMarcas();
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [offset, categoriaId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      cargarCatalogo({ nextOffset: 0 });
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }

      if (e.key === "Escape") {
        cerrarPanel();
        cerrarDetalle();
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

  async function cargarMarcas() {
    try {
      const data = await listarMarcas();
      setMarcas(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las marcas");
    }
  }

  async function cargarCatalogo(options = {}) {
    const nextOffset = options.nextOffset ?? offset;

    try {
      setLoading(true);
      setError("");

      const data = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL_DEFAULT,
        query,
        categoria_id: categoriaId,
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

  function abrirPanel(item) {
    setSeleccionado(item);

    setProductoForm({
      nombre: item.producto_nombre || "",
      id_categoria: item.categoria_id || "",
      id_marca: item.id_marca || "",
    });

    setForm({
      nombre_variante: item.nombre_variante || "",
      alicuota_iva: 21,
      gravado: true,
      permite_precio_libre: Boolean(item.permite_precio_libre),
    });

    setImagenArchivo(null);
    setImagenPreview("");
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setForm(null);
    setProductoForm(null);
    setImagenArchivo(null);
    setImagenPreview("");
    setFichaTecnica([]);
    setCargandoFicha(false);
  }

  function abrirDetalle(item) {
    setDetalle(item);
  }

  function cerrarDetalle() {
    setDetalle(null);
  }
  function fichaVacia() {
    return {
      grupo: "",
      clave: "",
      valor: "",
      orden: 0,
    };
  }

  async function cargarFichaTecnicaProducto(productoId) {
    if (!productoId) return;

    try {
      setCargandoFicha(true);

      const data = await obtenerFichaTecnicaProducto(productoId);

      setFichaTecnica(
        (data || []).map((item, index) => ({
          id: item.id,
          grupo: item.grupo || "",
          clave: item.clave || "",
          valor: item.valor || "",
          orden: item.orden ?? index + 1,
        }))
      );
    } catch (err) {
      setError(err.message || "No se pudo cargar la ficha técnica");
      setFichaTecnica([]);
    } finally {
      setCargandoFicha(false);
    }
  }

  function cambiarFichaTecnica(index, campo, valor) {
    setFichaTecnica((actual) =>
      actual.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item
      )
    );
  }

  function agregarItemFichaTecnica() {
    setFichaTecnica((actual) => [...actual, fichaVacia()]);
  }

  function quitarItemFichaTecnica(index) {
    setFichaTecnica((actual) => actual.filter((_, i) => i !== index));
  }

  async function guardarFichaTecnica(e) {
    e.preventDefault();

    if (!seleccionado?.id_producto) return;

    const items = fichaTecnica
      .filter((item) => item.clave.trim() && item.valor.trim())
      .map((item, index) => ({
        grupo: item.grupo.trim() || "GENERAL",
        clave: item.clave.trim(),
        valor: item.valor.trim(),
        orden: index + 1,
      }));

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await reemplazarFichaTecnicaProducto(seleccionado.id_producto, {
        items,
      });

      setMensaje("Ficha técnica actualizada correctamente.");
      await cargarFichaTecnicaProducto(seleccionado.id_producto);
    } catch (err) {
      setError(err.message || "No se pudo guardar la ficha técnica");
    } finally {
      setProcesando(false);
    }
  }
  async function guardarProducto(e) {
    e.preventDefault();

    if (!seleccionado || !productoForm) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const payload = {
        nombre: productoForm.nombre.trim(),
        id_categoria: Number(productoForm.id_categoria),
        id_marca: productoForm.id_marca ? Number(productoForm.id_marca) : null,
      };

      await editarProducto(seleccionado.id_producto, payload);

      setMensaje("Producto actualizado correctamente.");
      cerrarPanel();
      await cargarCatalogo();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el producto");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarVariante(e) {
    e.preventDefault();

    if (!seleccionado || !form) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const payload = {
        nombre_variante: form.nombre_variante.trim(),
        alicuota_iva: Number(form.alicuota_iva || 21),
        gravado: Boolean(form.gravado),
        permite_precio_libre: Boolean(form.permite_precio_libre),
      };

      await editarVariante(seleccionado.id_variante, payload);

      setMensaje("Variante actualizada correctamente.");
      cerrarPanel();
      await cargarCatalogo();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la variante");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarImagen(e) {
    e.preventDefault();

    if (!seleccionado || !imagenArchivo) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await subirImagenCatalogo({
        archivo: imagenArchivo,
        id_variante: seleccionado.id_variante,
        es_principal: true,
        orden: 0,
      });

      setMensaje("Imagen principal actualizada.");
      cerrarPanel();
      await cargarCatalogo();
    } catch (err) {
      setError(err.message || "No se pudo guardar la imagen");
    } finally {
      setProcesando(false);
    }
  }

  async function toggleEstadoVariante() {
    if (!seleccionado) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await cambiarEstadoVariante(seleccionado.id_variante, {
        activo: !seleccionado.activo,
        id_usuario: ID_USUARIO,
      });

      setMensaje(
        seleccionado.activo
          ? "Variante desactivada correctamente."
          : "Variante activada correctamente."
      );

      cerrarPanel();
      await cargarCatalogo();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado de la variante");
    } finally {
      setProcesando(false);
    }
  }

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.mostrados += 1;
        acc.stockDisponible += Number(item.stock_disponible || 0);
        if (!item.disponible_para_venta) acc.alertas += 1;
        if (item.motivo_no_disponible === "sin_stock") acc.sinStock += 1;
        if (item.motivo_no_disponible === "precio_no_definido") acc.sinPrecio += 1;
        return acc;
      },
      { mostrados: 0, stockDisponible: 0, alertas: 0, sinStock: 0, sinPrecio: 0 }
    );
  }, [items]);

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
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Catálogo</h1>
          <p style={mutedStyle}>
            Productos, variantes, marcas, precios visibles y disponibilidad para venta.
          </p>
        </div>

        <div style={actionsStyle}>
          <button onClick={() => cargarCatalogo()}>Refrescar</button>
          <button onClick={() => navigate("/mercaderia/alta")}>+ Producto</button>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={metricGridStyle}>
        <Metric label="Total filtrado" value={total} />
        <Metric label="Mostrados" value={resumen.mostrados} />
        <Metric label="Stock disponible" value={formatNumber(resumen.stockDisponible)} />
        <Metric label="Alertas" value={resumen.alertas} danger={resumen.alertas > 0} />
        <Metric label="Sin stock" value={resumen.sinStock} danger={resumen.sinStock > 0} />
        <Metric label="Sin precio" value={resumen.sinPrecio} danger={resumen.sinPrecio > 0} />
      </section>

      <section style={cardStyle}>
        <div style={filtersStyle}>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por producto, variante, marca, SKU, código de barras o proveedor...  / para enfocar"
            style={inputStyle}
          />

          <select
            value={categoriaId}
            onChange={(e) => {
              setCategoriaId(e.target.value);
              setOffset(0);
            }}
            style={inputStyle}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div style={layoutStyle}>
        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={tableHeaderStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px" }}>Listado</h2>
              <p style={mutedSmallStyle}>
                Página {paginaActual} de {totalPaginas} · {total} resultados
              </p>
            </div>

            <div style={pagerStyle}>
              <button disabled={!puedeAnterior} onClick={irAnterior}>
                Anterior
              </button>
              <button disabled={!puedeSiguiente} onClick={irSiguiente}>
                Siguiente
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "18px" }}>Cargando catálogo...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: "18px" }}>No hay productos para mostrar.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={thStyle}>Imagen</th>
                    <th style={thStyle}>Producto</th>
                    <th style={thStyle}>Marca</th>
                    <th style={thStyle}>Códigos</th>
                    <th style={thStyle}>Stock</th>
                    <th style={thStyle}>Precios</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id_variante}
                      onDoubleClick={() => abrirDetalle(item)}
                      style={{
                        cursor: "pointer",
                        borderTop: "1px solid #eee",
                        background:
                          seleccionado?.id_variante === item.id_variante
                            ? "#f8fbff"
                            : "white",
                      }}
                    >
                      <td style={tdStyle}>
                        <ProductImage url={item.imagen_principal} />
                      </td>

                      <td style={tdStyle}>
                        <strong>{item.producto_nombre}</strong>
                        <div>{item.nombre_variante}</div>
                        <div style={mutedSmallStyle}>
                          {item.categoria_nombre} · Variante #{item.id_variante}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {item.marca_nombre || "-"}
                        <div style={mutedSmallStyle}>
                          Prov: {item.proveedor_preferido_nombre || "-"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <CodeLine label="SKU" value={item.sku} />
                        <CodeLine label="EAN" value={item.codigo_barras} />
                        <CodeLine label="Prov" value={item.codigo_proveedor} />
                      </td>

                      <td style={tdStyle}>
                        <strong>{formatNumber(item.stock_disponible)}</strong>
                        <div style={mutedSmallStyle}>
                          Físico {formatNumber(item.stock_fisico)} · Res{" "}
                          {formatNumber(item.stock_reservado)} · Pend{" "}
                          {formatNumber(item.stock_vendido_pendiente_entrega)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <strong>{formatMoney(item.precio_minorista)}</strong>
                        <div style={mutedSmallStyle}>
                          Mayorista: {formatMoney(item.precio_mayorista)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <EstadoBadge item={item} />
                      </td>

                      <td style={tdStyle}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();

                            navigate(`/catalogo/productos/${item.id_producto}`);
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {detalle && (
        <CatalogoDetalleModal
          item={detalle}
          onClose={cerrarDetalle}
          onEdit={() => {
              navigate(`/catalogo/productos/${detalle.id_producto}`);
            }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, danger = false }) {
  return (
    <div style={metricStyle}>
      <span style={mutedSmallStyle}>{label}</span>
      <strong style={{ ...metricValueStyle, color: danger ? "#b42318" : "#111827" }}>
        {value}
      </strong>
    </div>
  );
}
function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: 3,
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}
function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}
const mutedSmallStyle = { color: "#667085", fontSize: "13px", marginTop: "4px" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px",
  flexWrap: "wrap",
};
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "16px",
};
const successStyle = {
  background: "#e8fff0",
  color: "#146c2e",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b7ebc6",
  marginBottom: "16px",
};
const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};
const metricStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "14px",
  display: "grid",
  gap: "6px",
};
const metricValueStyle = { fontSize: "22px" };
const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "16px",
  marginBottom: "16px",
};
const filtersStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) 260px",
  gap: "12px",
};
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  fontSize: "15px",
  boxSizing: "border-box",
};
const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(760px, 1fr) 380px",
  gap: "16px",
  alignItems: "start",
};
const tableHeaderStyle = {
  padding: "16px 18px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
};
const pagerStyle = { display: "flex", gap: "8px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1100px" };
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};
const tdStyle = { padding: "10px", verticalAlign: "top" };
const sideStyle = { display: "grid", gap: "0" };
const cardTitleStyle = { marginTop: 0, marginBottom: "6px", fontSize: "20px" };
const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "start",
  marginBottom: "14px",
};
const formStyle = { display: "grid", gap: "10px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const checkStyle = { display: "flex", gap: "8px", alignItems: "center" };
const noteStyle = {
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "10px",
  borderRadius: "8px",
  color: "#344054",
  marginTop: "12px",
};
const identityBoxStyle = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "14px",
};
const subTitleStyle = {
  margin: "0 0 4px",
  fontSize: "16px",
};
const separatorStyle = { height: "1px", background: "#eee", margin: "16px 0" };
const imageStyle = {
  width: "58px",
  height: "58px",
  objectFit: "cover",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
};
const imagePlaceholderStyle = {
  width: "58px",
  height: "58px",
  borderRadius: "12px",
  border: "1px dashed #d0d5dd",
  display: "grid",
  placeItems: "center",
  color: "#667085",
  fontSize: "11px",
  textAlign: "center",
  background: "#f9fafb",
};
const okPillStyle = {
  background: "#ecfdf3",
  color: "#067647",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const warningPillStyle = {
  background: "#fffaeb",
  color: "#b54708",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const dangerPillStyle = {
  background: "#fff1f0",
  color: "#b42318",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const codeLineStyle = { fontSize: "13px", marginBottom: "3px", whiteSpace: "nowrap" };
const dangerButtonStyle = {
  width: "100%",
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #f4c7c3",
  borderRadius: "10px",
  padding: "10px 12px",
  fontWeight: "bold",
};
const okButtonStyle = {
  width: "100%",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #b7ebc6",
  borderRadius: "10px",
  padding: "10px 12px",
  fontWeight: "bold",
};

const infoLabelStyle = {
  color: "#667085",
};