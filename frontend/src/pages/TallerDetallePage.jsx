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
  });

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
  }

  const items = orden?.items || [];
  const eventos = orden?.eventos || [];

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

  const puedeTerminarTrabajo =
    orden?.estado === "en_reparacion" &&
    resumen.activos > 0 &&
    resumen.pendientesAprobacion === 0 &&
    resumen.pendientesEjecucion === 0;

  const puedeGenerarVenta =
    orden?.estado === "terminada" &&
    !orden?.id_venta_generada &&
    resumen.facturables > 0;

  const puedeMarcarListaParaRetirar =
    orden?.estado === "facturada" &&
    Boolean(orden?.id_venta_generada);

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
      if (estado === "lista_para_retirar" && !orden.id_venta_generada) {
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
            id_usuario: usuarioId,
          };


      const resultado = await agregarItemOrdenTaller(
        ordenId,
        payload
      );

      
      setItemForm({ tipo_item: itemForm.tipo_item, id_variante: "", id_servicio_taller: "", cantidad: "1", precio_unitario: "" });
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
      setMensaje(`Venta #${resultado.venta_id} generada desde taller`);
      navigate(`/ventas/${resultado.venta_id}/cobro`);
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
        <Metric label="Total" value={formatMoney(orden.total_final)} tone="orange" />
        <Metric label="Saldo pendiente" value={formatMoney(orden.saldo_pendiente)} tone={Number(orden.saldo_pendiente || 0) > 0 ? "warning" : "ok"} />
        <Metric label="Venta" value={orden.id_venta_generada ? `#${orden.id_venta_generada}` : "No generada"} tone={orden.id_venta_generada ? "ok" : "warning"} />
        <Metric label="Items" value={resumen.items} tone="muted" />
        <Metric label="Ejecutados" value={resumen.ejecutados} tone="ok" />
        <Metric label="Pendientes" value={resumen.presupuestados + resumen.aprobados} tone="info" />
      </section>

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
                <p style={styles.eyebrow}>Trabajo</p>
                <h2 style={styles.cardTitle}>Items de la orden</h2>
              </div>
            </div>

            {items.length === 0 ? (
              <div style={styles.empty}>Todavía no hay items cargados.</div>
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
            <h2 style={styles.sideTitle}>Presupuesto</h2>
            <div style={styles.billingBox}>
              <p style={styles.muted}>Imprimí el presupuesto para aprobación del cliente. No genera venta ni cobra.</p>
              <button
                type="button"
                onClick={imprimirPresupuesto}
                disabled={items.filter((item) => item.etapa !== "cancelado").length === 0}
                style={styles.secondaryButtonFull}
              >
                Imprimir presupuesto
              </button>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Facturación</h2>
            <div style={styles.billingBox}>
              {orden.id_venta_generada ? (
                <>
                  <Info label="Venta generada" value={`#${orden.id_venta_generada}`} />
                  <Link to={`/ventas/${orden.id_venta_generada}/cobro`} style={styles.linkButton}>Cobrar venta</Link>
                </>
              ) : orden.estado === "terminada" ? (
                <>
                  {items.some((item) => item.tipo_item === "servicio" && item.etapa === "ejecutado") ? (
                    <p style={styles.warningText}>
                      Esta orden tiene servicios ejecutados. Todavía no generes venta desde taller hasta adaptar Ventas para líneas sin variante.
                    </p>
                  ) : (
                    <p style={styles.muted}>El trabajo está terminado. Generá la venta para cobrar con el flujo normal de ventas.</p>
                  )}
                  <button
                    type="button"
                    onClick={generarVenta}
                    disabled={
                      guardando ||
                      resumen.ejecutados === 0 ||
                      items.some((item) => item.tipo_item === "servicio" && item.etapa === "ejecutado")
                    }
                    style={styles.primaryButton}
                  >
                    Generar venta
                  </button>
                </>
              ) : (
                <p style={styles.muted}>La venta se habilita cuando la orden queda terminada.</p>
              )}
            </div>
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
                    <span>{formatDate(evento.fecha)} · Usuario #{evento.id_usuario}</span>
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
