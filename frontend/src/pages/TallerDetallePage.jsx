import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { listarVariantes } from "../services/catalogoService";
import { listarServiciosTaller } from "../services/serviciosTallerService";
import {
  agregarItemOrdenTaller,
  aprobarItemOrdenTaller,
  cambiarEstadoOrdenTaller,
  ejecutarItemOrdenTaller,
  obtenerOrdenTaller,
  revertirEjecucionItemOrdenTaller,
  cancelarItemOrdenTaller,
  generarVentaDesdeOrdenTaller,
  getPresupuestoTallerUrl,
  actualizarOperativoOrdenTaller,
  generarMensajeListaRetiroOrdenTaller,
  marcarAvisoRetiroOrdenTaller,
  crearNotaOrdenTaller,
  actualizarNotaOrdenTaller,
} from "../services/tallerService";
import { formatDate, formatMoney } from "../utils/formatters";
import { EstadoBadge } from "./TallerListPage";
import { PromptModal } from "../components/ui/PromptModal";
import {
  Info,
  ItemCard,
  Metric,
  OperadorPanel,
  ServicioTallerOption,
  TallerItemOption,
} from "../components/taller/detalle/TallerDetalleWidgets";
import { ESTADOS, TRANSICIONES_UI } from "../components/taller/detalle/tallerDetalleConstants";
import { styles } from "../components/taller/detalle/tallerDetalleStyles";
import {
  descripcionBicicletaOrden,
  esItemPermitidoParaTaller,
  humanizarEvento,
  labelEstado,
  nombreClienteOrden,
  normalizarTexto,
  prioridadTipoTaller,
} from "../components/taller/detalle/tallerDetalleUtils";

