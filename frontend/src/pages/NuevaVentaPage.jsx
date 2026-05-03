import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarCatalogoPOS, listarCategorias } from "../services/catalogoService";
import { listarClientes } from "../services/clientesService";
import { crearVenta } from "../services/ventasService";

const ID_USUARIO = 1;
const ID_SUCURSAL = 1;
const DEFAULT_LIMIT = 80;

const MEDIOS_SIMULADOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "tarjeta", label: "Tarjeta" },
];

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
  const [pagosSimulados, setPagosSimulados] = useState([]);
  const [pagoForm, setPagoForm] = useState({ medio_pago: "efectivo", monto: "" });

  const [observaciones, setObservaciones] = useState("");
  const [usarCredito, setUsarCredito] = useState(true);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

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
      setCatalogo(catalogoData || []);

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
      });

      setCatalogo(data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el catálogo POS");
    } finally {
      setBuscando(false);
    }
  }

  const total = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + Number(item.precio_minorista || 0) * Number(item.cantidad || 0),
      0
    );
  }, [items]);

  const totalPagadoSimulado = useMemo(() => {
    return pagosSimulados.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
  }, [pagosSimulados]);

  const saldoSimulado = Math.max(total - totalPagadoSimulado, 0);

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
    if (item.motivo_no_disponible === "sin_stock") return "Sin stock";
    if (item.motivo_no_disponible === "precio_no_definido") return "Precio no definido";
    if (item.stockeable && Number(item.stock_disponible || 0) <= 0) return "Sin stock";
    if (getPrecio(item) <= 0) return "Precio no definido";
    return "No disponible";
  }

  function puedeAgregar(item) {
    if (item.disponible_para_venta === false) return false;

    // Backend actual de ventas NO recibe precio manual.
    // Por eso no permitimos cerrar un producto con precio 0 aunque permita precio libre.
    if (getPrecio(item) <= 0) return false;

    if (item.stockeable && Number(item.stock_disponible || 0) <= 0) return false;

    return true;
  }

  function agregarItem(producto) {
    if (!puedeAgregar(producto)) {
      setError(`No se puede agregar: ${getMotivoBloqueo(producto)}`);
      return;
    }

    setError("");
    setMensaje("");

    setItems((actual) => {
      const existente = actual.find((item) => Number(item.id_variante) === Number(producto.id_variante));

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
          Number(item.id_variante) === Number(producto.id_variante)
            ? { ...item, cantidad: nuevaCantidad }
            : item
        );
      }

      return [
        ...actual,
        {
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
        },
      ];
    });
  }

  function cambiarCantidad(idVariante, nuevaCantidadRaw) {
    const nuevaCantidad = Number(nuevaCantidadRaw);

    if (!Number.isFinite(nuevaCantidad)) return;

    if (nuevaCantidad <= 0) {
      quitarItem(idVariante);
      return;
    }

    setItems((actual) =>
      actual.map((item) => {
        if (Number(item.id_variante) !== Number(idVariante)) return item;

        if (item.stockeable && nuevaCantidad > Number(item.stock_disponible || 0)) {
          setError("La cantidad supera el stock disponible");
          return item;
        }

        return { ...item, cantidad: nuevaCantidad };
      })
    );
  }

  function quitarItem(idVariante) {
    setItems((actual) => actual.filter((item) => Number(item.id_variante) !== Number(idVariante)));
    setPagosSimulados([]);
  }

  function vaciarVenta() {
    setItems([]);
    setPagosSimulados([]);
    setObservaciones("");
    setPagoForm({ medio_pago: "efectivo", monto: "" });
    setError("");
    setMensaje("");
  }

  function agregarPagoSimulado(e) {
    e.preventDefault();

    const monto = Number(pagoForm.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto del pago debe ser mayor a 0");
      return;
    }

    if (monto > saldoSimulado) {
      setError("El pago simulado supera el saldo de la venta");
      return;
    }

    setPagosSimulados((actual) => [
      ...actual,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        medio_pago: pagoForm.medio_pago,
        monto,
      },
    ]);

    setPagoForm((actual) => ({ ...actual, monto: "" }));
    setError("");
  }

  function quitarPagoSimulado(id) {
    setPagosSimulados((actual) => actual.filter((pago) => pago.id !== id));
  }

  async function cerrarVenta() {
    if (!clienteId) {
      setError("Seleccioná un cliente");
      return;
    }

    if (items.length === 0) {
      setError("Agregá al menos un item");
      return;
    }

    const payload = {
      id_cliente: Number(clienteId),
      id_sucursal: ID_SUCURSAL,
      id_usuario: ID_USUARIO,
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: String(item.cantidad),
        id_bicicleta_serializada: null,
      })),
      pagos: pagosSimulados.map((pago) => ({
        medio_pago: pago.medio_pago,
        monto: String(pago.monto),
        nota: null,
      })),
      observaciones: observaciones.trim() || null,
      usar_credito: usarCredito,
      monto_credito_a_aplicar: null,
    };

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await crearVenta(payload);

      navigate(`/ventas/${resultado.venta_id}?pagar=1`);
    } catch (err) {
      setError(err.message || "No se pudo cerrar la venta");
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
            <div style={topSubtleStyle}>POS compatible con ventas + pagos + caja</div>
          </div>
        </div>

        <div style={topSearchWrapStyle}>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

      <main style={layoutStyle}>
        <section style={leftPanelStyle}>
          <div style={searchRowStyle}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                        {producto.stockeable ? (
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

          <section style={cartStyle}>
            {items.length === 0 ? (
              <div style={emptyCartStyle}>Agregá productos desde el listado.</div>
            ) : (
              items.map((item) => (
                <div key={item.id_variante} style={cartItemStyle}>
                  <div>
                    <strong>{item.descripcion}</strong>
                    <div style={mutedStyle}>{item.codigo}</div>
                  </div>

                  <div style={cartPriceStyle}>{formatMoney(item.precio_minorista)}</div>

                  <div style={qtyControlStyle}>
                    <button onClick={() => cambiarCantidad(item.id_variante, Number(item.cantidad) - 1)}>-</button>
                    <input
                      value={item.cantidad}
                      type="number"
                      min="1"
                      step="1"
                      onChange={(e) => cambiarCantidad(item.id_variante, e.target.value)}
                      style={qtyInputStyle}
                    />
                    <button onClick={() => cambiarCantidad(item.id_variante, Number(item.cantidad) + 1)}>+</button>
                  </div>

                  <div style={cartSubtotalStyle}>{formatMoney(Number(item.precio_minorista) * Number(item.cantidad))}</div>

                  <button onClick={() => quitarItem(item.id_variante)} style={removeBtnStyle}>🗑</button>
                </div>
              ))
            )}
          </section>

          <section style={summaryStyle}>
            <div style={summaryLineStyle}>
              <span>Subtotal</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <div style={summaryLineStyle}>
              <span>Descuento</span>
              <strong>{formatMoney(0)}</strong>
            </div>
            <div style={totalLineStyle}>
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </section>

          <section style={paymentsStyle}>
            <div style={paymentsHeaderStyle}>
              <h3 style={{ margin: 0 }}>Pagos simulados</h3>
              <span style={mutedStyle}>Se registran realmente después de cerrar venta</span>
            </div>

            <form onSubmit={agregarPagoSimulado} style={paymentFormStyle}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                placeholder="Monto"
                style={paymentInputStyle}
              />

              <select
                value={pagoForm.medio_pago}
                onChange={(e) => setPagoForm((p) => ({ ...p, medio_pago: e.target.value }))}
                style={paymentSelectStyle}
              >
                {MEDIOS_SIMULADOS.map((medio) => (
                  <option key={medio.value} value={medio.value}>
                    {medio.label}
                  </option>
                ))}
              </select>

              <button type="submit" style={smallPrimaryBtnStyle} disabled={total <= 0 || saldoSimulado <= 0}>
                Agregar
              </button>
            </form>

            <div style={paymentStatusGridStyle}>
              <div style={paidBoxStyle}>
                <span>Pagado visual</span>
                <strong>{formatMoney(totalPagadoSimulado)}</strong>
              </div>

              <div style={dueBoxStyle}>
                <span>Pendiente</span>
                <strong>{formatMoney(saldoSimulado)}</strong>
              </div>
            </div>

            {pagosSimulados.length > 0 && (
              <div style={paymentListStyle}>
                {pagosSimulados.map((pago) => (
                  <div key={pago.id} style={paymentListItemStyle}>
                    <span>{labelMedioPago(pago.medio_pago)}</span>
                    <strong>{formatMoney(pago.monto)}</strong>
                    <button onClick={() => quitarPagoSimulado(pago.id)} style={removeBtnStyle}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </section>

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

          <div style={bottomActionsStyle}>
            <button type="button" onClick={vaciarVenta} style={secondaryBtnStyle}>
              Vaciar
            </button>

            <button
              type="button"
              onClick={cerrarVenta}
              disabled={guardando || items.length === 0}
              style={primaryBtnStyle}
            >
              {guardando ? "Cerrando..." : "Cerrar venta"}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

function labelMedioPago(value) {
  return MEDIOS_SIMULADOS.find((m) => m.value === value)?.label || value;
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

const cartStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  overflow: "hidden",
  minHeight: "240px",
  marginBottom: "12px",
};

const emptyCartStyle = {
  minHeight: "240px",
  display: "grid",
  placeItems: "center",
  color: "#667085",
};

const cartItemStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 92px 112px 98px 34px",
  gap: "8px",
  alignItems: "center",
  padding: "10px",
  borderBottom: "1px solid #f2f4f7",
};

const cartPriceStyle = { textAlign: "right" };
const qtyControlStyle = { display: "flex", alignItems: "center", justifyContent: "center" };
const qtyInputStyle = {
  width: "42px",
  textAlign: "center",
  border: "1px solid #d0d5dd",
  padding: "6px 4px",
};

const cartSubtotalStyle = { textAlign: "right", fontWeight: 800 };
const removeBtnStyle = { border: "none", background: "transparent", cursor: "pointer" };

const summaryStyle = {
  borderTop: "1px solid #eaecf0",
  paddingTop: "10px",
  marginBottom: "12px",
};

const summaryLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "7px 0",
  color: "#475467",
};

const totalLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  paddingTop: "10px",
  fontSize: "24px",
  color: "#0b5bd3",
};

const paymentsStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "12px",
};

const paymentsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  alignItems: "baseline",
  marginBottom: "10px",
};

const paymentFormStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 150px 90px",
  gap: "8px",
  marginBottom: "10px",
};

const paymentInputStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px",
};

const paymentSelectStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px",
};

