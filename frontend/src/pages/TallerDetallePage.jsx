import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { formatDate, formatMoney, formatNumber } from "../utils/formatters";
import { EstadoBadge } from "./TallerListPage";
import { PromptModal } from "../components/ui/PromptModal";
import ProductImage from "../components/catalogo/ProductImage";

const ESTADOS = [
  "ingresada",
  "presupuestada",
  "esperando_aprobacion",
  "esperando_repuestos",
  "en_reparacion",
  "terminada",
  "facturada",
  "lista_para_retirar",
  "retirada",
  "cancelada",
];

const TRANSICIONES_UI = {
  ingresada: ["presupuestada", "cancelada"],
  presupuestada: ["esperando_aprobacion", "en_reparacion", "cancelada"],
  esperando_aprobacion: ["en_reparacion", "cancelada"],
  esperando_repuestos: ["en_reparacion", "cancelada"],
  en_reparacion: ["esperando_repuestos", "terminada", "cancelada"],
  terminada: ["facturada", "lista_para_retirar"],
  facturada: ["lista_para_retirar"],
  lista_para_retirar: ["retirada"],
  retirada: [],
  cancelada: [],
};

export default function TallerDetallePage() {
  const { ordenId } = useParams();
  const navigate = useNavigate();
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
        acc.items += 1;
        if (item.etapa === "presupuestado") acc.presupuestados += 1;
        if (item.etapa === "agregado") acc.aprobados += 1;
        if (item.etapa === "ejecutado") acc.ejecutados += 1;
        if (item.etapa === "cancelado") acc.cancelados += 1;
        acc.total += item.etapa === "cancelado" ? 0 : Number(item.subtotal || 0);
        return acc;
      },
      { items: 0, presupuestados: 0, aprobados: 0, ejecutados: 0, cancelados: 0, total: 0 }
    );
  }, [items]);

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
    return TRANSICIONES_UI[orden.estado] || [];
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
      await cambiarEstadoOrdenTaller(ordenId, { nuevo_estado: nuevoEstado, id_usuario: 1 });
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
            id_usuario: 1,
          }
        : {
            tipo_item: "repuesto",
            id_variante: Number(itemForm.id_variante),
            cantidad: Number(itemForm.cantidad),
            precio_unitario: Number(itemForm.precio_unitario || 0),
            id_usuario: 1,
          };

      await agregarItemOrdenTaller(ordenId, payload);
      
      setItemForm({ tipo_item: itemForm.tipo_item, id_variante: "", id_servicio_taller: "", cantidad: "1", precio_unitario: "" });
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
      await aprobarItemOrdenTaller(ordenId, item.id, { aprobado, id_usuario: 1 });
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
      await ejecutarItemOrdenTaller(ordenId, item.id, 1);
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
      await revertirEjecucionItemOrdenTaller(ordenId, item.id, { id_usuario: 1, motivo: motivo.trim() });
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
      await cancelarItemOrdenTaller(ordenId, item.id, { id_usuario: 1, motivo: motivo.trim() });
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
      const resultado = await generarVentaDesdeOrdenTaller(ordenId, { id_usuario: 1 });
      await refrescarOrden();
      setMensaje(`Venta #${resultado.venta_id} generada desde taller`);
      navigate(`/ventas/${resultado.venta_id}/cobro`);
    } catch (err) {
      setError(err.message || "No se pudo generar la venta desde taller");
    } finally {
      setGuardando(false);
    }
  }


  function imprimirPresupuesto() {
    if (!orden?.id) return;
    window.open(getPresupuestoTallerUrl(orden.id), "_blank", "noopener,noreferrer");
  }

  if (loading) return <div style={styles.state}>Cargando orden...</div>;
  if (!orden) return <div style={styles.state}>No se encontró la orden.</div>;

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <p style={styles.kicker}>Orden de taller</p>
          <h1 style={styles.title}>Orden #{orden.id}</h1>
          <p style={styles.subtitle}>
            Ingresada: {formatDate(orden.fecha_ingreso)} · {nombreClienteOrden(orden)} · {descripcionBicicletaOrden(orden)}
          </p>
        </div>

        <div style={styles.heroActions}>
          <button type="button" onClick={cargarTodo} style={styles.secondaryHeroButton}>↻ Refrescar</button>
          <Link to="/taller" style={styles.secondaryHeroButton}>← Volver</Link>
        </div>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      <section style={styles.metricsGrid}>
        <Metric label="Estado" value={<EstadoBadge estado={orden.estado} />} tone="dark" />
        <Metric label="Total" value={formatMoney(orden.total_final)} tone="orange" />
        <Metric label="Saldo pendiente" value={formatMoney(orden.saldo_pendiente)} tone={Number(orden.saldo_pendiente || 0) > 0 ? "warning" : "ok"} />
        <Metric label="Venta" value={orden.id_venta_generada ? `#${orden.id_venta_generada}` : "No generada"} tone={orden.id_venta_generada ? "ok" : "warning"} />
        <Metric label="Items" value={resumen.items} tone="muted" />
        <Metric label="Ejecutados" value={resumen.ejecutados} tone="ok" />
        <Metric label="Pendientes" value={resumen.presupuestados + resumen.aprobados} tone="info" />
      </section>

      <main style={styles.layout}>
        <section style={styles.mainColumn}>
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
              <div style={styles.tipoSelector}>
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

              {itemForm.tipo_item === "servicio" && !itemForm.id_servicio_taller && (
                <div style={styles.formWarning}>
                  Primero elegí un servicio en “Servicio seleccionado”.
                </div>
              )}

              <div style={styles.itemFormRow}>
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

        <aside style={styles.sidePanel}>
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
                  <p style={styles.muted}>
                    El trabajo está terminado. Generá la venta para cobrar con el flujo normal de ventas.
                  </p>

                  <button
                    type="button"
                    onClick={generarVenta}
                    disabled={guardando || resumen.ejecutados === 0}
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
            <h2 style={styles.sideTitle}>Estado operativo</h2>
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
            <div style={styles.note}>El backend define transiciones válidas. Si una transición falla, no la fuerces desde el front.</div>
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