function useIsMobile(breakpoint = 760) {
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

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function AccionesRapidasTaller({
  orden,
  resumen,
  guardando,
  esOrdenPostventa,
  items,
  puedeGenerarVenta,
  puedeMarcarListaParaRetirar,
  puedeMarcarRetirada,
  onImprimirPresupuesto,
  onGenerarVenta,
  onCobrar,
  onListaParaRetirar,
  onWhatsappRetiro,
  onRetirada,
}) {
  const tieneItemsPresupuesto = items.some((item) => item.etapa !== "cancelado");
  const puedeWhatsApp =
    orden.estado === "terminada" ||
    orden.estado === "facturada" ||
    orden.estado === "lista_para_retirar" ||
    puedeMarcarListaParaRetirar;

  return (
    <section style={styles.quickActionsCard}>
      <div>
        <p style={styles.eyebrow}>Acciones operativas</p>
        <h2 style={styles.quickActionsTitle}>Retiro, WhatsApp, presupuesto y facturacion</h2>
      </div>

      <div style={styles.quickActionsGrid}>
        <QuickAction
          title="Presupuesto"
          detail={
            esOrdenPostventa
              ? "Muestra repuestos, cobertura y diferencia"
              : "PDF para aprobar trabajos"
          }
          label="Imprimir"
          disabled={guardando || !tieneItemsPresupuesto}
          onClick={onImprimirPresupuesto}
        />
        <QuickAction
          title="Facturacion"
          detail={
            orden.id_venta_generada
                ? `Venta #${orden.id_venta_generada}`
                : esOrdenPostventa && Number(orden.total_final || 0) <= 0
                  ? "Sin diferencia a cobrar"
                  : "Generar venta desde OT"
          }
          label={
            orden.id_venta_generada
                ? "Cobrar"
                : esOrdenPostventa && Number(orden.total_final || 0) <= 0
                  ? "No aplica"
                  : "Generar venta"
          }
          disabled={
            guardando ||
            (orden.id_venta_generada ? false : !puedeGenerarVenta)
          }
          onClick={orden.id_venta_generada ? onCobrar : onGenerarVenta}
        />
        <QuickAction
          title="Lista para retirar"
          detail="Deja la OT preparada para aviso"
          label="Marcar lista"
          disabled={guardando || !puedeMarcarListaParaRetirar}
          onClick={onListaParaRetirar}
        />
        <QuickAction
          title="WhatsApp retiro"
          detail={puedeWhatsApp ? "Abre mensaje y registra aviso" : "Disponible cuando este terminada"}
          label="Enviar WhatsApp"
          disabled={guardando || !puedeWhatsApp}
          onClick={onWhatsappRetiro}
        />
        <QuickAction
          title="Retiro"
          detail="Cuando el cliente se lleva la bici"
          label="Marcar retirada"
          disabled={guardando || !puedeMarcarRetirada}
          onClick={onRetirada}
        />
      </div>

      {resumen.facturables === 0 && !esOrdenPostventa ? (
        <p style={styles.quickActionsHint}>Para facturar, primero debe haber items ejecutados.</p>
      ) : null}
    </section>
  );
}

function QuickAction({ title, detail, label, disabled, onClick }) {
  return (
    <div style={styles.quickAction}>
      <div>
        <strong style={styles.quickActionTitle}>{title}</strong>
        <p style={styles.quickActionDetail}>{detail}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          ...styles.quickActionButton,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {label}
      </button>
    </div>
  );
}

export default function TallerDetallePage() {
  const { ordenId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { usuarioId } = useSession();
  const [orden, setOrden] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [serviciosTaller, setServiciosTaller] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [promptConfig, setPromptConfig] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [busquedaVariante, setBusquedaVariante] = useState("");
  const [busquedaServicio, setBusquedaServicio] = useState("");
  const [itemForm, setItemForm] = useState({
    tipo_item: "repuesto",
    id_variante: "",
    id_servicio_taller: "",
    cantidad: "1",
    precio_unitario: "",
    cubrir_garantia: false,
    valor_cobertura_unitario: "",
    motivo_cobertura: "Garantía local",
    observacion_cobertura: "",
  });
  const [operativoForm, setOperativoForm] = useState({
    fecha_prometida: "",
    prioridad: "normal",
  });
  const [notaForm, setNotaForm] = useState({
    tipo: "interna",
    contenido: "",
  });
  function formatUsuario(item) {
    if (item.usuario_nombre) {
      return item.usuario_username
        ? `${item.usuario_nombre} (@${item.usuario_username})`
        : item.usuario_nombre;
    }

    return item.id_usuario ? `Usuario #${item.id_usuario}` : "-";
  }
  function pedirPrompt(config) {
    return new Promise((resolve) => {
      setPromptConfig({
        ...config,
        onConfirm: (value) => {
          setPromptConfig(null);
          resolve(value);
        },
        onCancel: () => {
          setPromptConfig(null);
          resolve(null);
        },
      });
    });
  }

  useEffect(() => {
    cargarTodo();
  }, [ordenId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [ordenData, variantesData, serviciosData] = await Promise.all([
        obtenerOrdenTaller(ordenId),
        listarVariantes(),
        listarServiciosTaller(),
      ]);
      setOrden(ordenData);
      setNuevoEstado(ordenData.estado);
      setOperativoForm({
        fecha_prometida: toDateTimeLocalValue(ordenData.fecha_prometida),
        prioridad: ordenData.prioridad || "normal",
      });
      setVariantes(variantesData || []);
      setServiciosTaller(serviciosData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden de taller");
    } finally {
      setLoading(false);
    }
  }

  async function refrescarOrden() {
    const data = await obtenerOrdenTaller(ordenId);
    setOrden(data);
    setNuevoEstado(data.estado);
    setOperativoForm({
      fecha_prometida: toDateTimeLocalValue(data.fecha_prometida),
      prioridad: data.prioridad || "normal",
    });
  }

  const items = orden?.items || [];
  const eventos = orden?.eventos || [];
  const notas = orden?.notas || [];
  const alertasBicicleta = orden?.alertas_bicicleta || [];

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const cancelado = item.etapa === "cancelado";
        const aprobado = item.aprobado === true;
        const ejecutado = item.etapa === "ejecutado";

        acc.items += 1;
        if (!cancelado) acc.activos += 1;
        if (item.etapa === "presupuestado") acc.presupuestados += 1;
        if (item.etapa === "agregado") acc.aprobados += 1;
        if (ejecutado) acc.ejecutados += 1;
        if (cancelado) acc.cancelados += 1;
        if (!cancelado && !aprobado) acc.pendientesAprobacion += 1;
        if (!cancelado && aprobado && !ejecutado) acc.pendientesEjecucion += 1;
        if (!cancelado && ejecutado && aprobado) acc.facturables += 1;
        acc.total += cancelado ? 0 : Number(item.subtotal || 0);
        return acc;
      },
      {
        items: 0,
        activos: 0,
        presupuestados: 0,
        aprobados: 0,
        ejecutados: 0,
        cancelados: 0,
        pendientesAprobacion: 0,
        pendientesEjecucion: 0,
        facturables: 0,
        total: 0,
      }
    );
  }, [items]);

  const esOrdenPostventa = orden?.es_service_postventa === true;

  const puedeTerminarTrabajo =
    orden?.estado === "en_reparacion" &&
    (
      (
        esOrdenPostventa &&
        resumen.pendientesAprobacion === 0 &&
        resumen.pendientesEjecucion === 0
      ) ||
      (
        resumen.activos > 0 &&
        resumen.pendientesAprobacion === 0 &&
        resumen.pendientesEjecucion === 0
      )
    );

  const puedeGenerarVenta =
    orden?.estado === "terminada" &&
    !orden?.id_venta_generada &&
    (!esOrdenPostventa || Number(orden?.total_final || 0) > 0) &&
    resumen.facturables > 0;

  const puedeMarcarListaParaRetirar =
    esOrdenPostventa
      ? Number(orden?.total_final || 0) > 0
        ? orden?.estado === "facturada" && Boolean(orden?.id_venta_generada)
        : orden?.estado === "terminada"
      : orden?.estado === "facturada" && Boolean(orden?.id_venta_generada);

  const puedeMarcarRetirada = orden?.estado === "lista_para_retirar";

  const variantesFiltradas = useMemo(() => {
    const q = normalizarTexto(busquedaVariante);

    const base = (variantes || [])
      .filter(esItemPermitidoParaTaller)
      .sort((a, b) => {
        const tipoA = prioridadTipoTaller(a);
        const tipoB = prioridadTipoTaller(b);
        if (tipoA !== tipoB) return tipoA - tipoB;
        return String(a.producto_nombre || "").localeCompare(String(b.producto_nombre || ""));
      });

    if (!q) return base.slice(0, 18);

    return base
      .filter((v) =>
        normalizarTexto([
          v.id,
          v.producto_nombre,
          v.nombre_variante,
          v.categoria_nombre,
          v.tipo_item,
          v.sku,
          v.codigo_barras,
          v.codigo_proveedor,
        ].filter(Boolean).join(" ")).includes(q)
      )
      .slice(0, 24);
  }, [variantes, busquedaVariante]);

  const serviciosFiltrados = useMemo(() => {
    const q = normalizarTexto(busquedaServicio);
    const base = (serviciosTaller || [])
      .filter((servicio) => servicio.activo !== false)
      .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

    if (!q) return base.slice(0, 18);

    return base
      .filter((servicio) =>
        normalizarTexto([
          servicio.id,
          servicio.nombre,
          servicio.descripcion,
          servicio.precio_sugerido,
        ].filter(Boolean).join(" ")).includes(q)
      )
      .slice(0, 24);
  }, [serviciosTaller, busquedaServicio]);

  const itemSeleccionado = useMemo(() => {
    if (itemForm.tipo_item === "servicio") {
      return serviciosTaller.find((s) => String(s.id) === String(itemForm.id_servicio_taller)) || null;
    }

    return variantes.find((v) => String(v.id) === String(itemForm.id_variante)) || null;
  }, [serviciosTaller, variantes, itemForm]);

  const estadosPermitidos = useMemo(() => {
    if (!orden) return [];

    return (TRANSICIONES_UI[orden.estado] || []).filter((estado) => {
      if (
        estado === "lista_para_retirar" &&
        !orden.id_venta_generada &&
        (
          orden.es_service_postventa !== true ||
          Number(orden.total_final || 0) > 0
        )
      ) {
        return false;
      }

      return true;
    });
  }, [orden]);

  function cambiarTipoItem(tipoItem) {
    setError("");
    setMensaje("");
    setItemForm({
      tipo_item: tipoItem,
      id_variante: "",
      id_servicio_taller: "",
      cantidad: "1",
      precio_unitario: "",
      cubrir_garantia: false,
      valor_cobertura_unitario: "",
      motivo_cobertura: "Garantía local",
      observacion_cobertura: "",
    });
    setBusquedaVariante("");
    setBusquedaServicio("");
  }

  function seleccionarVariante(id) {
    const variante = variantes.find((v) => String(v.id) === String(id));

    if (variante && !esItemPermitidoParaTaller(variante)) {
      setError("Ese ítem no se puede usar en taller. Usá repuestos o accesorios.");
      return;
    }

    setItemForm({
      ...itemForm,
      tipo_item: "repuesto",
      id_variante: id,
      id_servicio_taller: "",
      cantidad: itemForm.cantidad || "1",
      precio_unitario: variante?.precio_minorista != null ? String(variante.precio_minorista) : "0",
    });
  }

  function seleccionarServicio(id) {
    const servicio = serviciosTaller.find((s) => String(s.id) === String(id));

    if (!servicio) {
      setItemForm((prev) => ({
        ...prev,
        tipo_item: "servicio",
        id_variante: "",
        id_servicio_taller: "",
        precio_unitario: "",
      }));
      return;
    }

    if (servicio.activo === false) {
      setError("No podés agregar un servicio inactivo a la orden");
      return;
    }

    setError("");
    setMensaje("");

    setItemForm((prev) => ({
      ...prev,
      tipo_item: "servicio",
      id_variante: "",
      id_servicio_taller: String(servicio.id),
      cantidad: prev.cantidad || "1",
      precio_unitario:
        servicio.precio_sugerido != null ? String(servicio.precio_sugerido) : "0",
    }));
  }

  async function cambiarEstado(e) {
    e.preventDefault();
    if (!nuevoEstado || nuevoEstado === orden.estado) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await cambiarEstadoOrdenTaller(ordenId, { nuevo_estado: nuevoEstado, id_usuario: usuarioId });
      await refrescarOrden();
      setMensaje("Estado actualizado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    } finally {
      setGuardando(false);
    }
  }

  async function agregarItem(e) {
    e.preventDefault();


    const esServicio = itemForm.tipo_item === "servicio";
    if (esServicio && !itemForm.id_servicio_taller) {
      setError("Seleccioná un servicio para agregar al trabajo");
      return;
    }

    if (!esServicio && !itemForm.id_variante) {
      setError("Seleccioná un repuesto o accesorio para agregar al trabajo");
      return;
    }

    if (!esServicio) {
      const varianteSeleccionada = variantes.find((v) => String(v.id) === String(itemForm.id_variante));

      if (varianteSeleccionada && !esItemPermitidoParaTaller(varianteSeleccionada)) {
        setError("No podés agregar bicicletas completas al taller. Seleccioná repuestos o accesorios.");
        return;
      }
    }

    if (Number(itemForm.cantidad) <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const cobertura = Number(itemForm.valor_cobertura_unitario || 0);
      if (
        !esServicio &&
        itemForm.cubrir_garantia &&
        cobertura > Number(itemForm.precio_unitario || 0)
      ) {
        setError("La cobertura no puede superar el precio del repuesto.");
        return;
      }

      const payload = esServicio
        ? {
            tipo_item: "servicio",
            id_servicio_taller: Number(itemForm.id_servicio_taller),
            cantidad: Number(itemForm.cantidad),
            precio_unitario: Number(itemForm.precio_unitario || 0),
            id_usuario: usuarioId,
          }
        : {
            tipo_item: "repuesto",
            id_variante: Number(itemForm.id_variante),
            cantidad: Number(itemForm.cantidad),
            precio_unitario: Number(itemForm.precio_unitario || 0),
            valor_cobertura_unitario:
              itemForm.cubrir_garantia ? cobertura : 0,
            motivo_cobertura:
              itemForm.cubrir_garantia ? itemForm.motivo_cobertura : null,
            observacion_cobertura:
              itemForm.cubrir_garantia
                ? itemForm.observacion_cobertura.trim() || null
                : null,
            id_usuario: usuarioId,
          };


      const resultado = await agregarItemOrdenTaller(
        ordenId,
        payload
      );

      
      setItemForm({
        tipo_item: itemForm.tipo_item,
        id_variante: "",
        id_servicio_taller: "",
        cantidad: "1",
        precio_unitario: "",
        cubrir_garantia: false,
        valor_cobertura_unitario: "",
        motivo_cobertura: "Garantía local",
        observacion_cobertura: "",
      });
      setBusquedaVariante("");
      setBusquedaServicio("");
      await refrescarOrden();
      setMensaje(esServicio ? "Servicio agregado correctamente" : "Repuesto agregado correctamente");
    } catch (err) {

      if (err?.response) {
      }

      if (err?.detail) {
      }

      setError(
        err?.detail ||
        err?.message ||
        "No se pudo agregar el item"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function agregarItemDirectoDesdeSelector({ tipo_item, id, precio_unitario }) {
    if (guardando) return;

    const esServicio = tipo_item === "servicio";
    if (esOrdenPostventa && !esServicio) {
      seleccionarVariante(id);
      setMensaje(
        "Repuesto seleccionado. Indicá si tiene cobertura antes de agregarlo.",
      );
      return;
    }
    const cantidad = Number(itemForm.cantidad || 1);

    if (cantidad <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }

    if (!esServicio) {
      const varianteSeleccionada = variantes.find((v) => String(v.id) === String(id));

      if (varianteSeleccionada && !esItemPermitidoParaTaller(varianteSeleccionada)) {
        setError("No podés agregar bicicletas completas al taller. Seleccioná repuestos o accesorios.");
        return;
      }
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await agregarItemOrdenTaller(ordenId, {
        tipo_item,
        ...(esServicio
          ? { id_servicio_taller: Number(id) }
          : { id_variante: Number(id) }),
        cantidad,
        precio_unitario: Number(precio_unitario || 0),
        id_usuario: usuarioId,
      });

      setItemForm({
        tipo_item,
        id_variante: "",
        id_servicio_taller: "",
        cantidad: "1",
        precio_unitario: "",
        cubrir_garantia: false,
        valor_cobertura_unitario: "",
        motivo_cobertura: "Garantía local",
        observacion_cobertura: "",
      });
      setBusquedaVariante("");
      setBusquedaServicio("");
      await refrescarOrden();
      setMensaje(esServicio ? "Servicio agregado correctamente" : "Repuesto agregado correctamente");
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo agregar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function aprobarItem(item, aprobado) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await aprobarItemOrdenTaller(ordenId, item.id, { aprobado, id_usuario: usuarioId });
      await refrescarOrden();
      setMensaje(aprobado ? "Item aprobado" : "Item marcado como no aprobado");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la aprobación del item");
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarItem(item) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await ejecutarItemOrdenTaller(ordenId, item.id, usuarioId);
      await refrescarOrden();
      setMensaje("Item ejecutado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo ejecutar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function revertirItem(item) {
    const motivo = await pedirPrompt({ title: "Revertir ejecución", label: "Motivo de la reversión", required: true, minLength: 3, confirmText: "Revertir" });
    if (!motivo || !motivo.trim()) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await revertirEjecucionItemOrdenTaller(ordenId, item.id, { id_usuario: usuarioId, motivo: motivo.trim() });
      await refrescarOrden();
      setMensaje("Ejecución revertida correctamente");
    } catch (err) {
      setError(err.message || "No se pudo revertir la ejecución");
    } finally {
      setGuardando(false);
    }
  }

  async function handleCancelarItem(item) {
    const motivo = await pedirPrompt({ title: "Cancelar item", label: "Motivo de cancelación", required: true, minLength: 3, confirmText: "Cancelar item" });
    if (!motivo || !motivo.trim()) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await cancelarItemOrdenTaller(ordenId, item.id, { id_usuario: usuarioId, motivo: motivo.trim() });
      await refrescarOrden();
      setMensaje("Item cancelado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo cancelar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function generarVenta() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const resultado = await generarVentaDesdeOrdenTaller(ordenId, { id_usuario: usuarioId });
      await refrescarOrden();
      setMensaje(`Venta #${resultado.venta_id} generada desde taller. Ya podés cobrarla desde esta OT.`);
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo generar la venta desde taller");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoDirecto(nuevoEstadoDirecto, mensajeOk) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await cambiarEstadoOrdenTaller(ordenId, {
        nuevo_estado: nuevoEstadoDirecto,
        id_usuario: usuarioId,
      });
      await refrescarOrden();
      setMensaje(mensajeOk || `Estado actualizado a ${labelEstado(nuevoEstadoDirecto)}`);
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo actualizar el estado");
    } finally {
      setGuardando(false);
    }
  }

  function irACobrarVenta() {
    if (!orden?.id_venta_generada) return;
    navigate(`/ventas/${orden.id_venta_generada}/cobro`);
  }


  function imprimirPresupuesto() {
    if (!orden?.id) return;
    window.open(getPresupuestoTallerUrl(orden.id), "_blank", "noopener,noreferrer");
  }

  async function guardarOperativo(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await actualizarOperativoOrdenTaller(ordenId, {
        fecha_prometida: operativoForm.fecha_prometida
          ? new Date(operativoForm.fecha_prometida).toISOString()
          : null,
        prioridad: operativoForm.prioridad || "normal",
        id_usuario: usuarioId,
      });
      await refrescarOrden();
      setMensaje("Datos operativos actualizados");
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudieron actualizar los datos operativos");
    } finally {
      setGuardando(false);
    }
  }

  async function agregarNota(e) {
    e.preventDefault();
    if (!notaForm.contenido.trim()) {
      setError("Escribí el contenido de la nota.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await crearNotaOrdenTaller(ordenId, {
        tipo: notaForm.tipo,
        contenido: notaForm.contenido.trim(),
        id_usuario: usuarioId,
      });
      setNotaForm({ tipo: "interna", contenido: "" });
      await refrescarOrden();
      setMensaje("Nota técnica agregada.");
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo agregar la nota");
    } finally {
      setGuardando(false);
    }
  }

  async function editarNota(nota) {
    const contenido = await pedirPrompt({
      title: "Editar nota",
      message: "Corregí el contenido sin perder su trazabilidad.",
      label: labelTipoNota(nota.tipo),
      defaultValue: nota.contenido,
      placeholder: "Contenido de la nota",
      confirmText: "Guardar cambios",
    });
    if (contenido === null || !contenido.trim()) return;

    try {
      setGuardando(true);
      setError("");
      await actualizarNotaOrdenTaller(ordenId, nota.id, {
        contenido: contenido.trim(),
        id_usuario: usuarioId,
      });
      await refrescarOrden();
      setMensaje("Nota actualizada.");
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo editar la nota");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoNota(nota, estado) {
    try {
      setGuardando(true);
      setError("");
      await actualizarNotaOrdenTaller(ordenId, nota.id, {
        estado,
        id_usuario: usuarioId,
      });
      await refrescarOrden();
      setMensaje(
        estado === "resuelta"
          ? "Nota marcada como resuelta."
          : estado === "archivada"
            ? "Nota archivada."
            : "Nota reactivada.",
      );
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo actualizar la nota");
    } finally {
      setGuardando(false);
    }
  }

  async function enviarWhatsappRetiro() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const data = await generarMensajeListaRetiroOrdenTaller(ordenId);

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.mensaje);
        setMensaje("El cliente no tiene teléfono válido. Copié el mensaje al portapapeles.");
      } else {
        setMensaje("El cliente no tiene teléfono válido. Copiá el mensaje manualmente desde backend.");
      }

      await marcarAvisoRetiroOrdenTaller(ordenId, { id_usuario: usuarioId });
      await refrescarOrden();
      setMensaje(data.whatsapp_url ? "WhatsApp abierto y aviso marcado" : "Aviso marcado; revisá el mensaje copiado");
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo generar el WhatsApp de retiro");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <div style={styles.state}>Cargando orden...</div>;
  if (!orden) return <div style={styles.state}>No se encontró la orden.</div>;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Orden de taller</p>
          <h1 style={styles.title}>Orden #{orden.id}</h1>
          <p style={styles.subtitle}>
            Ingresada: {formatDate(orden.fecha_ingreso)} · {nombreClienteOrden(orden)} · {descripcionBicicletaOrden(orden)}
          </p>
          {orden.es_service_postventa && (
            <p style={styles.subtitle}>
              Service bonificado de postventa · {orden.tipo_postventa === "service_30_dias" ? "30 días" : orden.tipo_postventa}
            </p>
          )}
        </div>

        <div style={{ ...styles.heroActions, ...(isMobile ? styles.heroActionsMobile : {}) }}>
          <button type="button" onClick={cargarTodo} style={styles.secondaryHeroButton}>↻ Refrescar</button>
          <Link to="/taller" style={styles.secondaryHeroButton}>← Volver</Link>
        </div>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      <section style={{ ...styles.metricsGrid, ...(isMobile ? styles.metricsGridMobile : {}) }}>
        <Metric label="Estado" value={<EstadoBadge estado={orden.estado} />} tone="dark" />
        <Metric
          label="Tipo"
          value={orden.es_service_postventa ? "Postventa 30 días" : "Taller"}
          tone={orden.es_service_postventa ? "info" : "muted"}
        />
        <Metric
          label={esOrdenPostventa ? "Diferencia a cobrar" : "Total"}
          value={formatMoney(orden.total_final)}
          tone={
            esOrdenPostventa && Number(orden.total_final || 0) <= 0
              ? "ok"
              : "orange"
          }
        />
        <Metric label="Saldo pendiente" value={esOrdenPostventa ? "No aplica" : formatMoney(orden.saldo_pendiente)} tone={esOrdenPostventa || Number(orden.saldo_pendiente || 0) <= 0 ? "ok" : "warning"} />
        <Metric label="Venta" value={esOrdenPostventa ? "No aplica" : orden.id_venta_generada ? `#${orden.id_venta_generada}` : "No generada"} tone={esOrdenPostventa || orden.id_venta_generada ? "ok" : "warning"} />
        <Metric label="Prometida" value={orden.fecha_prometida ? formatDate(orden.fecha_prometida) : "Sin fecha"} tone={orden.dias_demorados > 0 ? "warning" : "muted"} />
        <Metric label="Demora" value={orden.dias_demorados > 0 ? `${orden.dias_demorados} día(s)` : "Sin demora"} tone={orden.dias_demorados > 0 ? "warning" : "ok"} />
        <Metric label="Prioridad" value={orden.prioridad === "urgente" ? "Urgente" : "Normal"} tone={orden.prioridad === "urgente" ? "warning" : "muted"} />
        <Metric label="Items" value={resumen.items} tone="muted" />
        <Metric label="Ejecutados" value={resumen.ejecutados} tone="ok" />
        <Metric label="Pendientes" value={resumen.presupuestados + resumen.aprobados} tone="info" />
      </section>

      <AccionesRapidasTaller
        orden={orden}
        resumen={resumen}
        guardando={guardando}
        esOrdenPostventa={esOrdenPostventa}
        items={items}
        puedeGenerarVenta={puedeGenerarVenta}
        puedeMarcarListaParaRetirar={puedeMarcarListaParaRetirar}
        puedeMarcarRetirada={puedeMarcarRetirada}
        onImprimirPresupuesto={imprimirPresupuesto}
        onGenerarVenta={generarVenta}
        onCobrar={irACobrarVenta}
        onListaParaRetirar={() => cambiarEstadoDirecto("lista_para_retirar", "Orden lista para retirar")}
        onWhatsappRetiro={enviarWhatsappRetiro}
        onRetirada={() => cambiarEstadoDirecto("retirada", "Orden marcada como retirada")}
      />

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={{ ...styles.mainColumn, ...(isMobile ? styles.mainColumnMobile : {}) }}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Problema reportado</p>
                <h2 style={styles.cardTitle}>{orden.problema_reportado}</h2>
                {orden.observaciones && <p style={styles.muted}>{orden.observaciones}</p>}
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <p style={styles.eyebrow}>Historial técnico</p>
              <h2 style={styles.cardTitle}>Notas y recomendaciones</h2>
              <p style={styles.muted}>
                La visibilidad al cliente depende del tipo elegido.
              </p>
            </div>

            {alertasBicicleta.length > 0 ? (
              <div style={styles.previousAlertsBox}>
                <strong>Alertas activas de servicios anteriores</strong>
                {alertasBicicleta.map((alerta) => (
                  <div key={alerta.id} style={styles.previousAlertItem}>
                    <span>{alerta.contenido}</span>
                    <Link
                      to={`/taller/${alerta.id_orden_taller}`}
                      style={styles.previousAlertLink}
                    >
                      Ver OT #{alerta.id_orden_taller}
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}

            <form onSubmit={agregarNota} style={styles.noteComposer}>
              <label style={styles.field}>
                <span style={styles.label}>Tipo de nota</span>
                <select
                  value={notaForm.tipo}
                  onChange={(e) =>
                    setNotaForm((actual) => ({ ...actual, tipo: e.target.value }))
                  }
                  style={styles.input}
                >
                  <option value="interna">Nota interna</option>
                  <option value="cliente">Nota para cliente</option>
                  <option value="recomendacion_futura">Recomendación futura</option>
                  <option value="alerta_tecnica">Alerta técnica de bicicleta</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Contenido</span>
                <textarea
                  value={notaForm.contenido}
                  onChange={(e) =>
                    setNotaForm((actual) => ({
                      ...actual,
                      contenido: e.target.value,
                    }))
                  }
                  placeholder="Ej: revisar pastillas de freno en el próximo service"
                  style={styles.noteTextarea}
                  maxLength={2000}
                />
              </label>

              <div style={styles.noteComposerFooter}>
                <span style={styles.noteVisibilityHint}>
                  {visibilidadTipoNota(notaForm.tipo)}
                </span>
                <button
                  type="submit"
                  disabled={guardando || !notaForm.contenido.trim()}
                  style={styles.primaryButton}
                >
                  Agregar nota
                </button>
              </div>
            </form>

            {notas.length === 0 ? (
              <div style={styles.emptySmall}>Todavía no hay notas técnicas.</div>
            ) : (
              <div style={styles.notesList}>
                {notas.map((nota) => (
                  <article
                    key={nota.id}
                    style={{
                      ...styles.technicalNote,
                      ...(nota.estado === "archivada"
                        ? styles.technicalNoteArchived
                        : {}),
                    }}
                  >
                    <div style={styles.technicalNoteHeader}>
                      <div style={styles.noteBadges}>
                        <span style={styleTipoNota(nota.tipo)}>
                          {labelTipoNota(nota.tipo)}
                        </span>
                        <span style={styleEstadoNota(nota.estado)}>
                          {labelEstadoNota(nota.estado)}
                        </span>
                      </div>
                      <span style={styles.technicalNoteMeta}>
                        {formatDate(nota.created_at)} ·{" "}
                        {nota.usuario_creador_nombre ||
                          `Usuario #${nota.id_usuario_creador}`}
                      </span>
                    </div>

                    <p style={styles.technicalNoteText}>{nota.contenido}</p>

                    <div style={styles.noteActions}>
                      <button
                        type="button"
                        onClick={() => editarNota(nota)}
                        disabled={guardando}
                        style={styles.smallSecondary}
                      >
                        Editar
                      </button>
                      {nota.estado !== "resuelta" ? (
                        <button
                          type="button"
                          onClick={() => cambiarEstadoNota(nota, "resuelta")}
                          disabled={guardando}
                          style={styles.smallPrimary}
                        >
                          Marcar resuelta
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cambiarEstadoNota(nota, "activa")}
                          disabled={guardando}
                          style={styles.smallSecondary}
                        >
                          Reactivar
                        </button>
                      )}
                      {nota.estado !== "archivada" ? (
                        <button
                          type="button"
                          onClick={() => cambiarEstadoNota(nota, "archivada")}
                          disabled={guardando}
                          style={styles.smallDanger}
                        >
                          Archivar
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {esOrdenPostventa ? (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>Service postventa</p>
                  <h2 style={styles.cardTitle}>Service bonificado con repuestos opcionales</h2>
                  <p style={styles.muted}>
                    La mano de obra queda cubierta. Si se cambia una pieza, podés bonificarla total o parcialmente y cobrar sólo la diferencia.
                  </p>
                </div>
              </div>

              <div style={styles.postventaNotice}>
                Sin repuestos pagos, la OT sigue en $0. Si existe una diferencia por upgrade, ejecutá el repuesto y generá la venta por ese importe.
              </div>
            </section>
          ) : null}

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Presupuesto / repuestos</p>
                <h2 style={styles.cardTitle}>Agregar item</h2>
                <p style={styles.muted}>El stock se descuenta recién al ejecutar el item aprobado.</p>
              </div>
            </div>

            <form onSubmit={agregarItem} style={styles.itemComposer}>
              <div style={{ ...styles.tipoSelector, ...(isMobile ? styles.tipoSelectorMobile : {}) }}>
                <button
                  type="button"
                  onClick={() => cambiarTipoItem("repuesto")}
                  style={itemForm.tipo_item === "repuesto" ? styles.tipoButtonActive : styles.tipoButton}
                >
                  Repuesto / accesorio
                </button>
                <button
                  type="button"
                  onClick={() => cambiarTipoItem("servicio")}
                  style={itemForm.tipo_item === "servicio" ? styles.tipoButtonActive : styles.tipoButton}
                >
                  Servicio
                </button>
              </div>

              {itemForm.tipo_item === "servicio" ? (
                <>
                  <label style={styles.field}>
                    <span style={styles.label}>Buscar servicio de taller</span>
                    <input
                      value={busquedaServicio}
                      onChange={(e) => setBusquedaServicio(e.target.value)}
                      placeholder="Ej: centrado, service completo, armado..."
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Servicio seleccionado</span>
                    <select
                      value={itemForm.id_servicio_taller}
                      onChange={(e) => seleccionarServicio(e.target.value)}
                      style={styles.input}
                    >
                      <option value="">Seleccionar servicio...</option>
                      {serviciosFiltrados.map((servicio) => (
                        <option key={servicio.id} value={String(servicio.id)}>
                          {servicio.nombre} - {formatMoney(servicio.precio_sugerido)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={styles.selectorHint}>
                    Los servicios no tienen stock, proveedor ni variantes. Se copia nombre y precio sugerido a la orden.
                  </div>

                  <div style={styles.itemsPicker}>
                    {serviciosFiltrados.length === 0 ? (
                      <div style={styles.emptySmall}>No hay servicios activos para mostrar.</div>
                    ) : (
                      serviciosFiltrados.map((servicio) => (
                        <ServicioTallerOption
                          key={servicio.id}
                          servicio={servicio}
                          selected={String(itemForm.id_servicio_taller) === String(servicio.id)}
                          onSelect={() => seleccionarServicio(servicio.id)}
                          onDoubleAdd={() =>
                            agregarItemDirectoDesdeSelector({
                              tipo_item: "servicio",
                              id: servicio.id,
                              precio_unitario: servicio.precio_sugerido,
                            })
                          }
                        />
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label style={styles.field}>
                    <span style={styles.label}>Buscar repuesto o accesorio</span>
                    <input
                      value={busquedaVariante}
                      onChange={(e) => setBusquedaVariante(e.target.value)}
                      placeholder="Ej: cámara, cadena, freno, lubricante..."
                      style={styles.input}
                    />
                  </label>

                  <div style={styles.selectorHint}>
                    Se ocultan bicicletas completas y serializadas. Los servicios se cargan desde el selector Servicio.
                  </div>

                  <div style={styles.itemsPicker}>
                    {variantesFiltradas.length === 0 ? (
                      <div style={styles.emptySmall}>No hay resultados permitidos para taller.</div>
                    ) : (
                      variantesFiltradas.map((v) => (
                        <TallerItemOption
                          key={v.id}
                          item={v}
                          selected={String(itemForm.id_variante) === String(v.id)}
                          onSelect={() => seleccionarVariante(v.id)}
                          onDoubleAdd={() =>
                            agregarItemDirectoDesdeSelector({
                              tipo_item: "repuesto",
                              id: v.id,
                              precio_unitario: v.precio_minorista,
                            })
                          }
                        />
                      ))
                    )}
                  </div>
                </>
              )}

              {itemSeleccionado && (
                <div style={styles.selectedItemBox}>
                  <div>
                    <span style={styles.label}>Seleccionado</span>
                    <strong>{itemForm.tipo_item === "servicio" ? itemSeleccionado.nombre : itemSeleccionado.producto_nombre}</strong>
                    <p>{itemForm.tipo_item === "servicio" ? itemSeleccionado.descripcion || "Servicio de taller" : itemSeleccionado.nombre_variante || "Única"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItemForm((prev) => ({ ...prev, id_variante: "", id_servicio_taller: "", precio_unitario: "" }))}
                    style={styles.smallSecondary}
                  >
                    Quitar
                  </button>
                </div>
              )}

              {esOrdenPostventa && itemForm.tipo_item === "servicio" ? (
                <div style={styles.coverageInfo}>
                  La mano de obra de este service se cubrirá automáticamente al 100%.
                </div>
              ) : null}

              {esOrdenPostventa && itemForm.tipo_item === "repuesto" ? (
                <div style={styles.coveragePanel}>
                  <label style={styles.coverageToggle}>
                    <input
                      type="checkbox"
                      checked={itemForm.cubrir_garantia}
                      onChange={(e) =>
                        setItemForm((actual) => ({
                          ...actual,
                          cubrir_garantia: e.target.checked,
                          valor_cobertura_unitario: e.target.checked
                            ? actual.valor_cobertura_unitario
                            : "",
                        }))
                      }
                    />
                    Cubrir por garantía / postventa
                  </label>

                  {itemForm.cubrir_garantia ? (
                    <div style={styles.coverageFields}>
                      <label style={styles.field}>
                        <span style={styles.label}>Valor reconocido por garantía</span>
                        <input
                          type="number"
                          min="0"
                          max={itemForm.precio_unitario || undefined}
                          step="0.01"
                          value={itemForm.valor_cobertura_unitario}
                          onChange={(e) =>
                            setItemForm((actual) => ({
                              ...actual,
                              valor_cobertura_unitario: e.target.value,
                            }))
                          }
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Motivo</span>
                        <select
                          value={itemForm.motivo_cobertura}
                          onChange={(e) =>
                            setItemForm((actual) => ({
                              ...actual,
                              motivo_cobertura: e.target.value,
                            }))
                          }
                          style={styles.input}
                        >
                          <option>Garantía fábrica</option>
                          <option>Garantía local</option>
                          <option>Service postventa</option>
                          <option>Atención comercial</option>
                          <option>Diferencia por upgrade</option>
                          <option>Otro</option>
                        </select>
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Observación opcional</span>
                        <input
                          value={itemForm.observacion_cobertura}
                          onChange={(e) =>
                            setItemForm((actual) => ({
                              ...actual,
                              observacion_cobertura: e.target.value,
                            }))
                          }
                          placeholder="Ej: se reconoce el valor del piñón original"
                          style={styles.input}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div style={styles.coverageResult}>
                    <span>Precio: {formatMoney(itemForm.precio_unitario || 0)}</span>
                    <span>
                      Cobertura: -
                      {formatMoney(
                        itemForm.cubrir_garantia
                          ? itemForm.valor_cobertura_unitario || 0
                          : 0,
                      )}
                    </span>
                    <strong>
                      Diferencia por unidad:{" "}
                      {formatMoney(
                        Math.max(
                          0,
                          Number(itemForm.precio_unitario || 0) -
                            Number(
                              itemForm.cubrir_garantia
                                ? itemForm.valor_cobertura_unitario || 0
                                : 0,
                            ),
                        ),
                      )}
                    </strong>
                  </div>
                </div>
              ) : null}

              <div style={{ ...styles.itemFormRow, ...(isMobile ? styles.itemFormRowMobile : {}) }}>
                {itemForm.tipo_item === "servicio" && !itemForm.id_servicio_taller && (
                  <div style={styles.error}>
                    Primero elegí un servicio en “Servicio seleccionado”.
                  </div>
                )}
                <label style={styles.field}>
                  <span style={styles.label}>Cantidad</span>
                  <input type="number" min="0.01" step="0.01" value={itemForm.cantidad} onChange={(e) => setItemForm((p) => ({ ...p, cantidad: e.target.value }))} style={styles.input} />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Precio unitario</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.precio_unitario}
                    disabled={itemForm.tipo_item === "servicio" && !itemForm.id_servicio_taller}
                    onChange={(e) =>
                      setItemForm((p) => ({
                        ...p,
                        precio_unitario: e.target.value,
                      }))
                    }
                    style={styles.input}
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    guardando ||
                    (itemForm.tipo_item === "servicio" && !itemForm.id_servicio_taller) ||
                    (itemForm.tipo_item === "repuesto" && !itemForm.id_variante)
                  }
                  style={{
                    ...styles.primaryButton,
                    opacity:
                      guardando ||
                      (itemForm.tipo_item === "servicio" && !itemForm.id_servicio_taller) ||
                      (itemForm.tipo_item === "repuesto" && !itemForm.id_variante)
                        ? 0.55
                        : 1,
                    cursor:
                      guardando ||
                      (itemForm.tipo_item === "servicio" && !itemForm.id_servicio_taller) ||
                      (itemForm.tipo_item === "repuesto" && !itemForm.id_variante)
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Agregar {itemForm.tipo_item === "servicio" ? "servicio" : "repuesto"}
                </button>
              </div>
            </form>
          </section>

          <section style={styles.cardNoPadding}>
            <div style={styles.tableHeader}>
              <div>
                <p style={styles.eyebrow}>{esOrdenPostventa ? "Control realizado" : "Trabajo"}</p>
                <h2 style={styles.cardTitle}>{esOrdenPostventa ? "Detalle postventa" : "Items de la orden"}</h2>
              </div>
            </div>

            {items.length === 0 ? (
              esOrdenPostventa ? (
                <div style={styles.empty}>
                  Service sin repuestos adicionales. Total a cobrar: $0.
                </div>
              ) : (
                <div style={styles.empty}>Todavía no hay items cargados.</div>
              )
            ) : (
              <div style={styles.itemsList}>
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    guardando={guardando}
                    onAprobar={() => aprobarItem(item, true)}
                    onDesaprobar={() => aprobarItem(item, false)}
                    onEjecutar={() => ejecutarItem(item)}
                    onRevertir={() => revertirItem(item)}
                    onCancelar={() => handleCancelarItem(item)}
                  />
                ))}
              </div>
            )}
          </section>
        </section>

        <aside style={{ ...styles.sidePanel, ...(isMobile ? styles.sidePanelMobile : {}) }}>
          <OperadorPanel
            compact={isMobile}
            orden={orden}
            resumen={resumen}
            guardando={guardando}
            puedeTerminarTrabajo={puedeTerminarTrabajo}
            puedeGenerarVenta={puedeGenerarVenta}
            puedeMarcarListaParaRetirar={puedeMarcarListaParaRetirar}
            puedeMarcarRetirada={puedeMarcarRetirada}
            onPasarPresupuestada={() => cambiarEstadoDirecto("presupuestada", "Orden marcada como presupuestada")}
            onPasarEnReparacion={() => cambiarEstadoDirecto("en_reparacion", "Orden marcada en reparación")}
            onTerminar={() => cambiarEstadoDirecto("terminada", "Trabajo marcado como terminado")}
            onGenerarVenta={generarVenta}
            onCobrar={irACobrarVenta}
            onListaParaRetirar={() => cambiarEstadoDirecto("lista_para_retirar", "Orden lista para retirar")}
            onRetirada={() => cambiarEstadoDirecto("retirada", "Orden marcada como retirada")}
          />

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Operativo</h2>
            <form onSubmit={guardarOperativo} style={styles.statusForm}>
              <label style={styles.field}>
                <span style={styles.label}>Fecha prometida</span>
                <input
                  type="datetime-local"
                  value={operativoForm.fecha_prometida}
                  onChange={(e) => setOperativoForm((prev) => ({ ...prev, fecha_prometida: e.target.value }))}
                  disabled={orden.estado === "retirada" || orden.estado === "cancelada"}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Prioridad</span>
                <select
                  value={operativoForm.prioridad}
                  onChange={(e) => setOperativoForm((prev) => ({ ...prev, prioridad: e.target.value }))}
                  disabled={orden.estado === "retirada" || orden.estado === "cancelada"}
                  style={styles.input}
                >
                  <option value="normal">Normal</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={guardando || orden.estado === "retirada" || orden.estado === "cancelada"}
                style={styles.primaryButton}
              >
                Guardar operativo
              </button>
            </form>
            <div style={styles.note}>La fecha prometida alimenta atrasadas y prioridad del tablero.</div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Estado manual</h2>
            <form onSubmit={cambiarEstado} style={styles.statusForm}>
              <Info label="Actual" value={<EstadoBadge estado={orden.estado} />} />
              <label style={styles.field}>
                <span style={styles.label}>Mover a</span>
                <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} style={styles.input}>
                  <option value={orden.estado}>{labelEstado(orden.estado)} actual</option>
                  {estadosPermitidos.map((estado) => <option key={estado} value={estado}>{labelEstado(estado)}</option>)}
                  {estadosPermitidos.length === 0 && ESTADOS.filter((estado) => estado === orden.estado).map((estado) => <option key={estado} value={estado}>{labelEstado(estado)}</option>)}
                </select>
              </label>
              <button type="submit" disabled={guardando || nuevoEstado === orden.estado} style={styles.primaryButton}>Actualizar estado</button>
            </form>
            <div style={styles.note}>Uso avanzado. El flujo recomendado está arriba; este selector queda para casos puntuales.</div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Eventos</h2>
            {eventos.length === 0 ? (
              <div style={styles.emptySmall}>No hay eventos registrados.</div>
            ) : (
              <div style={styles.timeline}>
                {eventos.slice().reverse().map((evento) => (
                  <div key={evento.id} style={styles.eventItem}>
                    <strong>{humanizarEvento(evento.tipo_evento)}</strong>
                    <span>
                      {formatDate(evento.fecha)} · {formatUsuario(evento)}
                    </span>
                    {evento.detalle && <p>{evento.detalle}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>

      <PromptModal
        open={Boolean(promptConfig)}
        title={promptConfig?.title}
        message={promptConfig?.message}
        label={promptConfig?.label}
        defaultValue={promptConfig?.defaultValue}
        placeholder={promptConfig?.placeholder}
        inputType={promptConfig?.inputType}
        confirmText={promptConfig?.confirmText}
        cancelText={promptConfig?.cancelText}
        required={promptConfig?.required}
        minLength={promptConfig?.minLength}
        validate={promptConfig?.validate}
        onConfirm={promptConfig?.onConfirm}
        onCancel={promptConfig?.onCancel}
      />
    </div>
  );
}

function labelTipoNota(tipo) {
  const labels = {
    interna: "Nota interna",
    cliente: "Nota para cliente",
    recomendacion_futura: "Recomendación futura",
    alerta_tecnica: "Alerta técnica",
  };
  return labels[tipo] || tipo;
}

function labelEstadoNota(estado) {
  const labels = {
    activa: "Activa",
    resuelta: "Resuelta",
    archivada: "Archivada",
  };
  return labels[estado] || estado;
}

function visibilidadTipoNota(tipo) {
  if (tipo === "interna") {
    return "Sólo visible para el equipo. Nunca sale en PDF ni WhatsApp.";
  }
  if (tipo === "alerta_tecnica") {
    return "Queda destacada en la ficha de la bicicleta y futuras revisiones.";
  }
  return "Puede aparecer en el PDF y en el mensaje de retiro al cliente.";
}

function styleTipoNota(tipo) {
  const tones = {
    interna: { background: "#f1f5f9", color: "#475569" },
    cliente: { background: "#eff6ff", color: "#1d4ed8" },
    recomendacion_futura: { background: "#ecfdf5", color: "#047857" },
    alerta_tecnica: { background: "#fff7ed", color: "#c2410c" },
  };
  return {
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 950,
    ...(tones[tipo] || tones.interna),
  };
}

function styleEstadoNota(estado) {
  const tones = {
    activa: { background: "#fef3c7", color: "#92400e" },
    resuelta: { background: "#dcfce7", color: "#166534" },
    archivada: { background: "#e2e8f0", color: "#475569" },
  };
  return {
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
    ...(tones[estado] || tones.activa),
  };
}
