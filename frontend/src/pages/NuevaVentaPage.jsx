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
import CatalogoPOSPanel from "../components/ventas/catalogo/CatalogoPOSPanel";
import VentaCarritoSidebar from "../components/ventas/pos/VentaCarritoSidebar";
import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../config/appConfig";
import { validarVentaAntesDeCrear } from "../validators/ventasValidator";
import { buildVentaPayload } from "../builders/ventasPayloadBuilder";
import {
  crearLineId,
  getCodigoItemCatalogo,
  getDescripcionItemCatalogo,
  getMotivoBloqueoItemCatalogo,
  getPrecioItemCatalogo,
  puedeAgregarItemCatalogo,
} from "../helpers/ventasItemsHelper";

import {
  pageStyle,
  topBarStyle,
  brandStyle,
  bikeStyle,
  topSubtleStyle,
  topSearchWrapStyle,
  topSearchStyle,
  searchIconStyle,
  topRightStyle,
  topLinkStyle,
  layoutStyle,
  leftPanelStyle,
  rightPanelStyle,
  searchRowStyle,
  searchStyle,
  iconButtonStyle,
  categoryRowStyle,
  categoryStyle,
  activeCategoryStyle,
  catalogListStyle,
  productRowStyle,
  productRowBlockedStyle,
  imageBoxStyle,
  imageStyle,
  productInfoStyle,
  mutedStyle,
  tagRowStyle,
  tagStyle,
  stockTagStyle,
  serializableTagStyle,
  serviceTagStyle,
  dangerTagStyle,
  productPriceStyle,
  addBtnStyle,
  addBtnDisabledStyle,
  saleTopStyle,
  clientLabelStyle,
  clientSelectStyle,
  fieldStyle,
  textareaStyle,
  checkStyle,
  alertStyle,
  successStyle,
  emptyStyle,
  posMessageStyle
} from "../styles/pages/nuevaVentaPageStyles";

const ID_USUARIO = CURRENT_USER_ID;
const ID_SUCURSAL = CURRENT_SUCURSAL_ID;
const DEFAULT_LIMIT = 80;

export default function NuevaVentaPage() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [catalogo, setCatalogo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [clienteId, setClienteId] = useState("1");
  const [tipoPrecio, setTipoPrecio] = useState("minorista");
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
        setTipoPrecio(tipoPrecioParaCliente(consumidorFinal));
      } else if ((clientesData || []).length > 0) {
        const primerCliente = clientesData[0];
        setClienteId(String(primerCliente.id));
        setTipoPrecio(tipoPrecioParaCliente(primerCliente));
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
              item.precio_lista ||
              0
          );

      return acc + precioUnitario * Number(item.cantidad || 0);
    }, 0);
  }, [items]);

  function getClienteSeleccionado() {
    return clientes.find((cliente) => Number(cliente.id) === Number(clienteId));
  }

  function tipoPrecioParaCliente(cliente) {
    return cliente?.tipo_cliente === "mayorista" ? "mayorista" : "minorista";
  }
  function handleCambiarCliente(nuevoClienteId) {
    const cliente = clientes.find((c) => Number(c.id) === Number(nuevoClienteId));

    setClienteId(nuevoClienteId);
    setTipoPrecio(tipoPrecioParaCliente(cliente));
  }



  async function agregarItem(producto) {
    if (!puedeAgregarItemCatalogo(producto, tipoPrecio)) {
      setError(`No se puede agregar: ${getMotivoBloqueoItemCatalogo(producto, tipoPrecio)}`);
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
          descripcion: getDescripcionItemCatalogo(producto),
          codigo: getCodigoItemCatalogo(producto),
          categoria_nombre: producto.categoria_nombre,
          tipo_item: producto.tipo_item,
          stockeable: producto.stockeable,
          serializable: true,
          stock_disponible: Number(producto.stock_disponible || 0),
          precio_minorista: Number(producto.precio_minorista || 0),
          precio_mayorista: Number(producto.precio_mayorista || 0),
          precio_lista: getPrecioItemCatalogo(producto, tipoPrecio),
          tipo_precio_aplicado: tipoPrecio,
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
          descripcion: getDescripcionItemCatalogo(producto),
          codigo: getCodigoItemCatalogo(producto),
          categoria_nombre: producto.categoria_nombre,
          tipo_item: producto.tipo_item,
          stockeable: producto.stockeable,
          serializable: producto.serializable,
          stock_disponible: Number(producto.stock_disponible || 0),
          precio_minorista: Number(producto.precio_minorista || 0),
          precio_mayorista: Number(producto.precio_mayorista || 0),
          precio_lista: getPrecioItemCatalogo(producto, tipoPrecio),
          tipo_precio_aplicado: tipoPrecio,
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
    const errorValidacion = validarVentaAntesDeCrear({ clienteId, items });

    if (errorValidacion) {
      setError(errorValidacion);
      return false;
    }

    return true;
  }

  function crearPayloadVenta(pagos = []) {
    return buildVentaPayload({
      clienteId,
      sucursalId: ID_SUCURSAL,
      usuarioId: ID_USUARIO,
      tipoPrecio,
      items,
      pagos,
      observaciones,
      usarCredito,
    });
  }

  async function finalizarCheckout({ pagos = [], entregar_ahora }) {
    if (!validarVentaAntesDeFinalizar()) return;

    const payload = crearPayloadVenta(pagos);

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      console.log("TOTAL FRONT", total);
      console.log("PAGOS", JSON.stringify(pagos, null, 2));
      console.log("ITEMS FRONT", JSON.stringify(items, null, 2));
      console.log("PAYLOAD CREAR VENTA", JSON.stringify(payload, null, 2));
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

  function irACobrar() {
    if (!validarVentaAntesDeFinalizar()) return;

    navigate("/ventas/checkout", {
      state: {
        ventaDraft: {
          clienteId,
          cliente: getClienteSeleccionado(),
          tipoPrecio,
          items,
          total,
          observaciones,
          usarCredito,
          idUsuario: ID_USUARIO,
          idSucursal: ID_SUCURSAL,
        },
      },
    });
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
        <CatalogoPOSPanel
          query={query}
          categoriaId={categoriaId}
          categorias={categorias}
          catalogo={catalogo}
          buscando={buscando}
          tipoPrecio={tipoPrecio}
          onQueryChange={setQuery}
          onBuscarEnter={handleBuscarEnter}
          onRecargarCatalogo={cargarCatalogo}
          onCategoriaChange={setCategoriaId}
          onAgregarItem={agregarItem}
        />

        <aside style={rightPanelStyle}>
          <VentaCarritoSidebar
            clientes={clientes}
            clienteId={clienteId}
            tipoPrecio={tipoPrecio}
            items={items}
            total={total}
            observaciones={observaciones}
            usarCredito={usarCredito}
            serializadasPorVariante={serializadasPorVariante}
            cargandoSerializadas={cargandoSerializadas}
            onCambiarCliente={handleCambiarCliente}
            onCambiarTipoPrecio={setTipoPrecio}
            onCargarSerializadas={cargarSerializadasDisponibles}
            onSeleccionarSerializada={seleccionarSerializada}
            onCambiarCantidad={cambiarCantidad}
            onQuitarItem={quitarItem}
            onActualizarItem={actualizarItemCarrito}
            onObservacionesChange={setObservaciones}
            onUsarCreditoChange={setUsarCredito}
            onVaciar={vaciarVenta}
            onIrACobrar={irACobrar}
          />
        </aside>
      </main>
    </div>
  );
}
