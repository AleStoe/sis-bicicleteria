import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  listarCatalogoPOS,
  listarCategorias,
  buscarCatalogoPOSExacto,
} from "../services/catalogoService";
import { listarClientes } from "../services/clientesService";
import { listarDeudas } from "../services/deudasService";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { listarSerializadasDisponibles } from "../services/serializadasService";
import CarritoVentaPanel from "../components/ventas/CarritoVentaPanel";
import CatalogoPOSPanel from "../components/ventas/catalogo/CatalogoPOSPanel";
import VentaCarritoSidebar from "../components/ventas/pos/VentaCarritoSidebar";
import { ConfirmModal } from "../components/ui/ConfirmModal";
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
import { useSession } from "../context/SessionContext";
import {
  borrarVentaDraftGuardado,
  guardarVentaDraft,
  leerVentaDraftGuardado,
} from "../services/ventaDraftStore";
import {
  calcularDeudaAbiertaCliente,
  esConsumidorFinal,
} from "../helpers/ventaPreventiveWarnings";
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

const DEFAULT_LIMIT = 80;
const MOBILE_BREAKPOINT = 760;

function formatMoneyPOS(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsuarioSesion(usuario) {
  if (!usuario) return "-";

  if (usuario.nombre) {
    return usuario.username
      ? `${usuario.nombre} (@${usuario.username})`
      : usuario.nombre;
  }

  return usuario.id ? `Usuario #${usuario.id}` : "-";
}

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [breakpoint]);

  return isMobile;
}


