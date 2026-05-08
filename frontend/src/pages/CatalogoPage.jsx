import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cambiarEstadoVariante,
  crearImagenCatalogo,
  editarProducto,
  editarVariante,
  listarCatalogoPOS,
  listarCategorias,
  listarMarcas,
} from "../services/catalogoService";

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
  const [imagenUrl, setImagenUrl] = useState("");

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

    setImagenUrl("");
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setForm(null);
    setProductoForm(null);
    setImagenUrl("");
  }

  function abrirDetalle(item) {
    setDetalle(item);
  }

  function cerrarDetalle() {
    setDetalle(null);
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

    if (!seleccionado || !imagenUrl.trim()) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await crearImagenCatalogo({
        id_producto: null,
        id_variante: seleccionado.id_variante,
        url: imagenUrl.trim(),
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
                            abrirPanel(item);
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

        <aside style={sideStyle}>
          {!seleccionado ? (
            <section style={cardStyle}>
              <h2 style={cardTitleStyle}>Panel de edición</h2>
              <p style={mutedStyle}>
                Seleccioná una variante para editar producto, variante e imagen.
                Los precios se manejan aparte desde el módulo de precios.
              </p>
              <div style={noteStyle}>
                Atajos: <strong>/</strong> enfoca búsqueda · <strong>Esc</strong> cierra panel.
              </div>
              <div style={noteStyle}>
                Doble click sobre un artículo para ver imagen grande y detalle completo.
              </div>
            </section>
          ) : (
            <section style={cardStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={cardTitleStyle}>Editar catálogo</h2>
                  <p style={mutedSmallStyle}>
                    {seleccionado.producto_nombre} · Variante #{seleccionado.id_variante}
                  </p>
                </div>
                <button type="button" onClick={cerrarPanel}>
                  ×
                </button>
              </div>

              <div style={identityBoxStyle}>
                <strong>Identidad fija</strong>
                <div style={mutedSmallStyle}>SKU: {seleccionado.sku || "-"}</div>
                <div style={mutedSmallStyle}>
                  EAN interno: {seleccionado.codigo_barras || "-"}
                </div>
                <div style={mutedSmallStyle}>
                  Código proveedor: {seleccionado.codigo_proveedor || "-"}
                </div>
                <div style={mutedSmallStyle}>
                  Proveedor: {seleccionado.proveedor_preferido_nombre || "-"}
                </div>
              </div>

              <form onSubmit={guardarProducto} style={formStyle}>
                <h3 style={subTitleStyle}>Producto</h3>

                <TextInput
                  label="Nombre producto"
                  value={productoForm?.nombre || ""}
                  onChange={(v) => setProductoForm((p) => ({ ...p, nombre: v }))}
                />

                <label style={fieldStyle}>
                  <span style={labelStyle}>Categoría</span>
                  <select
                    value={productoForm?.id_categoria || ""}
                    onChange={(e) =>
                      setProductoForm((p) => ({
                        ...p,
                        id_categoria: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>Marca</span>
                  <select
                    value={productoForm?.id_marca || ""}
                    onChange={(e) =>
                      setProductoForm((p) => ({ ...p, id_marca: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Sin marca</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="submit" disabled={procesando}>
                  {procesando ? "Guardando..." : "Guardar producto"}
                </button>
              </form>

              <div style={separatorStyle} />

              <form onSubmit={guardarVariante} style={formStyle}>
                <h3 style={subTitleStyle}>Variante</h3>

                <TextInput
                  label="Nombre variante"
                  value={form?.nombre_variante || ""}
                  onChange={(v) => setForm((p) => ({ ...p, nombre_variante: v }))}
                />

                <TextInput
                  label="IVA"
                  type="number"
                  value={form?.alicuota_iva || 21}
                  onChange={(v) => setForm((p) => ({ ...p, alicuota_iva: v }))}
                />

                <label style={checkStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(form?.gravado)}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, gravado: e.target.checked }))
                    }
                  />
                  Gravado
                </label>

                <label style={checkStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(form?.permite_precio_libre)}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        permite_precio_libre: e.target.checked,
                      }))
                    }
                  />
                  Permite precio libre
                </label>

                <button type="submit" disabled={procesando}>
                  {procesando ? "Guardando..." : "Guardar variante"}
                </button>
              </form>

              <div style={separatorStyle} />

              <form onSubmit={guardarImagen} style={formStyle}>
                <h3 style={subTitleStyle}>Imagen</h3>

                <ProductImage url={seleccionado.imagen_principal} />

                <TextInput
                  label="URL imagen principal"
                  value={imagenUrl}
                  onChange={setImagenUrl}
                />

                <button type="submit" disabled={procesando || !imagenUrl.trim()}>
                  {procesando ? "Guardando..." : "Guardar imagen"}
                </button>
              </form>

              <div style={separatorStyle} />

              <button
                type="button"
                onClick={toggleEstadoVariante}
                disabled={procesando}
                style={seleccionado.activo ? dangerButtonStyle : okButtonStyle}
              >
                {seleccionado.activo ? "Desactivar variante" : "Activar variante"}
              </button>

              <div style={noteStyle}>
                SKU y EAN son identidad interna fija. No se editan desde catálogo.
              </div>
            </section>
          )}
        </aside>
      </div>

      {detalle && (
        <DetalleModal
          item={detalle}
          onClose={cerrarDetalle}
          onEdit={() => {
            abrirPanel(detalle);
            cerrarDetalle();
          }}
        />
      )}
    </div>
  );
}

function DetalleModal({ item, onClose, onEdit }) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>{item.producto_nombre}</h2>
            <div style={mutedSmallStyle}>{item.nombre_variante}</div>
          </div>

          <button onClick={onClose}>✕</button>
        </div>

        <div style={modalContentStyle}>
          <div>
            {item.imagen_principal ? (
              <img
                src={item.imagen_principal}
                alt={item.producto_nombre}
                style={modalImageStyle}
              />
            ) : (
              <div style={bigPlaceholderStyle}>Sin imagen</div>
            )}
          </div>

          <div style={modalInfoStyle}>
            <InfoRow label="SKU" value={item.sku} />
            <InfoRow label="EAN" value={item.codigo_barras} />
            <InfoRow label="Código proveedor" value={item.codigo_proveedor} />
            <InfoRow label="Marca" value={item.marca_nombre} />
            <InfoRow label="Categoría" value={item.categoria_nombre} />
            <InfoRow label="Proveedor" value={item.proveedor_preferido_nombre} />
            <InfoRow label="Stock físico" value={formatNumber(item.stock_fisico)} />
            <InfoRow label="Reservado" value={formatNumber(item.stock_reservado)} />
            <InfoRow
              label="Pendiente entrega"
              value={formatNumber(item.stock_vendido_pendiente_entrega)}
            />
            <InfoRow
              label="Stock disponible"
              value={formatNumber(item.stock_disponible)}
            />
            <InfoRow
              label="Precio minorista"
              value={formatMoney(item.precio_minorista)}
            />
            <InfoRow
              label="Precio mayorista"
              value={formatMoney(item.precio_mayorista)}
            />

            <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
              <button onClick={onEdit}>Editar</button>
              <button onClick={onClose}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductImage({ url }) {
  if (!url) {
    return <div style={imagePlaceholderStyle}>Sin imagen</div>;
  }

  return <img src={url} alt="Producto" style={imageStyle} />;
}

function EstadoBadge({ item }) {
  if (item.disponible_para_venta) {
    return <span style={okPillStyle}>Disponible</span>;
  }

  if (item.motivo_no_disponible === "sin_stock") {
    return <span style={dangerPillStyle}>Sin stock</span>;
  }

  if (item.motivo_no_disponible === "precio_no_definido") {
    return <span style={warningPillStyle}>Sin precio</span>;
  }

  return <span style={warningPillStyle}>Revisar</span>;
}

function CodeLine({ label, value }) {
  return (
    <div style={codeLineStyle}>
      <span style={{ color: "#667085" }}>{label}:</span> {value || "-"}
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

function InfoRow({ label, value }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
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
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const mutedSmallStyle = { color: "#667085", fontSize: "13px", marginTop: "4px" };
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
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: "20px",
};
const modalStyle = {
  width: "min(950px, 100%)",
  background: "white",
  borderRadius: "18px",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,.35)",
};
const modalHeaderStyle = {
  padding: "18px 22px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
};
const modalContentStyle = {
  display: "grid",
  gridTemplateColumns: "420px 1fr",
  gap: "20px",
  padding: "22px",
};
const modalImageStyle = {
  width: "100%",
  maxHeight: "420px",
  objectFit: "contain",
  borderRadius: "14px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};
const bigPlaceholderStyle = {
  height: "420px",
  borderRadius: "14px",
  border: "1px dashed #d0d5dd",
  display: "grid",
  placeItems: "center",
  background: "#f9fafb",
  color: "#667085",
};
const modalInfoStyle = {
  display: "grid",
  gap: "10px",
  alignContent: "start",
};
const infoRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  paddingBottom: "10px",
  borderBottom: "1px solid #f2f4f7",
};
const infoLabelStyle = {
  color: "#667085",
};