const smallPrimaryBtnStyle = {
  border: "none",
  borderRadius: "10px",
  background: "#0b5bd3",
  color: "white",
  fontWeight: 800,
};

const paymentStatusGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  marginBottom: "8px",
};

const paidBoxStyle = {
  background: "#ecfdf3",
  border: "1px solid #abefc6",
  color: "#067647",
  borderRadius: "10px",
  padding: "10px",
  display: "grid",
  gap: "4px",
};

const dueBoxStyle = {
  background: "#fff1f0",
  border: "1px solid #fecdca",
  color: "#b42318",
  borderRadius: "10px",
  padding: "10px",
  display: "grid",
  gap: "4px",
};

const paymentListStyle = {
  borderTop: "1px solid #eaecf0",
  paddingTop: "8px",
  display: "grid",
  gap: "6px",
};

const paymentListItemStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 100px 32px",
  alignItems: "center",
};

const fieldStyle = { display: "grid", gap: "6px", marginBottom: "10px", fontWeight: 700 };
const textareaStyle = {
  minHeight: "56px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "9px",
  resize: "vertical",
};

const checkStyle = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "#344054" };

const bottomActionsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr",
  gap: "10px",
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  borderRadius: "12px",
  padding: "14px",
  fontWeight: 800,
};

const primaryBtnStyle = {
  border: "none",
  background: "#12a15f",
  color: "white",
  borderRadius: "12px",
  padding: "14px",
  fontWeight: 900,
  fontSize: "17px",
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
