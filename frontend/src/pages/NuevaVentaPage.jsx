import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarCatalogoPOS, listarCategorias } from "../services/catalogoService";
import { listarClientes } from "../services/clientesService";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { listarSerializadasDisponibles } from "../services/serializadasService";
import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../config/appConfig";

const ID_USUARIO = CURRENT_USER_ID;
const ID_SUCURSAL = CURRENT_SUCURSAL_ID;
const DEFAULT_LIMIT = 80;

const MEDIOS_PAGO = [
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
  const [serializadasPorVariante, setSerializadasPorVariante] = useState({});
  const [cargandoSerializadas, setCargandoSerializadas] = useState({});

  const [observaciones, setObservaciones] = useState("");
  const [usarCredito, setUsarCredito] = useState(true);
  const [entregarAhora, setEntregarAhora] = useState(true);

  const [pagosIniciales, setPagosIniciales] = useState([]);
  const [pagoForm, setPagoForm] = useState({
    medio_pago: "efectivo",
    monto: "",
    nota: "",
  });

  const [detalleProducto, setDetalleProducto] = useState(null);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);

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

      if (e.key === "Escape") {
        setDetalleProducto(null);
        setCheckoutAbierto(false);
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
          offset: 0,
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
    return items.reduce(
      (acc, item) => acc + Number(item.precio_minorista || 0) * Number(item.cantidad || 0),
      0
    );
  }, [items]);

  const totalPagadoInicial = useMemo(() => {
    return pagosIniciales.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
  }, [pagosIniciales]);

  const saldoInicial = Math.max(total - totalPagadoInicial, 0);

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => Number(c.id) === Number(clienteId));
  }, [clientes, clienteId]);

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
      const disponibles = await cargarSerializadasDisponibles(producto.id_variante);

      if (disponibles.length === 0) {
        setError("No hay bicicletas serializadas disponibles para esta variante");
        return;
      }

      setItems((actual) => [
        ...actual,
        crearItemCarrito(producto, {
          serializable: true,
          cantidad: 1,
          id_bicicleta_serializada: "",
        }),
      ]);

      return;
    }

    setItems((actual) => {
      const existente = actual.find(
        (item) =>
          Number(item.id_variante) === Number(producto.id_variante) &&
          !item.id_bicicleta_serializada
      );

      if (existente) {
        const nuevaCantidad = Number(existente.cantidad) + 1;

        if (producto.stockeable && nuevaCantidad > Number(producto.stock_disponible || 0)) {
          setError("La cantidad supera el stock disponible");
          return actual;
        }

        return actual.map((item) =>
          Number(item.id_variante) === Number(producto.id_variante) &&
          !item.id_bicicleta_serializada
            ? { ...item, cantidad: nuevaCantidad }
            : item
        );
      }

      return [
        ...actual,
        crearItemCarrito(producto, {
          serializable: Boolean(producto.serializable),
          cantidad: 1,
          id_bicicleta_serializada: null,
        }),
      ];
    });
  }

  function crearItemCarrito(producto, extra) {
    return {
      id_variante: producto.id_variante,
      id_producto: producto.id_producto,
      descripcion: getDescripcion(producto),
      codigo: getCodigo(producto),
      categoria_nombre: producto.categoria_nombre,
      tipo_item: producto.tipo_item,
      stockeable: producto.stockeable,
      serializable: extra.serializable,
      stock_disponible: Number(producto.stock_disponible || 0),
      precio_minorista: getPrecio(producto),
      cantidad: extra.cantidad,
      imagen_principal: producto.imagen_principal,
      id_bicicleta_serializada: extra.id_bicicleta_serializada,
      numero_cuadro: "",
    };
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

  function cambiarCantidad(idVariante, nuevaCantidadRaw, index = null) {
    const nuevaCantidad = Number(nuevaCantidadRaw);
    if (!Number.isFinite(nuevaCantidad)) return;

    if (nuevaCantidad <= 0) {
      quitarItem(idVariante, index);
      return;
    }

    setItems((actual) =>
      actual.map((item, i) => {
        if (index !== null && i !== index) return item;
        if (index === null && Number(item.id_variante) !== Number(idVariante)) return item;

        if (item.serializable) {
          setError("Las bicicletas serializadas siempre tienen cantidad 1");
          return { ...item, cantidad: 1 };
        }

        if (item.stockeable && nuevaCantidad > Number(item.stock_disponible || 0)) {
          setError("La cantidad supera el stock disponible");
          return item;
        }

        return { ...item, cantidad: nuevaCantidad };
      })
    );
  }

  function quitarItem(idVariante, index = null) {
    if (index !== null) {
      setItems((actual) => actual.filter((_, i) => i !== index));
      return;
    }

    setItems((actual) =>
      actual.filter((item) => Number(item.id_variante) !== Number(idVariante))
    );
  }

  function vaciarVenta() {
    setItems([]);
    setPagosIniciales([]);
    setObservaciones("");
    setError("");
    setMensaje("");
  }

  function agregarPagoInicial(e) {
    e.preventDefault();

    const monto = Number(pagoForm.monto || 0);

    if (items.length === 0) {
      setError("Primero agregá productos al carrito");
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto del pago debe ser mayor a 0");
      return;
    }

    if (monto > saldoInicial) {
      setError("El pago no puede superar el saldo restante");
      return;
    }

    setPagosIniciales((actual) => [
      ...actual,
      {
        medio_pago: pagoForm.medio_pago,
        monto: String(monto),
        nota: pagoForm.nota.trim() || null,
      },
    ]);

    setPagoForm((p) => ({
      ...p,
      monto: "",
      nota: "",
    }));

    setError("");
  }

  function quitarPagoInicial(index) {
    setPagosIniciales((actual) => actual.filter((_, i) => i !== index));
  }

  function cobrarSaldoRestante() {
    if (saldoInicial <= 0) return;

    setPagoForm((p) => ({
      ...p,
      monto: String(saldoInicial),
    }));
  }

  function validarVentaAntesDeConfirmar() {
    if (!clienteId) {
      setError("Seleccioná un cliente");
      return false;
    }

    if (items.length === 0) {
      setError("Agregá al menos un item");
      return false;
    }

    const serializadaSinCuadro = items.find(
      (item) => item.serializable && !item.id_bicicleta_serializada
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

    if (totalPagadoInicial > total) {
      setError("El pago inicial no puede superar el total de la venta");
      return false;
    }

    return true;
  }

  function abrirCheckout() {
    if (!validarVentaAntesDeConfirmar()) return;
    setCheckoutAbierto(true);
  }

  async function confirmarVenta() {
    if (!validarVentaAntesDeConfirmar()) return;

    const payload = {
      id_cliente: Number(clienteId),
      id_sucursal: ID_SUCURSAL,
      id_usuario: ID_USUARIO,
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: String(item.cantidad),
        id_bicicleta_serializada: item.id_bicicleta_serializada
          ? Number(item.id_bicicleta_serializada)
          : null,
      })),
      pagos: pagosIniciales.map((pago) => ({
        medio_pago: pago.medio_pago,
        monto: String(pago.monto),
        nota: pago.nota,
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

      if (entregarAhora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: ID_USUARIO,
        });

        navigate(`/ventas/${resultado.venta_id}`);
        return;
      }

      if (Number(resultado.saldo_pendiente || 0) > 0) {
        navigate(`/ventas/${resultado.venta_id}/cobro`);
      } else {
        navigate(`/ventas/${resultado.venta_id}`);
      }
    } catch (err) {
      setError(err.message || "No se pudo cerrar la venta");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando venta rápida...</p>;

  return (
    <div style={pageStyle}>
      <header style={topBarStyle}>
        <div style={brandStyle}>
          <span style={bikeStyle}>🚲</span>
          <div>
            <strong>Sistema de Ventas - Bicicletería</strong>
            <div style={topSubtleStyle}>POS visual: carrito, revisión y cobro inicial</div>
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
          <Link to="/ventas" style={topLinkStyle}>
            Historial
          </Link>
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
                style={
                  String(categoriaId) === String(categoria.id)
                    ? activeCategoryStyle
                    : categoryStyle
                }
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
                    onDoubleClick={() => setDetalleProducto(producto)}
                  >
                    <ProductImage url={producto.imagen_principal} fallback="🚲" />

                    <div style={productInfoStyle}>
                      <strong>{getDescripcion(producto)}</strong>
                      <div style={mutedStyle}>{getCodigo(producto)}</div>
                      <div style={tagRowStyle}>
                        <span style={tagStyle}>{producto.categoria_nombre}</span>
                        {producto.serializable ? (
                          <span style={serializableTagStyle}>Serializada</span>
                        ) : producto.stockeable ? (
                          <span style={stockTagStyle}>
                            Stock: {Number(producto.stock_disponible || 0).toLocaleString("es-AR")}
                          </span>
                        ) : (
                          <span style={serviceTagStyle}>Servicio</span>
                        )}
                        {bloqueado && (
                          <span style={dangerTagStyle}>{getMotivoBloqueo(producto)}</span>
                        )}
                      </div>
                    </div>

                    <div style={productPriceStyle}>
                      <strong>{formatMoney(producto.precio_minorista)}</strong>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          agregarItem(producto);
                        }}
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
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                style={clientSelectStyle}
              >
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
              items.map((item, index) => (
                <div key={`${item.id_variante}-${index}`} style={cartItemStyle}>
                  <ProductImage url={item.imagen_principal} small fallback="🚲" />

                  <div>
                    <strong>{item.descripcion}</strong>
                    <div style={mutedStyle}>{item.codigo}</div>

                    {item.serializable && (
                      <div style={serializadaBoxStyle}>
                        <div style={serializadaTitleStyle}>Número de cuadro obligatorio</div>

                        <select
                          value={item.id_bicicleta_serializada || ""}
                          onFocus={() => cargarSerializadasDisponibles(item.id_variante)}
                          onChange={(e) => seleccionarSerializada(index, e.target.value)}
                          style={serializadaSelectStyle}
                          disabled={cargandoSerializadas[String(item.id_variante)]}
                        >
                          <option value="">
                            {cargandoSerializadas[String(item.id_variante)]
                              ? "Cargando cuadros..."
                              : "Seleccionar cuadro"}
                          </option>

                          {(serializadasPorVariante[String(item.id_variante)] || []).map((bici) => {
                            const usadaEnOtroItem = items.some(
                              (otro, otroIndex) =>
                                otroIndex !== index &&
                                Number(otro.id_bicicleta_serializada) === Number(bici.id)
                            );

                            return (
                              <option key={bici.id} value={bici.id} disabled={usadaEnOtroItem}>
                                {bici.numero_cuadro} #{bici.id}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={qtyControlStyle}>
                    <button
                      onClick={() => cambiarCantidad(item.id_variante, Number(item.cantidad) - 1, index)}
                      disabled={item.serializable}
                    >
                      -
                    </button>
                    <input
                      value={item.cantidad}
                      type="number"
                      min="1"
                      step="1"
                      onChange={(e) => cambiarCantidad(item.id_variante, e.target.value, index)}
                      style={qtyInputStyle}
                      disabled={item.serializable}
                    />
                    <button
                      onClick={() => cambiarCantidad(item.id_variante, Number(item.cantidad) + 1, index)}
                      disabled={item.serializable}
                    >
                      +
                    </button>
                  </div>

                  <div style={cartSubtotalStyle}>
                    {formatMoney(Number(item.precio_minorista) * Number(item.cantidad))}
                  </div>

                  <button onClick={() => quitarItem(item.id_variante, index)} style={removeBtnStyle}>
                    🗑
                  </button>
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
              <span>Pago inicial</span>
              <strong>{formatMoney(totalPagadoInicial)}</strong>
            </div>
            <div style={totalLineStyle}>
              <span>Saldo</span>
              <strong>{formatMoney(saldoInicial)}</strong>
            </div>
          </section>

          <section style={paymentsStyle}>
            <div style={paymentsHeaderStyle}>
              <h3 style={{ margin: 0 }}>Cobro inicial</h3>
              <span style={mutedStyle}>Opcional antes de crear la venta</span>
            </div>

            <div style={medioGridStyle}>
              {MEDIOS_PAGO.map((medio) => (
                <button
                  key={medio.value}
                  type="button"
                  onClick={() => setPagoForm((p) => ({ ...p, medio_pago: medio.value }))}
                  style={pagoForm.medio_pago === medio.value ? medioActiveStyle : medioStyle}
                >
                  {medio.label}
                </button>
              ))}
            </div>

            <form onSubmit={agregarPagoInicial} style={paymentFormStyle}>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                placeholder={formatMoney(saldoInicial)}
                style={paymentInputStyle}
              />

              <button type="button" onClick={cobrarSaldoRestante} style={miniBtnStyle}>
                Saldo
              </button>

              <button type="submit" style={miniPrimaryBtnStyle}>
                Agregar pago
              </button>
            </form>

            {pagosIniciales.length > 0 && (
              <div style={paymentListStyle}>
                {pagosIniciales.map((pago, index) => (
                  <div key={`${pago.medio_pago}-${index}`} style={paymentItemStyle}>
                    <span>{renderMedio(pago.medio_pago)}</span>
                    <strong>{formatMoney(pago.monto)}</strong>
                    <button onClick={() => quitarPagoInicial(index)} style={removeBtnStyle}>
                      🗑
                    </button>
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
              onClick={abrirCheckout}
              disabled={guardando || items.length === 0}
              style={primaryBtnStyle}
            >
              Revisar y confirmar
            </button>
          </div>
        </aside>
      </main>

      {detalleProducto && (
        <ProductPreviewModal
          producto={detalleProducto}
          onClose={() => setDetalleProducto(null)}
          onAdd={() => {
            agregarItem(detalleProducto);
            setDetalleProducto(null);
          }}
          puedeAgregar={puedeAgregar(detalleProducto)}
          motivo={getMotivoBloqueo(detalleProducto)}
        />
      )}

      {checkoutAbierto && (
        <CheckoutModal
          cliente={clienteSeleccionado}
          items={items}
          total={total}
          pagosIniciales={pagosIniciales}
          saldoInicial={saldoInicial}
          usarCredito={usarCredito}
          entregarAhora={entregarAhora}
          setEntregarAhora={setEntregarAhora}
          guardando={guardando}
          onClose={() => setCheckoutAbierto(false)}
          onConfirm={confirmarVenta}
        />
      )}
    </div>
  );
}

function ProductImage({ url, small = false, fallback = "🚲" }) {
  const style = small ? cartImageBoxStyle : imageBoxStyle;

  if (!url) {
    return <div style={style}>{fallback}</div>;
  }

  return (
    <div style={style}>
      <img src={url} alt="Producto" style={imageStyle} />
    </div>
  );
}

function ProductPreviewModal({ producto, onClose, onAdd, puedeAgregar, motivo }) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>{producto.producto_nombre}</h2>
            <div style={mutedStyle}>{producto.nombre_variante}</div>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        <div style={modalContentStyle}>
          <div style={modalImageWrapStyle}>
            {producto.imagen_principal ? (
              <img
                src={producto.imagen_principal}
                alt={producto.producto_nombre}
                style={modalImageStyle}
              />
            ) : (
              <div style={modalImagePlaceholderStyle}>Sin imagen</div>
            )}
          </div>

          <div style={modalInfoStyle}>
            <InfoRow label="Precio" value={formatMoney(producto.precio_minorista)} />
            <InfoRow label="SKU" value={producto.sku || "-"} />
            <InfoRow label="EAN" value={producto.codigo_barras || "-"} />
            <InfoRow label="Código proveedor" value={producto.codigo_proveedor || "-"} />
            <InfoRow label="Categoría" value={producto.categoria_nombre || "-"} />
            <InfoRow
              label="Stock disponible"
              value={Number(producto.stock_disponible || 0).toLocaleString("es-AR")}
            />
            <InfoRow
              label="Tipo"
              value={producto.serializable ? "Serializada" : producto.stockeable ? "Stockeable" : "Servicio"}
            />

            {!puedeAgregar && <div style={dangerNoteStyle}>No disponible: {motivo}</div>}

            <button
              onClick={onAdd}
              disabled={!puedeAgregar}
              style={puedeAgregar ? primaryBtnStyle : disabledBtnStyle}
            >
              Agregar a venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({
  cliente,
  items,
  total,
  pagosIniciales,
  saldoInicial,
  usarCredito,
  entregarAhora,
  setEntregarAhora,
  guardando,
  onClose,
  onConfirm,
}) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={checkoutModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Revisar venta</h2>
            <div style={mutedStyle}>Confirmá antes de mover stock y registrar pagos.</div>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        <div style={checkoutBodyStyle}>
          <div style={noteStyle}>
            Cliente: <strong>{cliente?.nombre || "-"}</strong> · Crédito automático:{" "}
            <strong>{usarCredito ? "Sí" : "No"}</strong>
          </div>

          <label style={checkoutCheckStyle}>
            <input
              type="checkbox"
              checked={entregarAhora}
              onChange={(e) => setEntregarAhora(e.target.checked)}
            />
            <div>
              <strong>Entregar ahora</strong>
              <div style={mutedStyle}>
                Si está activo, al crear la venta también se descuenta el stock físico y queda entregada.
                Si queda saldo pendiente, el backend exigirá permiso para entregar con deuda.
              </div>
            </div>
          </label>

          <div style={checkoutItemsStyle}>
            {items.map((item, index) => (
              <div key={`${item.id_variante}-${index}`} style={checkoutItemStyle}>
                <ProductImage url={item.imagen_principal} small />
                <div>
                  <strong>{item.descripcion}</strong>
                  <div style={mutedStyle}>
                    Cantidad: {item.cantidad}
                    {item.numero_cuadro ? ` · Cuadro: ${item.numero_cuadro}` : ""}
                  </div>
                </div>
                <strong>{formatMoney(Number(item.precio_minorista) * Number(item.cantidad))}</strong>
              </div>
            ))}
          </div>

          <div style={checkoutTotalsStyle}>
            <InfoRow label="Total" value={formatMoney(total)} />
            <InfoRow
              label="Pago inicial"
              value={formatMoney(pagosIniciales.reduce((a, p) => a + Number(p.monto || 0), 0))}
            />
            <InfoRow label="Saldo" value={formatMoney(saldoInicial)} />
          </div>

          <div style={bottomActionsStyle}>
            <button onClick={onClose} style={secondaryBtnStyle}>
              Volver y corregir
            </button>
            <button onClick={onConfirm} disabled={guardando} style={primaryBtnStyle}>
              {guardando ? "Creando..." : "Crear venta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={infoRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function renderMedio(medio) {
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    tarjeta: "Tarjeta",
  };

  return map[medio] || medio;
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

const bikeStyle = {
  fontSize: "26px",
};

const topSubtleStyle = {
  fontSize: "12px",
  color: "#98a2b3",
  marginTop: "2px",
};

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

const searchRowStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "12px",
};

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
  cursor: "pointer",
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
  fontSize: "30px",
};

const cartImageBoxStyle = {
  width: "54px",
  height: "54px",
  borderRadius: "10px",
  background: "#f2f4f7",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  fontSize: "22px",
};

const imageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const productInfoStyle = {
  minWidth: 0,
  display: "grid",
  gap: "4px",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
};

const tagRowStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  marginTop: "2px",
};

const tagStyle = {
  background: "#eef4ff",
  color: "#175cd3",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "12px",
};

const stockTagStyle = {
  background: "#ecfdf3",
  color: "#067647",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "12px",
};

const serializableTagStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "12px",
};

const serviceTagStyle = {
  background: "#fef7c3",
  color: "#854a0e",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "12px",
};

const dangerTagStyle = {
  background: "#fee4e2",
  color: "#b42318",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "12px",
};

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
  gridTemplateColumns: "54px 1fr 112px 98px 34px",
  gap: "8px",
  alignItems: "center",
  padding: "10px",
  borderBottom: "1px solid #f2f4f7",
};

const qtyControlStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const qtyInputStyle = {
  width: "42px",
  textAlign: "center",
  border: "1px solid #d0d5dd",
  padding: "6px 4px",
};

const cartSubtotalStyle = {
  textAlign: "right",
  fontWeight: 800,
};

const removeBtnStyle = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

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

const medioGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "8px",
  marginBottom: "10px",
};

const medioStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#111827",
  borderRadius: "10px",
  padding: "10px",
  fontWeight: 800,
  cursor: "pointer",
};

const medioActiveStyle = {
  ...medioStyle,
  background: "#0b5bd3",
  color: "white",
  borderColor: "#0b5bd3",
};

const paymentFormStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 70px 120px",
  gap: "8px",
};

const paymentInputStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px",
  width: "100%",
  boxSizing: "border-box",
};

const miniBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  borderRadius: "10px",
  fontWeight: 800,
};

const miniPrimaryBtnStyle = {
  border: "none",
  background: "#12a15f",
  color: "white",
  borderRadius: "10px",
  fontWeight: 800,
};

const paymentListStyle = {
  display: "grid",
  gap: "6px",
  marginTop: "10px",
};

const paymentItemStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto 28px",
  gap: "8px",
  alignItems: "center",
  background: "#f9fafb",
  borderRadius: "8px",
  padding: "8px",
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
  textAlign: "center",
};

const disabledBtnStyle = {
  ...primaryBtnStyle,
  background: "#d0d5dd",
  cursor: "not-allowed",
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

const serializadaBoxStyle = {
  marginTop: "8px",
  background: "#fff8e1",
  border: "1px solid #f3dc97",
  borderRadius: "10px",
  padding: "8px",
};

const serializadaTitleStyle = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#8a6d00",
  marginBottom: "6px",
};

const serializadaSelectStyle = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  padding: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: "20px",
};

const modalStyle = {
  width: "min(920px, 100%)",
  background: "white",
  borderRadius: "18px",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,.35)",
};