function ServicioTallerOption({ servicio, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={selected ? styles.tallerOptionSelected : styles.tallerOption}
    >
      <div style={styles.optionImageBox}>
        <span style={styles.serviceIcon}>🛠</span>
      </div>

      <div style={styles.optionBody}>
        <div style={styles.optionTop}>
          <strong>{servicio.nombre}</strong>
          <span style={styles.serviceBadge}>{selected ? "Seleccionado" : "Servicio"}</span>
        </div>
        <p>{servicio.descripcion || "Servicio de taller"}</p>
        <div style={styles.optionMeta}>
          {servicio.duracion_estimada_min != null && <span>{servicio.duracion_estimada_min} min</span>}
          <span>Sin stock</span>
        </div>
      </div>

      <strong style={styles.optionPrice}>{formatMoney(servicio.precio_sugerido)}</strong>
    </button>
  );
}

function TallerItemOption({ item, selected, onSelect }) {
  const tipo = tipoTallerLabel(item);
  const esServicio = tipo === "Servicio";

  return (
    <button
      type="button"
      onClick={onSelect}
      style={selected ? styles.tallerOptionSelected : styles.tallerOption}
    >
      <div style={styles.optionImageBox}>
        {esServicio ? (
          <span style={styles.serviceIcon}>🛠</span>
        ) : (
          <ProductImage url={item.imagen_principal} size={54} />
        )}
      </div>

      <div style={styles.optionBody}>
        <div style={styles.optionTop}>
          <strong>{item.producto_nombre}</strong>
          <span style={tipo === "Servicio" ? styles.serviceBadge : styles.partBadge}>{tipo}</span>
        </div>
        <p>{item.nombre_variante || "Única"}</p>
        <div style={styles.optionMeta}>
          {item.codigo_proveedor && <span>Prov: {item.codigo_proveedor}</span>}
          {item.sku && <span>SKU: {item.sku}</span>}
          {item.stock_disponible != null && !esServicio && <span>Stock: {formatNumber(item.stock_disponible)}</span>}
        </div>
      </div>

      <strong style={styles.optionPrice}>{formatMoney(item.precio_minorista)}</strong>
    </button>
  );
}

