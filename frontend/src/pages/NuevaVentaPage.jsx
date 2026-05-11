import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listarCatalogoPOS,
  listarCategorias,
  buscarCatalogoPOSExacto,
} from "../services/catalogoService";
import { listarClientes } from "../services/clientesService";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { listarSerializadasDisponibles } from "../services/serializadasService";
import CarritoVentaPanel from "../components/ventas/CarritoVentaPanel";
import ResumenVentaPanel from "../components/ventas/ResumenVentaPanel";
import CheckoutVentaPanel from "../components/ventas/CheckoutVentaPanel";

import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../config/appConfig";

const ID_USUARIO = CURRENT_USER_ID;
const ID_SUCURSAL = CURRENT_SUCURSAL_ID;
const DEFAULT_LIMIT = 80;

function crearLineId() {
  return crypto.randomUUID();
}

export default function NuevaVentaPage() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [catalogo, setCatalogo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [clienteId, setClienteId] = useState("1");

  const [items, setItems] = useState([]);
  const [serializadasPorVariante, setSerializadasPorVariante] = useState({});
  const [cargandoSerializadas, setCargandoSerializadas] = useState({});

  const [observaciones, setObservaciones] = useState("");
  const [usarCredito, setUsarCredito] = useState(true);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mensajePOS, setMensajePOS] = useState("");

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      cargarCatalogo();
    }, 250);

    return () => clearTimeout(handle);
  }, [query, categoriaId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function mostrarMensajePOS(texto) {
    setMensajePOS(texto);

    setTimeout(() => {
      setMensajePOS("");
    }, 2500);
  }

  async function cargarInicial() {
    try {
      setLoading(true);
      setError("");

      const [categoriasData, clientesData, catalogoData] = await Promise.all([
        listarCategorias(),
        listarClientes({ solo_activos: true }),
        listarCatalogoPOS({
          id_sucursal: ID_SUCURSAL,
          limit: DEFAULT_LIMIT,
        }),
      ]);

      setCategorias(categoriasData || []);
      setClientes(clientesData || []);
      setCatalogo(Array.isArray(catalogoData) ? catalogoData : catalogoData?.items || []);

      const consumidorFinal = (clientesData || []).find((c) => Number(c.id) === 1);
      if (consumidorFinal) {
        setClienteId("1");
      } else if ((clientesData || []).length > 0) {
        setClienteId(String(clientesData[0].id));
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar la venta rápida");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogo() {
    try {
      setBuscando(true);
      setError("");

      const data = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL,
        query: query.trim() || undefined,
        categoria_id: categoriaId || undefined,
        limit: DEFAULT_LIMIT,
        offset: 0,
      });

      setCatalogo(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el catálogo POS");
    } finally {
      setBuscando(false);
    }
  }

async function handleBuscarEnter(e) {
  if (e.key !== "Enter") return;

  e.preventDefault();

  const codigo = query.trim();

  if (!codigo) return;

  try {
    setError("");

    const producto = await buscarCatalogoPOSExacto({
      id_sucursal: ID_SUCURSAL,
      codigo,
    });

    if (!producto) {
      mostrarMensajePOS("No se encontró producto para ese código");
      return;
    }

    await agregarItem(producto);

    setQuery("");
    mostrarMensajePOS(`${producto.producto_nombre} agregado`);
    setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
  } catch (err) {
    mostrarMensajePOS(err.message || "No se encontró producto");
  }
}

  async function cargarSerializadasDisponibles(idVariante) {
    const key = String(idVariante);

    if (serializadasPorVariante[key]) return serializadasPorVariante[key];

    try {
      setCargandoSerializadas((p) => ({ ...p, [key]: true }));

      const data = await listarSerializadasDisponibles({
        id_variante: idVariante,
        id_sucursal: ID_SUCURSAL,
      });

      setSerializadasPorVariante((p) => ({
        ...p,
        [key]: data || [],
      }));

      return data || [];
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas serializadas disponibles");
      return [];
    } finally {
      setCargandoSerializadas((p) => ({ ...p, [key]: false }));
    }
  }

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      const precioUnitario = item.bonificado
        ? 0
        : Number(
            item.precio_unitario_manual ||
              item.precio_final ||
              item.precio_minorista ||
              0
          );

      return acc + precioUnitario * Number(item.cantidad || 0);
    }, 0);
  }, [items]);

  function getDescripcion(item) {
    return [item.producto_nombre, item.nombre_variante].filter(Boolean).join(" - ");
  }

  function getCodigo(item) {
    return item.codigo_barras || item.sku || `#${item.id_variante}`;
  }

  function getPrecio(item) {
    return Number(item.precio_minorista || 0);
  }

  function getMotivoBloqueo(item) {
    if (item.motivo_no_disponible === "sin_stock" && !item.serializable) return "Sin stock";
    if (item.motivo_no_disponible === "precio_no_definido") return "Precio no definido";
    if (!item.serializable && item.stockeable && Number(item.stock_disponible || 0) <= 0) return "Sin stock";
    if (getPrecio(item) <= 0) return "Precio no definido";
    return "No disponible";
  }

  function puedeAgregar(item) {
    if (item.disponible_para_venta === false && !item.serializable) return false;
    if (getPrecio(item) <= 0) return false;
    if (item.serializable) return true;
    if (item.stockeable && Number(item.stock_disponible || 0) <= 0) return false;
    return true;
  }

  async function agregarItem(producto) {
    if (!puedeAgregar(producto)) {
      setError(`No se puede agregar: ${getMotivoBloqueo(producto)}`);
      return;
    }

    setError("");
    setMensaje("");

    if (producto.serializable) {
      setItems((actual) => [
        ...actual,
        {
          line_id: crearLineId(),
          id_variante: producto.id_variante,
          id_producto: producto.id_producto,
          descripcion: getDescripcion(producto),
          codigo: getCodigo(producto),
          categoria_nombre: producto.categoria_nombre,
          tipo_item: producto.tipo_item,
          stockeable: producto.stockeable,
          serializable: true,
          stock_disponible: Number(producto.stock_disponible || 0),
          precio_minorista: getPrecio(producto),
          cantidad: 1,
          imagen_principal: producto.imagen_principal,
          id_bicicleta_serializada: null,
          numero_cuadro: "",
          modo_venta_serializada: "caja",
        },
      ]);

      return;
    }

    setItems((actual) => {
      const existente = actual.find(
        (item) =>
          Number(item.id_variante) === Number(producto.id_variante) &&
          !item.id_bicicleta_serializada &&
          !item.bonificado &&
          !item.precio_unitario_manual
      );

      if (existente) {
        const nuevaCantidad = Number(existente.cantidad) + 1;

        if (
          producto.stockeable &&
          nuevaCantidad > Number(producto.stock_disponible || 0)
        ) {
          setError("La cantidad supera el stock disponible");
          return actual;
        }

        return actual.map((item) =>
          item.line_id === existente.line_id
            ? { ...item, cantidad: nuevaCantidad }
            : item
        );
      }

      return [
        ...actual,
        {
          line_id: crearLineId(),
          id_variante: producto.id_variante,
          id_producto: producto.id_producto,
          descripcion: getDescripcion(producto),
          codigo: getCodigo(producto),
          categoria_nombre: producto.categoria_nombre,
          tipo_item: producto.tipo_item,
          stockeable: producto.stockeable,
          serializable: producto.serializable,
          stock_disponible: Number(producto.stock_disponible || 0),
          precio_minorista: getPrecio(producto),
          cantidad: 1,
          imagen_principal: producto.imagen_principal,
          id_bicicleta_serializada: null,
          numero_cuadro: "",
        },
      ];
    });
  }

  function seleccionarSerializada(index, bicicletaIdRaw) {
    const bicicletaId = bicicletaIdRaw ? Number(bicicletaIdRaw) : "";

    setItems((actual) =>
      actual.map((item, i) => {
        if (i !== index) return item;

        const disponibles = serializadasPorVariante[String(item.id_variante)] || [];
        const bici = disponibles.find((b) => Number(b.id) === Number(bicicletaId));

        return {
          ...item,
          id_bicicleta_serializada: bicicletaId || "",
          numero_cuadro: bici?.numero_cuadro || "",
          cantidad: 1,
        };
      })
    );
  }

  function cambiarCantidad(lineId, nuevaCantidadRaw) {
    const nuevaCantidad = Number(nuevaCantidadRaw);

    if (!Number.isFinite(nuevaCantidad)) return;

    if (nuevaCantidad <= 0) {
      quitarItem(lineId);
      return;
    }

    setItems((actual) =>
      actual.map((item) => {
        if (item.line_id !== lineId) return item;

        if (
          item.serializable &&
          item.modo_venta_serializada === "serializada"
        ) {
          setError("Las bicicletas serializadas siempre tienen cantidad 1");
          return { ...item, cantidad: 1 };
        }

        if (
          item.stockeable &&
          nuevaCantidad > Number(item.stock_disponible || 0)
        ) {
          setError("La cantidad supera el stock disponible");
          return item;
        }

        setError("");
        return { ...item, cantidad: nuevaCantidad };
      })
    );
  }

  function quitarItem(lineId) {
    setItems((actual) => actual.filter((item) => item.line_id !== lineId));
  }

  function actualizarItemCarrito(lineId, cambios) {
    setItems((actual) =>
      actual.map((item) =>
        item.line_id === lineId
          ? {
              ...item,
              ...cambios,
            }
          : item
      )
    );
  }

  function vaciarVenta() {
    setItems([]);
    setObservaciones("");
    setError("");
    setMensaje("");
  }

  function validarVentaAntesDeFinalizar() {
    if (!clienteId) {
      setError("Seleccioná un cliente");
      return false;
    }

    if (items.length === 0) {
      setError("Agregá al menos un item");
      return false;
    }

    const serializadaSinCuadro = items.find(
      (item) =>
        item.serializable &&
        item.modo_venta_serializada === "serializada" &&
        !item.id_bicicleta_serializada
    );

    if (serializadaSinCuadro) {
      setError(`Seleccioná número de cuadro para: ${serializadaSinCuadro.descripcion}`);
      return false;
    }

    const serializadasElegidas = items
      .filter((item) => item.id_bicicleta_serializada)
      .map((item) => Number(item.id_bicicleta_serializada));

    if (new Set(serializadasElegidas).size !== serializadasElegidas.length) {
      setError("No podés vender dos veces la misma bicicleta serializada");
      return false;
    }

    return true;
  }

  function crearPayloadVenta(pagos = []) {
    return {
      id_cliente: Number(clienteId),
      id_sucursal: ID_SUCURSAL,
      id_usuario: ID_USUARIO,
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: String(item.cantidad),
        id_bicicleta_serializada:
          item.modo_venta_serializada === "serializada" &&
          item.id_bicicleta_serializada
            ? Number(item.id_bicicleta_serializada)
            : null,

        precio_unitario_manual: item.precio_unitario_manual
          ? String(item.precio_unitario_manual)
          : null,

        bonificado: Boolean(item.bonificado),

        motivo_precio_manual: item.motivo_precio_manual || null,
        motivo_bonificacion: item.motivo_bonificacion || null,
      })),
      pagos,
      observaciones: observaciones.trim() || null,
      usar_credito: pagos.length === 0 ? usarCredito : false,
      monto_credito_a_aplicar: null,
    };
  }

  async function finalizarCheckout({ pagos = [], entregar_ahora }) {
    if (!validarVentaAntesDeFinalizar()) return;

    const payload = crearPayloadVenta(pagos);

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await crearVenta(payload);

      if (entregar_ahora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: ID_USUARIO,
        });
      }

      navigate(`/ventas/${resultado.venta_id}`);
    } catch (err) {
      setError(err.message || "No se pudo finalizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando venta rápida...</p>;
  }

  return (
    <div style={pageStyle}>
      <header style={topBarStyle}>
        <div style={brandStyle}>
          <span style={bikeStyle}>🚲</span>
          <div>
            <strong>Sistema de Ventas - Bicicletería</strong>
            <div style={topSubtleStyle}>POS real: crear, cobrar y entregar desde checkout</div>
          </div>
        </div>

        <div style={topSearchWrapStyle}>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleBuscarEnter}
            placeholder="Buscar producto, código o barra... (F2)"
            style={topSearchStyle}
          />
          <span style={searchIconStyle}>⌕</span>
        </div>

        <div style={topRightStyle}>
          <span>Caja: CAJA 1</span>
          <span>Usuario #{ID_USUARIO}</span>
          <Link to="/ventas" style={topLinkStyle}>Historial</Link>
        </div>
      </header>

      {error && <div style={alertStyle}>Error: {error}</div>}
      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {mensajePOS && (
          <div style={posMessageStyle}>
            {mensajePOS}
          </div>
        )}
      <main style={layoutStyle}>
        <section style={leftPanelStyle}>
          <div style={searchRowStyle}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleBuscarEnter}
              placeholder="Producto, talle, SKU o código de barras"
              style={searchStyle}
            />
            <button onClick={cargarCatalogo} style={iconButtonStyle} disabled={buscando}>
              {buscando ? "..." : "↻"}
            </button>
          </div>

          <div style={categoryRowStyle}>
            <button
              type="button"
              onClick={() => setCategoriaId("")}
              style={!categoriaId ? activeCategoryStyle : categoryStyle}
            >
              Todos
            </button>

            {categorias.map((categoria) => (
              <button
                key={categoria.id}
                type="button"
                onClick={() => setCategoriaId(String(categoria.id))}
                style={String(categoriaId) === String(categoria.id) ? activeCategoryStyle : categoryStyle}
              >
                {categoria.nombre}
              </button>
            ))}
          </div>

          <div style={catalogListStyle}>
            {catalogo.length === 0 ? (
              <div style={emptyStyle}>No hay productos para mostrar.</div>
            ) : (
              catalogo.map((producto) => {
                const bloqueado = !puedeAgregar(producto);

                return (
                  <div
                    key={producto.id_variante}
                    style={bloqueado ? productRowBlockedStyle : productRowStyle}
                  >
                    <div style={imageBoxStyle}>
                      {producto.imagen_principal ? (
                        <img src={producto.imagen_principal} alt={getDescripcion(producto)} style={imageStyle} />
                      ) : (
                        <span style={{ fontSize: "30px" }}>🚲</span>
                      )}
                    </div>

                    <div style={productInfoStyle}>
                      <strong>{getDescripcion(producto)}</strong>
                      <div style={mutedStyle}>{getCodigo(producto)}</div>
                      <div style={tagRowStyle}>
                        <span style={tagStyle}>{producto.categoria_nombre}</span>
                        {producto.serializable ? (
                          <span style={serializableTagStyle}>Bicicleta</span>
                        ) : producto.stockeable ? (
                          <span style={stockTagStyle}>
                            Stock: {Number(producto.stock_disponible || 0).toLocaleString("es-AR")}
                          </span>
                        ) : (
                          <span style={serviceTagStyle}>Servicio</span>
                        )}
                        {bloqueado && <span style={dangerTagStyle}>{getMotivoBloqueo(producto)}</span>}
                      </div>
                    </div>

                    <div style={productPriceStyle}>
                      <strong>{formatMoney(producto.precio_minorista)}</strong>
                      <button
                        type="button"
                        onClick={() => agregarItem(producto)}
                        disabled={bloqueado}
                        style={bloqueado ? addBtnDisabledStyle : addBtnStyle}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside style={rightPanelStyle}>
          <div style={saleTopStyle}>
            <h2 style={{ margin: 0 }}>Venta</h2>

            <label style={clientLabelStyle}>
              Cliente
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={clientSelectStyle}>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre} #{cliente.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <CarritoVentaPanel
            items={items}
            serializadasPorVariante={serializadasPorVariante}
            cargandoSerializadas={cargandoSerializadas}
            onCargarSerializadas={cargarSerializadasDisponibles}
            onSeleccionarSerializada={seleccionarSerializada}
            onCambiarCantidad={cambiarCantidad}
            onQuitarItem={quitarItem}
            onActualizarItem={actualizarItemCarrito}
          />

          <ResumenVentaPanel total={total} />

          <label style={fieldStyle}>
            <span>Observaciones</span>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
              style={textareaStyle}
            />
          </label>

          <label style={checkStyle}>
            <input
              type="checkbox"
              checked={usarCredito}
              onChange={(e) => setUsarCredito(e.target.checked)}
            />
            Aplicar crédito disponible si existe
          </label>

          <CheckoutVentaPanel
            total={total}
            items={items}
            guardando={guardando}
            onVaciar={vaciarVenta}
            onFinalizar={finalizarCheckout}
          />
        </aside>
      </main>
    </div>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f7fb",
  color: "#111827",
};

const topBarStyle = {
  minHeight: "64px",
  background: "#05080d",
  color: "white",
  display: "flex",
  alignItems: "center",
  gap: "18px",
  padding: "0 20px",
  boxShadow: "0 2px 16px rgba(0,0,0,.22)",
};

const brandStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: "300px",
  fontSize: "18px",
};

const bikeStyle = { fontSize: "26px" };
const topSubtleStyle = { fontSize: "12px", color: "#98a2b3", marginTop: "2px" };

const topSearchWrapStyle = {
  position: "relative",
  flex: 1,
  maxWidth: "520px",
};

const topSearchStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#111827",
  color: "white",
  border: "1px solid #344054",
  borderRadius: "10px",
  padding: "11px 38px 11px 13px",
  outline: "none",
};

const searchIconStyle = {
  position: "absolute",
  right: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#d0d5dd",
};

const topRightStyle = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  color: "#e5e7eb",
  fontSize: "14px",
};