const checkoutModalStyle = {
  width: "min(760px, 100%)",
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
  gap: "12px",
};

const modalContentStyle = {
  display: "grid",
  gridTemplateColumns: "390px 1fr",
  gap: "20px",
  padding: "22px",
};

const modalImageWrapStyle = {
  background: "#f9fafb",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  overflow: "hidden",
};

const modalImageStyle = {
  width: "100%",
  maxHeight: "390px",
  objectFit: "contain",
  display: "block",
};

const modalImagePlaceholderStyle = {
  height: "390px",
  display: "grid",
  placeItems: "center",
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

const dangerNoteStyle = {
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #fecdca",
  borderRadius: "10px",
  padding: "10px",
};

const checkoutBodyStyle = {
  padding: "18px",
  display: "grid",
  gap: "12px",
};

const checkoutItemsStyle = {
  display: "grid",
  gap: "8px",
  maxHeight: "360px",
  overflowY: "auto",
};

const checkoutItemStyle = {
  display: "grid",
  gridTemplateColumns: "54px 1fr auto",
  gap: "10px",
  alignItems: "center",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "10px",
};

const checkoutTotalsStyle = {
  display: "grid",
  gap: "10px",
  borderTop: "1px solid #eaecf0",
  paddingTop: "12px",
};

const noteStyle = {
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  color: "#475467",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "13px",
  lineHeight: 1.4,
};

const checkoutCheckStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  background: "#ecfdf3",
  border: "1px solid #abefc6",
  color: "#067647",
  borderRadius: "12px",
  padding: "12px",
};