function ItemCard({ item, guardando, onAprobar, onDesaprobar, onEjecutar, onRevertir, onCancelar }) {
  return (
    <article style={item.etapa === "cancelado" ? styles.itemCardMuted : styles.itemCard}>
      <div style={styles.itemTop}>
        <div>
          <div style={styles.itemTitleLine}>
            <span style={item.tipo_item === "servicio" ? styles.serviceBadge : styles.partBadge}>
              {item.tipo_item === "servicio" ? "Servicio" : "Repuesto"}
            </span>
            <strong style={styles.itemTitle}>{item.descripcion_snapshot}</strong>
          </div>
          <p style={styles.muted}>#{item.id} · Cantidad {formatNumber(item.cantidad)} · {formatMoney(item.precio_unitario)} c/u</p>
        </div>
        <EtapaBadge etapa={item.etapa} aprobado={item.aprobado} />
      </div>

      <div style={styles.itemBottom}>
        <strong>{formatMoney(item.subtotal)}</strong>
        <div style={styles.itemActions}>
          {item.etapa === "presupuestado" && (
            <>
              <button disabled={guardando} onClick={onAprobar} style={styles.smallPrimary}>Aprobar</button>
              <button disabled={guardando} onClick={onCancelar} style={styles.smallDanger}>Cancelar</button>
            </>
          )}

          {item.etapa === "agregado" && (
            <>
              <button disabled={guardando} onClick={onEjecutar} style={styles.smallPrimary}>Ejecutar</button>
              <button disabled={guardando} onClick={onDesaprobar} style={styles.smallSecondary}>Desaprobar</button>
              <button disabled={guardando} onClick={onCancelar} style={styles.smallDanger}>Cancelar</button>
            </>
          )}

          {item.etapa === "ejecutado" && <button disabled={guardando} onClick={onRevertir} style={styles.smallSecondary}>Revertir</button>}
          {item.etapa === "cancelado" && <span style={styles.smallMuted}>Sin acciones</span>}
        </div>
      </div>
    </article>
  );
}

function EtapaBadge({ etapa, aprobado }) {
  const tone = etapa === "ejecutado" ? "ok" : etapa === "agregado" ? "info" : etapa === "cancelado" ? "danger" : "warning";
  const label = etapa === "agregado" && aprobado ? "Aprobado" : labelEtapa(etapa);
  return <span style={{ ...styles.stageBadge, ...(styles.stageTones[tone] || {}) }}>{label}</span>;
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
      <strong>{value || "-"}</strong>
    </div>
  );
}

function labelEstado(estado) {
  const labels = {
    ingresada: "Ingresada",
    presupuestada: "Presupuestada",
    esperando_aprobacion: "Esperando aprobación",
    esperando_repuestos: "Esperando repuestos",
    en_reparacion: "En reparación",
    terminada: "Terminada",
    facturada: "Facturada",
    lista_para_retirar: "Lista para retirar",
    retirada: "Retirada",
    cancelada: "Cancelada",
  };
  return labels[estado] || estado;
}

function labelEtapa(etapa) {
  const labels = { presupuestado: "Presupuestado", agregado: "Aprobado", ejecutado: "Ejecutado", cancelado: "Cancelado" };
  return labels[etapa] || etapa;
}