const topLinkStyle = {
  color: "white",
  textDecoration: "none",
  border: "1px solid #475467",
  borderRadius: "8px",
  padding: "7px 10px",
};

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(520px, 1fr) minmax(440px, 560px)",
  gap: "14px",
  padding: "14px",
};

const leftPanelStyle = {
  background: "white",
  borderRadius: "14px",
  padding: "14px",
  boxShadow: "0 2px 10px rgba(16,24,40,.08)",
  minWidth: 0,
};

const rightPanelStyle = {
  background: "white",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "0 2px 10px rgba(16,24,40,.08)",
  alignSelf: "start",
  position: "sticky",
  top: "14px",
};

const searchRowStyle = { display: "flex", gap: "8px", marginBottom: "12px" };

const searchStyle = {
  flex: 1,
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "11px 12px",
};

const iconButtonStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "white",
  padding: "0 14px",
};

const categoryRowStyle = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "10px",
  marginBottom: "8px",
};

const categoryStyle = {
  whiteSpace: "nowrap",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "#f9fafb",
  color: "#344054",
  fontWeight: 700,
};

const activeCategoryStyle = {
  ...categoryStyle,
  background: "#0b5bd3",
  color: "white",
  borderColor: "#0b5bd3",
};

const catalogListStyle = {
  display: "grid",
  gap: "10px",
  maxHeight: "calc(100vh - 210px)",
  overflowY: "auto",
  paddingRight: "4px",
};