export default function NuevaVentaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const consumidorFinalAvisadoRef = useRef(false);
  const { usuarioId, sucursalId, usuarioActual } = useSession();
  const [catalogo, setCatalogo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteQuery, setClienteQuery] = useState("");
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [query, setQuery] = useState("");
  const [codigoRapido, setCodigoRapido] = useState("");
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
  const [carritoMobileAbierto, setCarritoMobileAbierto] = useState(false);
  const [carritoRestaurado, setCarritoRestaurado] = useState(false);
  const [mostrarRecuperacionDraft, setMostrarRecuperacionDraft] = useState(false);
  const [draftPendiente, setDraftPendiente] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [deudaCliente, setDeudaCliente] = useState({ tieneDeuda: false, saldo: 0 });
  const [mostrarAvisoConsumidorFinal, setMostrarAvisoConsumidorFinal] = useState(false);
  const isMobile = useIsMobile();

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

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setCarritoMobileAbierto(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!carritoRestaurado) return;

    guardarVentaDraft({
      sucursalId,
      usuarioId,
      draft: {
        clienteId,
        cliente: getClienteSeleccionado(),
        tipoPrecio,
        items,
        total,
        observaciones,
        usarCredito,
        idUsuario: usuarioId,
        idSucursal: sucursalId,
      },
    });
  }, [
    carritoRestaurado,
    sucursalId,
    usuarioId,
    clienteId,
    tipoPrecio,
    items,
    total,
    observaciones,
    usarCredito,
    clientes,
  ]);

  useEffect(() => {
    const handle = setTimeout(() => {
      cargarCatalogo();
    }, 250);

    return () => clearTimeout(handle);
  }, [query, categoriaId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      buscarClientes(clienteQuery);
    }, 250);

    return () => clearTimeout(handle);
  }, [clienteQuery]);

  useEffect(() => {
    let cancelado = false;

    async function cargarDeudaCliente() {
      if (!clienteId || esConsumidorFinal(clienteId)) {
        setDeudaCliente({ tieneDeuda: false, saldo: 0 });
        return;
      }

      try {
        const deudas = await listarDeudas({ id_cliente: clienteId, estado: "abierta" });
        if (cancelado) return;

        const resumen = calcularDeudaAbiertaCliente(deudas, clienteId);
        setDeudaCliente(resumen);

        if (resumen.tieneDeuda) {
          setMensaje(`Este cliente tiene deuda pendiente: ${formatMoneyPOS(resumen.saldo)}.`);
        }
      } catch (err) {
        if (!cancelado) {
          setDeudaCliente({ tieneDeuda: false, saldo: 0 });
        }
      }
    }

    cargarDeudaCliente();

    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }

      if (e.key === "F4") {
        e.preventDefault();
        irACobrar();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clienteId, items, tipoPrecio, observaciones]);

  function mostrarMensajePOS(texto) {
    setMensajePOS(texto);

    setTimeout(() => {
      setMensajePOS("");
    }, 2500);
  }

  function pedirConfirmacion(config) {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        },
      });
    });
  }

  async function cargarInicial() {
    try {
      setLoading(true);
      setError("");

      const [categoriasData, clientesData, catalogoData] = await Promise.all([
        listarCategorias(),
        listarClientes({ solo_activos: true }),
        listarCatalogoPOS({
          id_sucursal: sucursalId,
          limit: DEFAULT_LIMIT,
        }),
      ]);

      setCategorias(categoriasData || []);
      setClientes(clientesData || []);
      setCatalogo(Array.isArray(catalogoData) ? catalogoData : catalogoData?.items || []);

      const consumidorFinal = (clientesData || []).find((c) => Number(c.id) === 1);
      let clienteInicialId = "1";
      let tipoPrecioInicial = consumidorFinal
        ? tipoPrecioParaCliente(consumidorFinal)
        : "minorista";

      if (consumidorFinal) {
        setClienteId("1");
        setTipoPrecio(tipoPrecioInicial);
        setClienteQuery(formatearClienteParaBusqueda(consumidorFinal));
      } else if ((clientesData || []).length > 0) {
        const primerCliente = clientesData[0];
        clienteInicialId = String(primerCliente.id);
        tipoPrecioInicial = tipoPrecioParaCliente(primerCliente);
        setClienteId(clienteInicialId);
        setTipoPrecio(tipoPrecioInicial);
        setClienteQuery(formatearClienteParaBusqueda(primerCliente));
      }

      const draftGuardado = leerVentaDraftGuardado({ sucursalId, usuarioId });

      if (draftGuardado?.items?.length) {
        const draftConContexto = {
          ...draftGuardado,
          clienteInicialId,
          tipoPrecioInicial,
          clienteGuardadoExiste: (clientesData || []).some(
            (cliente) => Number(cliente.id) === Number(draftGuardado.clienteId)
          ),
        };

        if (location.state?.restaurarVentaDraft) {
          aplicarVentaPendiente(draftConContexto, {
            abrirCarrito: Boolean(location.state?.abrirCarrito),
            mostrarMensaje: false,
          });
          navigate(location.pathname, { replace: true });
          setCarritoRestaurado(true);
          return;
        }

        setDraftPendiente({
          ...draftConContexto,
        });
        setMostrarRecuperacionDraft(true);
      }

      setCarritoRestaurado(true);
    } catch (err) {
      setError(err.message || "No se pudo cargar la venta rápida");
    } finally {
      setCarritoRestaurado(true);
      setLoading(false);
    }
  }

  async function buscarClientes(texto = "") {
    try {
      setBuscandoClientes(true);

      const data = await listarClientes({
        q: texto.trim() || undefined,
        solo_activos: true,
      });

      setClientes((actuales) => {
        const base = Array.isArray(data) ? data : [];
        const clienteSeleccionado = actuales.find(
          (cliente) => Number(cliente.id) === Number(clienteId)
        );

        if (
          clienteSeleccionado &&
          !base.some((cliente) => Number(cliente.id) === Number(clienteSeleccionado.id))
        ) {
          return [clienteSeleccionado, ...base];
        }

        return base;
      });
    } catch (err) {
      setError(err.message || "No se pudieron buscar clientes");
    } finally {
      setBuscandoClientes(false);
    }
  }

  async function cargarCatalogo() {
    try {
      setBuscando(true);
      setError("");

      const data = await listarCatalogoPOS({
        id_sucursal: sucursalId,
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

  const codigo = codigoRapido.trim();

  if (!codigo) return;

  try {
    setError("");

    const producto = await buscarCatalogoPOSExacto({
      id_sucursal: sucursalId,
      codigo,
    });

    if (!producto) {
      mostrarMensajePOS("No se encontró producto para ese código");
      return;
    }

    const agregado = await agregarItem(producto);

    if (!agregado) return;

    setCodigoRapido("");
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
        id_sucursal: sucursalId,
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

  function getClienteSeleccionado() {
    return clientes.find((cliente) => Number(cliente.id) === Number(clienteId));
  }

  function tipoPrecioParaCliente(cliente) {
    return cliente?.tipo_cliente === "mayorista" ? "mayorista" : "minorista";
  }
  async function handleCambiarCliente(nuevoClienteId) {
    const cliente = clientes.find((c) => Number(c.id) === Number(nuevoClienteId));

    setClienteId(nuevoClienteId);
    setTipoPrecio(tipoPrecioParaCliente(cliente));

    if (cliente) {
      setClienteQuery(formatearClienteParaBusqueda(cliente));
    }
  }

  function formatearClienteParaBusqueda(cliente) {
    if (!cliente) return "";

    const partes = [cliente.nombre];

    if (cliente.dni) partes.push(`DNI ${cliente.dni}`);
    if (cliente.telefono) partes.push(cliente.telefono);

    return partes.filter(Boolean).join(" · ");
  }



  async function agregarItem(producto) {
    if (!puedeAgregarItemCatalogo(producto, tipoPrecio)) {
      setError(`No se puede agregar: ${getMotivoBloqueoItemCatalogo(producto, tipoPrecio)}`);
      return false;
    }

    setError("");
    setMensaje("");

    if (esConsumidorFinal(clienteId, getClienteSeleccionado()) && !consumidorFinalAvisadoRef.current) {
      consumidorFinalAvisadoRef.current = true;
      setMostrarAvisoConsumidorFinal(true);
    }

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

      return true;
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

    return true;
  }

  async function handleAgregarItemCatalogo(producto) {
    const agregado = await agregarItem(producto);

    if (agregado && isMobile) {
      mostrarMensajePOS(`${producto.producto_nombre || "Producto"} agregado`);
    }
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
    const consumidorFinal = clientes.find((cliente) => Number(cliente.id) === 1);

    setItems([]);
    setObservaciones("");
    setClienteId("1");
    setTipoPrecio(consumidorFinal ? tipoPrecioParaCliente(consumidorFinal) : "minorista");
    setClienteQuery(consumidorFinal ? formatearClienteParaBusqueda(consumidorFinal) : "");
    setError("");
    setMensaje("");
    consumidorFinalAvisadoRef.current = false;
    setMostrarAvisoConsumidorFinal(false);
    setDeudaCliente({ tieneDeuda: false, saldo: 0 });
    borrarVentaDraftGuardado({ sucursalId, usuarioId });
  }

  function aplicarVentaPendiente(draft, { abrirCarrito = isMobile, mostrarMensaje = true } = {}) {
    if (!draft) return;

    setClienteId(
      draft.clienteGuardadoExiste
        ? String(draft.clienteId)
        : String(draft.clienteInicialId || "1")
    );

    if (!draft.clienteGuardadoExiste && Number(draft.clienteId) !== 1) {
      setError(
        "Atención: la venta guardada tenía un cliente real, pero no se pudo restaurar. Revisá el cliente antes de cobrar."
      );
    }

    setTipoPrecio(draft.tipoPrecio || draft.tipoPrecioInicial || "minorista");
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setObservaciones(draft.observaciones || "");
    setUsarCredito(
      typeof draft.usarCredito === "boolean"
        ? draft.usarCredito
        : true
    );

    setMostrarRecuperacionDraft(false);
    setDraftPendiente(null);

    if (mostrarMensaje) {
      setMensaje("Venta pendiente recuperada.");
    }

    if (abrirCarrito) {
      setCarritoMobileAbierto(true);
    }
  }

  function recuperarVentaPendiente() {
    aplicarVentaPendiente(draftPendiente);
  }

  function descartarVentaPendiente() {
    const consumidorFinal = clientes.find((cliente) => Number(cliente.id) === 1);

    borrarVentaDraftGuardado({ sucursalId, usuarioId });
    setItems([]);
    setObservaciones("");
    setClienteId("1");
    setTipoPrecio(consumidorFinal ? tipoPrecioParaCliente(consumidorFinal) : "minorista");
    setClienteQuery(consumidorFinal ? formatearClienteParaBusqueda(consumidorFinal) : "");
    setMostrarRecuperacionDraft(false);
    setDraftPendiente(null);
    setMensaje("Venta pendiente descartada.");
    consumidorFinalAvisadoRef.current = false;
    setMostrarAvisoConsumidorFinal(false);
    setDeudaCliente({ tieneDeuda: false, saldo: 0 });
  }

  function validarVentaAntesDeFinalizar() {
    const errorValidacion = validarVentaAntesDeCrear({ clienteId, items });

    if (errorValidacion) {
      setError(errorValidacion);
      return false;
    }

    return true;
  }

  function crearPayloadVenta({
    pagos = [],
    usar_credito = usarCredito,
    monto_credito_a_aplicar = null,
  } = {}) {
    return buildVentaPayload({
      clienteId,
      sucursalId: sucursalId,
      usuarioId: usuarioId,
      tipoPrecio,
      items,
      pagos,
      observaciones,
      usarCredito: usar_credito,
      montoCreditoAAplicar: monto_credito_a_aplicar,
    });
  }

  async function finalizarCheckout({
    pagos = [],
    entregar_ahora,
    usar_credito = usarCredito,
    monto_credito_a_aplicar = null,
  }) {
    if (!validarVentaAntesDeFinalizar()) return;

    const payload = crearPayloadVenta({
      pagos,
      usar_credito,
      monto_credito_a_aplicar,
    });

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const resultado = await crearVenta(payload);

      if (entregar_ahora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: usuarioId,
        });
      }

      borrarVentaDraftGuardado({ sucursalId, usuarioId });
      navigate(`/ventas/${resultado.venta_id}`, {
        state: { scrollToTop: true, ventaFinalizadaDesdeCheckout: true },
      });
    } catch (err) {
      setError(err.message || "No se pudo finalizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  async function irACobrar() {
    if (!validarVentaAntesDeFinalizar()) return;

    let consumidorFinalConfirmado = false;
    if (esConsumidorFinal(clienteId, getClienteSeleccionado())) {
      const continuar = await pedirConfirmacion({
        title: "Venta a Consumidor Final",
        message:
          "Esta venta quedará registrada a Consumidor Final.\nDespués puede ser más difícil encontrarla por historial, garantía o reclamo.\n\n¿Querés continuar?",
        confirmText: "Continuar",
        cancelText: "Volver y cargar cliente",
        variant: "warning",
      });

      if (!continuar) return;
      consumidorFinalConfirmado = true;
    }

    setCarritoMobileAbierto(false);
    const ventaDraft = {
      clienteId,
      cliente: getClienteSeleccionado(),
      tipoPrecio,
      items,
      total,
      observaciones,
      usarCredito,
      idUsuario: usuarioId,
      idSucursal: sucursalId,
      advertencias: {
        consumidorFinalConfirmado,
      },
    };

    guardarVentaDraft({
      sucursalId,
      usuarioId,
      draft: ventaDraft,
    });

    navigate("/ventas/checkout", {
      state: {
        ventaDraft,
      },
    });
  }

  async function handleCambiarTipoPrecio(nuevoTipoPrecio) {
    if (nuevoTipoPrecio === tipoPrecio) return;

    if (items.length > 0) {
      const continuar = await pedirConfirmacion({
        title: "Cambiar lista de precios",
        message:
          "Al cambiar la lista de precios se recalcularán los importes del carrito.\n\n¿Querés continuar?",
        confirmText: "Cambiar lista",
        cancelText: "Cancelar",
        variant: "warning",
      });

      if (!continuar) return;
    }

    setTipoPrecio(nuevoTipoPrecio);
    setItems((actual) =>
      actual.map((item) => {
        if (item.precio_unitario_manual || item.bonificado) return item;

        const nuevoPrecio =
          nuevoTipoPrecio === "mayorista"
            ? Number(item.precio_mayorista || item.precio_lista || 0)
            : Number(item.precio_minorista || item.precio_lista || 0);

        return {
          ...item,
          precio_lista: nuevoPrecio,
          precio_final: nuevoPrecio,
          tipo_precio_aplicado: nuevoTipoPrecio,
        };
      })
    );
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando venta rápida...</p>;
  }

  const cantidadItemsCarrito = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  const carritoSidebar = (
    <VentaCarritoSidebar
      clientes={clientes}
      clienteId={clienteId}
      clienteQuery={clienteQuery}
      buscandoClientes={buscandoClientes}
      tipoPrecio={tipoPrecio}
      items={items}
      total={total}
      observaciones={observaciones}
      usarCredito={usarCredito}
      serializadasPorVariante={serializadasPorVariante}
      cargandoSerializadas={cargandoSerializadas}
      onCambiarCliente={handleCambiarCliente}
      onClienteQueryChange={setClienteQuery}
      onCambiarTipoPrecio={handleCambiarTipoPrecio}
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
  );

  return (
    <div style={{ ...pageStyle, ...(isMobile ? posMobileStyles.page : {}) }}>
      <ConfirmModal
        open={mostrarRecuperacionDraft}
        title="Venta pendiente encontrada"
        message="Se encontró una venta sin finalizar guardada en este equipo. ¿Querés recuperarla o descartarla?"
        confirmText="Recuperar"
        cancelText="Descartar"
        variant="info"
        onConfirm={recuperarVentaPendiente}
        onCancel={descartarVentaPendiente}
      />
      <ConfirmModal
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText}
        variant={confirmConfig?.variant}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={confirmConfig?.onCancel}
      />

      <header style={{ ...topBarStyle, ...(isMobile ? posMobileStyles.topBar : {}) }}>
        <div style={{ ...brandStyle, ...(isMobile ? posMobileStyles.brand : {}) }}>
          <span style={bikeStyle}>🚲</span>
          <div>
            <strong>Sistema de Ventas - Bicicletería</strong>
            {!isMobile && (
              <div style={topSubtleStyle}>POS real: crear, cobrar y entregar desde checkout</div>
            )}
          </div>
        </div>

        <div style={{ ...topSearchWrapStyle, ...(isMobile ? posMobileStyles.topSearchWrap : {}) }}>
          <input
            ref={searchRef}
            value={codigoRapido}
            onChange={(e) => setCodigoRapido(e.target.value)}
            onKeyDown={handleBuscarEnter}
            placeholder={isMobile ? "Escanear código..." : "Escanear o ingresar código rápido... (F2)"}
            style={{ ...topSearchStyle, ...(isMobile ? posMobileStyles.topSearch : {}) }}
          />
          <span style={searchIconStyle}>⌕</span>
        </div>

        <div style={{ ...topRightStyle, ...(isMobile ? posMobileStyles.topRight : {}) }}>
          {!isMobile && <span>Caja: CAJA 1</span>}
          {!isMobile && <span>{formatUsuarioSesion(usuarioActual)}</span>}
          <Link to="/ventas" style={topLinkStyle}>Historial</Link>
        </div>
      </header>

      {error && <div style={alertStyle}>Error: {error}</div>}
      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {mostrarAvisoConsumidorFinal && (
        <div style={posMobileStyles.consumerWarning}>
          <button
            type="button"
            aria-label="Cerrar aviso Consumidor Final"
            onClick={() => setMostrarAvisoConsumidorFinal(false)}
            style={posMobileStyles.consumerWarningClose}
          >
            ×
          </button>
          <strong>Estás cargando esta venta a Consumidor Final.</strong>
          <span>
            Si el cliente necesita garantía, historial o deuda asociada, conviene cargar sus datos antes de vender.
          </span>
          <button
            type="button"
            onClick={() => setMostrarAvisoConsumidorFinal(false)}
            style={posMobileStyles.consumerWarningButton}
          >
            Entendido
          </button>
        </div>
      )}
      {deudaCliente.tieneDeuda && (
        <div style={alertStyle}>
          Atención: este cliente tiene deuda pendiente: {formatMoneyPOS(deudaCliente.saldo)}.
        </div>
      )}
      {mensajePOS && (
        <div style={posMessageStyle}>
          {mensajePOS}
        </div>
      )}

      <main style={isMobile ? posMobileStyles.layout : layoutStyle}>
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
          onAgregarItem={handleAgregarItemCatalogo}
          isMobile={isMobile}
        />

        {!isMobile && (
          <aside style={rightPanelStyle}>
            {carritoSidebar}
          </aside>
        )}
      </main>

      {isMobile && (
        <>
          <div style={posMobileStyles.bottomBar}>
            <div style={posMobileStyles.bottomTotalBox}>
              <span style={posMobileStyles.bottomLabel}>Carrito</span>
              <strong style={posMobileStyles.bottomTotal}>{formatMoneyPOS(total)}</strong>
              <span style={posMobileStyles.bottomMeta}>{cantidadItemsCarrito || 0} ítem(s)</span>
            </div>

            <button
              type="button"
              onClick={() => setCarritoMobileAbierto(true)}
              style={posMobileStyles.bottomButton}
            >
              Ver carrito
            </button>
          </div>

          {carritoMobileAbierto && (
            <div style={posMobileStyles.drawerOverlay}>
              <button
                type="button"
                aria-label="Cerrar carrito"
                onClick={() => setCarritoMobileAbierto(false)}
                style={posMobileStyles.backdrop}
              />

              <section style={posMobileStyles.drawerPanel}>
                <div style={posMobileStyles.drawerHeader}>
                  <div>
                    <strong>Carrito de venta</strong>
                    <p style={posMobileStyles.drawerSubtitle}>{cantidadItemsCarrito || 0} ítem(s) · {formatMoneyPOS(total)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCarritoMobileAbierto(false)}
                    style={posMobileStyles.closeButton}
                  >
                    Seguir comprando
                  </button>
                </div>

                <div style={posMobileStyles.drawerContent}>
                  {carritoSidebar}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const posMobileStyles = {
  page: {
    padding: 10,
    paddingBottom: 96,
    overflowX: "hidden",
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    padding: 12,
    borderRadius: 16,
  },
  brand: {
    minWidth: 0,
  },
  topSearchWrap: {
    width: "100%",
  },
  topSearch: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  topRight: {
    justifyContent: "flex-start",
    width: "100%",
  },
  consumerWarning: {
    position: "relative",
    border: "1px solid #fdba74",
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: 14,
    padding: "12px 44px 12px 14px",
    marginBottom: 10,
    display: "grid",
    gap: 6,
    fontWeight: 800,
  },
  consumerWarningClose: {
    position: "absolute",
    right: 10,
    top: 8,
    border: "none",
    background: "transparent",
    color: "#9a3412",
    fontSize: 20,
    fontWeight: 1000,
    cursor: "pointer",
  },
  consumerWarningButton: {
    justifySelf: "start",
    border: "1px solid #fdba74",
    background: "white",
    color: "#9a3412",
    borderRadius: 10,
    padding: "6px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  bottomBar: {
    position: "fixed",
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 60,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    background: "#0f172a",
    color: "white",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.35)",
  },
  bottomTotalBox: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },
  bottomLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  bottomTotal: {
    fontSize: 18,
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  bottomMeta: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
  },
  bottomButton: {
    border: "none",
    borderRadius: 14,
    padding: "13px 14px",
    background: "#f97316",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(249, 115, 22, 0.28)",
  },
  drawerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    display: "grid",
    alignItems: "end",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    border: "none",
    background: "rgba(15, 23, 42, 0.52)",
    cursor: "pointer",
  },
  drawerPanel: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxHeight: "92vh",
    background: "white",
    borderRadius: "24px 24px 0 0",
    padding: 14,
    boxShadow: "0 -18px 45px rgba(15, 23, 42, 0.24)",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
  },
  drawerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #e2e8f0",
  },
  drawerSubtitle: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "white",
    color: "#0f172a",
    padding: "9px 11px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  drawerContent: {
    minHeight: 0,
    overflowY: "auto",
    paddingTop: 12,
    paddingBottom: 12,
  },
};