function humanizarEvento(evento) {
  return String(evento || "").replaceAll("_", " ");
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esBicicletaCatalogo(item) {
  const texto = normalizarTexto([
    item?.producto_nombre,
    item?.nombre_variante,
    item?.categoria_nombre,
    item?.tipo_bicicleta,
  ].filter(Boolean).join(" "));

  return Boolean(item?.serializable) || texto.includes("bicicleta") || texto.includes("bici ");
}

function esItemPermitidoParaTaller(item) {
  return !esBicicletaCatalogo(item);
}

function tipoTallerLabel(item) {
  const texto = normalizarTexto([item?.categoria_nombre, item?.tipo_item, item?.producto_nombre].filter(Boolean).join(" "));
  if (texto.includes("servicio")) return "Servicio";
  if (texto.includes("repuesto")) return "Repuesto";
  if (texto.includes("accesorio")) return "Accesorio";
  return item?.tipo_item === "servicio" ? "Servicio" : "Insumo";
}

function prioridadTipoTaller(item) {
  const tipo = tipoTallerLabel(item);
  if (tipo === "Servicio") return 1;
  if (tipo === "Repuesto") return 2;
  if (tipo === "Accesorio") return 3;
  return 4;
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  secondaryHeroButton: { textDecoration: "none", border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 },
  metric: { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 5, boxShadow: "0 10px 22px rgba(15,23,42,.06)" },
  metricTones: { dark: { color: "#0f172a" }, ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }, info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }, warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" }, muted: { color: "#475569", background: "#f8fafc" }, orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" } },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" },
  mainColumn: { display: "grid", gap: 16 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  cardNoPadding: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  sectionHeader: { marginBottom: 14 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  cardTitle: { margin: "3px 0 0", fontSize: 22, letterSpacing: "-.02em" },
  muted: { color: "#64748b", margin: "4px 0 0", fontWeight: 700 },
  itemGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "end" },
  itemComposer: { display: "grid", gap: 12 },
  tipoSelector: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  tipoButton: { border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 14, padding: "12px 14px", fontWeight: 1000, cursor: "pointer" },
  tipoButtonActive: { border: "1px solid #f97316", background: "#fff7ed", color: "#c2410c", borderRadius: 14, padding: "12px 14px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 22px rgba(249,115,22,.12)" },
  selectorHint: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 13, padding: "10px 12px", fontWeight: 800, fontSize: 13 },
  itemsPicker: { display: "grid", gap: 10, maxHeight: 360, overflowY: "auto", paddingRight: 4 },
  tallerOption: { width: "100%", border: "1px solid #e2e8f0", background: "white", borderRadius: 16, padding: 10, display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) auto", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer" },
  tallerOptionSelected: { width: "100%", border: "1px solid #f97316", background: "#fff7ed", borderRadius: 16, padding: 10, display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) auto", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", boxShadow: "0 10px 22px rgba(249,115,22,.15)" },
  optionImageBox: { width: 58, height: 58, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", placeItems: "center", overflow: "hidden" },
  serviceIcon: { fontSize: 28 },
  optionBody: { minWidth: 0, display: "grid", gap: 4 },
  optionTop: { display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" },
  optionMeta: { display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12, fontWeight: 800 },
  serviceBadge: { background: "#ecfdf5", color: "#047857", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000 },
  partBadge: { background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000 },
  optionPrice: { whiteSpace: "nowrap", fontSize: 15 },
  selectedItemBox: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 16, padding: 12 },
  formWarning: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, fontWeight: 800 },
  itemFormRow: { display: "grid", gridTemplateColumns: "160px 180px minmax(180px, 1fr)", gap: 12, alignItems: "end" },
  field: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  label: { color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  primaryButton: { border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 20px rgba(249,115,22,.22)" },
  secondaryButtonFull: { width: "100%", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", textAlign: "center" },
  tableHeader: { padding: 18, borderBottom: "1px solid #e2e8f0" },
  itemsList: { display: "grid", gap: 10, padding: 16 },
  itemCard: { border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 12, background: "white" },
  itemCardMuted: { border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 12, background: "#f8fafc", opacity: 0.78 },
  itemTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  itemTitleLine: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  itemTitle: { fontSize: 16 },
  itemBottom: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10 },
  itemActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  smallPrimary: { border: "none", background: "#0f172a", color: "white", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallSecondary: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallDanger: { border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallMuted: { color: "#64748b", fontWeight: 800 },
  sidePanel: { display: "grid", gap: 16, position: "sticky", top: 16 },
  sideTitle: { margin: "0 0 12px", fontSize: 20 },
  statusForm: { display: "grid", gap: 12 },
  billingBox: {
    display: "grid",
    gap: 10,
  },
  linkButton: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 12,
    padding: "11px 12px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  note: { marginTop: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 14, padding: 12, fontWeight: 800 },
  warningText: { margin: 0, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 14, padding: 12, fontWeight: 800 },
  infoBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, display: "grid", gap: 5, color: "#64748b" },
  timeline: { display: "grid", gap: 10, maxHeight: 480, overflowY: "auto" },
  eventItem: { borderLeft: "4px solid #f97316", background: "#f8fafc", borderRadius: 14, padding: 12, display: "grid", gap: 4, color: "#334155" },
  empty: { padding: 22, color: "#64748b", fontWeight: 900 },
  emptySmall: { color: "#64748b", fontWeight: 900, background: "#f8fafc", borderRadius: 14, padding: 12 },
  stageBadge: { borderRadius: 999, padding: "7px 10px", fontWeight: 1000, fontSize: 12, whiteSpace: "nowrap", border: "1px solid transparent" },
  stageTones: { ok: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }, info: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }, warning: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }, danger: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" } },
  state: { padding: 24, fontWeight: 900 },
};

function nombreClienteOrden(orden) {
  return orden?.cliente_nombre || `Cliente #${orden?.id_cliente}`;
}

function descripcionBicicletaOrden(orden) {
  if (orden?.bicicleta_descripcion) return orden.bicicleta_descripcion;

  const partes = [
    orden?.bicicleta_marca,
    orden?.bicicleta_modelo,
    orden?.bicicleta_rodado ? `R${orden.bicicleta_rodado}` : null,
    orden?.bicicleta_color,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" ") : `Bicicleta #${orden?.id_bicicleta_cliente}`;
}