const productRowStyle = {
  display: "grid",
  gridTemplateColumns: "82px 1fr 130px",
  gap: "12px",
  alignItems: "center",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "10px",
  background: "white",
};

const productRowBlockedStyle = {
  ...productRowStyle,
  opacity: 0.62,
  background: "#f9fafb",
};

const imageBoxStyle = {
  width: "82px",
  height: "72px",
  borderRadius: "10px",
  background: "#f2f4f7",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
};

const imageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const productInfoStyle = { minWidth: 0, display: "grid", gap: "4px" };
const mutedStyle = { color: "#667085", fontSize: "13px" };
const tagRowStyle = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" };
const tagStyle = { background: "#eef4ff", color: "#175cd3", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const stockTagStyle = { background: "#ecfdf3", color: "#067647", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const serializableTagStyle = { background: "#fff8e1", color: "#8a6d00", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const serviceTagStyle = { background: "#fef7c3", color: "#854a0e", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const dangerTagStyle = { background: "#fee4e2", color: "#b42318", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };

const productPriceStyle = {
  display: "grid",
  gap: "8px",
  justifyItems: "end",
  fontSize: "16px",
};

const addBtnStyle = {
  width: "42px",
  height: "34px",
  borderRadius: "10px",
  border: "none",
  background: "#0b5bd3",
  color: "white",
  fontSize: "22px",
  cursor: "pointer",
};

const addBtnDisabledStyle = {
  ...addBtnStyle,
  background: "#d0d5dd",
  cursor: "not-allowed",
};

const saleTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "12px",
};

const clientLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 700,
};

const clientSelectStyle = {
  minWidth: "230px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px",
};

const fieldStyle = {
  display: "grid",
  gap: "6px",
  marginBottom: "10px",
  fontWeight: 700,
};

const textareaStyle = {
  minHeight: "56px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "9px",
  resize: "vertical",
};

const checkStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "12px",
  color: "#344054",
};

const alertStyle = {
  margin: "12px 14px 0",
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #fecdca",
  padding: "10px 12px",
  borderRadius: "10px",
};

const successStyle = {
  margin: "12px 14px 0",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  padding: "10px 12px",
  borderRadius: "10px",
};

const emptyStyle = {
  padding: "40px",
  textAlign: "center",
  color: "#667085",
};
const posMessageStyle = {
  margin: "12px 14px 0",
  background: "#111827",
  color: "white",
  padding: "12px 14px",
  borderRadius: "10px",
  fontWeight: 700,
  boxShadow: "0 6px 24px rgba(0,0,0,.22)",
};