import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Plus, RefreshCw, Save, ShoppingCart, Trash2 } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { listarVariantes } from "../services/catalogoService";
import { listarServiciosTaller } from "../services/serviciosTallerService";
import {
  agregarItemCotizacion,
  actualizarCantidadItemCotizacion,
  cambiarEstadoCotizacion,
  convertirCotizacionAVenta,
  generarMensajeWhatsappCotizacion,
  obtenerCotizacion,
  obtenerPreviewConversionCotizacion,
  quitarItemCotizacion,
} from "../services/cotizacionesService";
import { getCotizacionPdfUrl } from "../services/documentosService";
import { formatDate, formatMoney } from "../utils/formatters";
import { formatProductoVariante } from "../utils/productPresentation";
import { Button, EmptyState, PageHeader, useBreakpoint } from "../components/ui";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";

const ESTADOS_ACCION = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
];

const itemInicial = {
  tipo_item: "producto",
  id_variante: "",
  id_servicio_taller: "",
  descripcion_snapshot: "",
  cantidad: "1",
  precio_unitario: "",
};

export default function CotizacionDetallePage() {
  const { cotizacionId } = useParams();
  const navigate = useNavigate();
  const isMobile = useBreakpoint();
  const { usuarioId } = useSession();
  const [cotizacion, setCotizacion] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [estadoNuevo, setEstadoNuevo] = useState("");
  const [itemForm, setItemForm] = useState(itemInicial);
  const [cantidades, setCantidades] = useState({});
  const [conversionPreview, setConversionPreview] = useState(null);
  const [conversionError, setConversionError] = useState("");
  const [serializadasSeleccionadas, setSerializadasSeleccionadas] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarTodo();
  }, [cotizacionId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [cotizacionData, variantesData, serviciosData] = await Promise.all([
        obtenerCotizacion(cotizacionId),
        listarVariantes(),
        listarServiciosTaller(),
      ]);
      setCotizacion(cotizacionData);
      setEstadoNuevo(cotizacionData.estado);
      setCantidades(
        Object.fromEntries(
          (cotizacionData.items || []).map((item) => [item.id, String(item.cantidad)])
        )
      );
      setVariantes((variantesData || []).filter((item) => item.activo !== false));
      setServicios((serviciosData || []).filter((item) => item.activo !== false));
    } catch (err) {
      setError(err.message || "No se pudo cargar la cotizacion");
    } finally {
      setLoading(false);
    }
  }

  async function refrescarCotizacion() {
    const data = await obtenerCotizacion(cotizacionId);
    setCotizacion(data);
    setEstadoNuevo(data.estado);
    setCantidades(
      Object.fromEntries((data.items || []).map((item) => [item.id, String(item.cantidad)]))
    );
  }

  const puedeEditar = ["borrador", "enviada"].includes(cotizacion?.estado);

  useEffect(() => {
    if (cotizacion?.estado === "aceptada") {
      cargarPreviewConversion();
    } else {
      setConversionPreview(null);
      setConversionError("");
    }
  }, [cotizacion?.estado]);

  const itemSeleccionado = useMemo(() => {
    if (itemForm.tipo_item === "producto") {
      return variantes.find((item) => String(item.id) === String(itemForm.id_variante));
    }
    if (itemForm.tipo_item === "servicio_taller") {
      return servicios.find((item) => String(item.id) === String(itemForm.id_servicio_taller));
    }
    return null;
  }, [itemForm, variantes, servicios]);

  function cambiarTipoItem(tipoItem) {
    setItemForm({ ...itemInicial, tipo_item: tipoItem });
  }

  function actualizarItem(campo, value) {
    setItemForm((prev) => ({ ...prev, [campo]: value }));
  }

  async function handleAgregarItem(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await agregarItemCotizacion(cotizacionId, normalizarItem(itemForm));
      setItemForm(itemInicial);
      await refrescarCotizacion();
      setMensaje("Item agregado");
    } catch (err) {
      setError(err.message || "No se pudo agregar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function handleQuitarItem(itemId) {
    if (!window.confirm("Quitar este item de la cotizacion?")) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await quitarItemCotizacion(cotizacionId, itemId);
      await refrescarCotizacion();
      setMensaje("Item quitado");
    } catch (err) {
      setError(err.message || "No se pudo quitar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function handleActualizarCantidad(item) {
    const cantidad = Number(cantidades[item.id] || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await actualizarCantidadItemCotizacion(cotizacionId, item.id, cantidad);
      await refrescarCotizacion();
      setMensaje("Cantidad actualizada");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la cantidad");
    } finally {
      setGuardando(false);
    }
  }

  async function cargarPreviewConversion() {
    try {
      setConversionError("");
      const data = await obtenerPreviewConversionCotizacion(cotizacionId);
      setConversionPreview(data);
      setSerializadasSeleccionadas((prev) => {
        const siguiente = { ...prev };
        (data.items || [])
          .filter((item) => item.serializable)
          .forEach((item) => {
            const cantidad = Math.max(0, Number(item.cantidad || 0));
            siguiente[item.id_cotizacion_item] = Array.from(
              { length: cantidad },
              (_, index) => siguiente[item.id_cotizacion_item]?.[index] || ""
            );
          });
        return siguiente;
      });
    } catch (err) {
      setConversionPreview(null);
      setConversionError(err.message || "No se pudo revisar el stock");
    }
  }

  function seleccionarSerializada(itemId, index, bicicletaId) {
    setSerializadasSeleccionadas((prev) => {
      const actual = [...(prev[itemId] || [])];
      actual[index] = bicicletaId;
      return { ...prev, [itemId]: actual };
    });
  }

  function serializadasCompletas() {
    return (conversionPreview?.items || [])
      .filter((item) => item.serializable)
      .every((item) => {
        const seleccionadas = serializadasSeleccionadas[item.id_cotizacion_item] || [];
        const cantidad = Number(item.cantidad || 0);
        return (
          seleccionadas.length === cantidad &&
          seleccionadas.every(Boolean) &&
          new Set(seleccionadas.map(String)).size === seleccionadas.length
        );
      });
  }

  async function handleConvertirAVenta() {
    if (!conversionPreview?.puede_convertir || !serializadasCompletas()) return;
    if (!window.confirm("Se creará una venta pendiente de cobro y entrega. ¿Continuar?")) {
      return;
    }

    const serializadas = Object.entries(serializadasSeleccionadas).flatMap(
      ([itemId, bicicletas]) =>
        (bicicletas || []).filter(Boolean).map((bicicletaId) => ({
          id_cotizacion_item: Number(itemId),
          id_bicicleta_serializada: Number(bicicletaId),
        }))
    );

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const resultado = await convertirCotizacionAVenta(cotizacionId, {
        id_usuario: Number(usuarioId || 1),
        serializadas,
      });
      navigate(`/ventas/${resultado.venta_id}`, {
        state: { scrollToTop: true },
      });
    } catch (err) {
      const mensajeError = err.message || "No se pudo convertir la cotización";
      await cargarPreviewConversion();
      setConversionError(mensajeError);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEstado(e) {
    e.preventDefault();
    if (!estadoNuevo || estadoNuevo === cotizacion.estado) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const data = await cambiarEstadoCotizacion(cotizacionId, {
        estado: estadoNuevo,
        id_usuario: Number(usuarioId || 1),
      });
      setCotizacion(data);
      setMensaje("Estado actualizado");
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    } finally {
      setGuardando(false);
    }
  }

  async function handleWhatsapp() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const data = await generarMensajeWhatsappCotizacion(cotizacionId);

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
        setMensaje("WhatsApp abierto");
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.mensaje);
        setMensaje("Sin telefono valido. Mensaje copiado al portapapeles.");
      } else {
        setMensaje(data.mensaje);
      }
    } catch (err) {
      setError(err.message || "No se pudo generar el WhatsApp");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <EmptyState title="Cargando cotización..." description="Actualizando el detalle comercial." />;
  if (!cotizacion) return <EmptyState title="No se encontró la cotización" description="Volvé al listado e intentá nuevamente." />;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title={cotizacion.numero}
        subtitle={`${cotizacion.tipo === "reparacion" ? "Reparación" : "Bici / productos"} · ${formatDate(cotizacion.fecha)}`}
        actions={(
          <>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Volver</Button>
            <Button type="button" variant="outline" onClick={cargarTodo}><RefreshCw size={17} /> Refrescar</Button>
          </>
        )}
      />

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <section style={{ ...styles.metricsGrid, ...(isMobile ? styles.metricsGridMobile : {}) }}>
        <Metric label="Estado" value={labelEstado(cotizacion.estado)} tone={cotizacion.estado === "aceptada" ? "ok" : "info"} />
        <Metric label="Cliente" value={cotizacion.cliente_nombre || cotizacion.cliente_nombre_snapshot || "Mostrador"} tone="muted" />
        <Metric label="Items" value={cotizacion.items.length} tone="muted" />
        <Metric label="Lista aplicada" value={labelTipoPrecio(cotizacion.tipo_precio)} tone="ok" />
        <Metric label="Subtotal" value={formatMoney(cotizacion.subtotal)} tone="muted" />
        <Metric label="Total" value={formatMoney(cotizacion.total_final)} tone="orange" />
      </section>

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={styles.mainColumn}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Detalle</p>
                <h2 style={styles.cardTitle}>{cotizacion.problema_reportado || "Cotizacion comercial"}</h2>
                {cotizacion.observaciones && <p style={styles.muted}>{cotizacion.observaciones}</p>}
              </div>
            </div>
          </section>

          <section style={styles.cardNoPadding}>
            <div style={styles.tableHeader}>
              <div>
                <p style={styles.eyebrow}>Items</p>
                <h2 style={styles.cardTitle}>Detalle cotizado</h2>
              </div>
            </div>

            {cotizacion.items.length === 0 ? (
              <div style={styles.empty}>Todavia no hay items cargados.</div>
            ) : (
              <div style={styles.itemsList}>
                {cotizacion.items.map((item) => (
                  <article key={item.id} style={styles.itemCard}>
                    <div>
                      <div style={styles.itemTitleLine}>
                        <span style={styles.typeBadge}>{labelTipoItem(item.tipo_item)}</span>
                        <strong>{item.descripcion_snapshot}</strong>
                      </div>
                      <p style={styles.muted}>
                        {formatMoney(item.precio_unitario)} c/u
                      </p>
                      {puedeEditar && (
                        <div style={styles.quantityEditor}>
                          <label style={styles.quantityLabel}>
                            Cantidad
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={cantidades[item.id] ?? item.cantidad}
                              onChange={(e) =>
                                setCantidades((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              style={styles.quantityInput}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleActualizarCantidad(item)}
                            disabled={
                              guardando ||
                              Number(cantidades[item.id]) === Number(item.cantidad)
                            }
                            style={styles.smallSecondary}
                            title="Guardar cantidad"
                          >
                            <Save size={15} /> Guardar
                          </button>
                        </div>
                      )}
                      {!puedeEditar && (
                        <p style={styles.muted}>Cantidad {item.cantidad}</p>
                      )}
                    </div>
                    <div style={styles.itemRight}>
                      <strong>{formatMoney(item.subtotal)}</strong>
                      {puedeEditar && (
                        <button type="button" onClick={() => handleQuitarItem(item.id)} disabled={guardando} style={styles.smallDanger}>
                          <Trash2 size={15} /> Quitar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside style={styles.sidePanel}>
          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Acciones</h2>
            <div style={styles.actionGrid}>
              <button type="button" onClick={handleWhatsapp} disabled={guardando} style={styles.primaryButton}>
                <MessageCircle size={17} /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => window.open(getCotizacionPdfUrl(cotizacion.id), "_blank", "noopener,noreferrer")}
                style={styles.secondaryButtonFull}
              >
                Ver PDF
              </button>
              <Link to="/cotizaciones" style={styles.secondaryLink}>Ver listado</Link>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Estado</h2>
            <form onSubmit={handleEstado} style={styles.form}>
              <label style={styles.field}>
                <span>Mover a</span>
                <select value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value)} style={styles.input}>
                  {ESTADOS_ACCION.map((estado) => (
                    <option key={estado.value} value={estado.value}>{estado.label}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={guardando || estadoNuevo === cotizacion.estado} style={styles.primaryButton}>
                Actualizar estado
              </button>
            </form>
          </section>

          {cotizacion.estado === "aceptada" && (
            <section style={styles.card}>
              <h2 style={styles.sideTitle}>Convertir en venta</h2>
              <p style={styles.muted}>
                Aceptar no reserva mercadería. El stock se controla nuevamente ahora.
              </p>

              {conversionError && (
                <div style={{ ...styles.notice, ...styles.noticeDanger }}>
                  {conversionError}
                </div>
              )}

              {conversionPreview?.advertencias?.length > 0 && (
                <div style={{ ...styles.notice, ...styles.noticeWarning }}>
                  {conversionPreview.advertencias.map((advertencia) => (
                    <div key={advertencia}>{advertencia}</div>
                  ))}
                </div>
              )}

              <div style={styles.conversionItems}>
                {(conversionPreview?.items || []).map((item) => (
                  <div key={item.id_cotizacion_item} style={styles.conversionItem}>
                    <strong>{item.descripcion}</strong>
                    <span>
                      Solicitado: {item.cantidad} · Disponible: {item.disponible}
                    </span>
                    {Number(item.faltante || 0) > 0 && (
                      <span style={styles.missingText}>Faltan {item.faltante}</span>
                    )}

                    {item.serializable &&
                      Array.from({ length: Number(item.cantidad || 0) }, (_, index) => {
                        const elegidas =
                          serializadasSeleccionadas[item.id_cotizacion_item] || [];
                        return (
                          <label key={index} style={styles.field}>
                            <span>Número de cuadro {index + 1}</span>
                            <select
                              value={elegidas[index] || ""}
                              onChange={(e) =>
                                seleccionarSerializada(
                                  item.id_cotizacion_item,
                                  index,
                                  e.target.value
                                )
                              }
                              style={styles.input}
                            >
                              <option value="">Seleccionar...</option>
                              {(item.serializadas_disponibles || []).map((bicicleta) => (
                                <option
                                  key={bicicleta.id}
                                  value={bicicleta.id}
                                  disabled={elegidas.some(
                                    (id, posicion) =>
                                      posicion !== index &&
                                      String(id) === String(bicicleta.id)
                                  )}
                                >
                                  {bicicleta.numero_cuadro}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleConvertirAVenta}
                disabled={
                  guardando ||
                  !conversionPreview?.puede_convertir ||
                  !serializadasCompletas()
                }
                style={styles.primaryButton}
              >
                <ShoppingCart size={17} />
                {guardando ? "Creando venta..." : "Crear venta"}
              </button>
            </section>
          )}

          {cotizacion.estado === "convertida" && cotizacion.id_venta_convertida && (
            <section style={styles.card}>
              <h2 style={styles.sideTitle}>Venta generada</h2>
              <Link
                to={`/ventas/${cotizacion.id_venta_convertida}`}
                style={styles.primaryButton}
              >
                <ShoppingCart size={17} /> Ver venta #{cotizacion.id_venta_convertida}
              </Link>
            </section>
          )}

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Agregar item</h2>
            {!puedeEditar ? (
              <div style={styles.notice}>Solo se pueden editar cotizaciones en borrador o enviadas.</div>
            ) : (
              <form onSubmit={handleAgregarItem} style={styles.form}>
                <div style={styles.segmented}>
                  <button type="button" onClick={() => cambiarTipoItem("producto")} style={itemForm.tipo_item === "producto" ? styles.segmentActive : styles.segment}>Producto</button>
                  <button type="button" onClick={() => cambiarTipoItem("servicio_taller")} style={itemForm.tipo_item === "servicio_taller" ? styles.segmentActive : styles.segment}>Servicio</button>
                  <button type="button" onClick={() => cambiarTipoItem("linea_libre")} style={itemForm.tipo_item === "linea_libre" ? styles.segmentActive : styles.segment}>Libre</button>
                </div>

                {itemForm.tipo_item === "producto" && (
                  <label style={styles.field}>
                    <span>Producto</span>
                    <select value={itemForm.id_variante} onChange={(e) => actualizarItem("id_variante", e.target.value)} required style={styles.input}>
                      <option value="">Seleccionar...</option>
                      {variantes.map((variante) => (
                        <option key={variante.id} value={variante.id}>
                          {formatProductoVariante(
                            variante.producto_nombre,
                            variante.nombre_variante
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {itemForm.tipo_item === "servicio_taller" && (
                  <label style={styles.field}>
                    <span>Servicio</span>
                    <select value={itemForm.id_servicio_taller} onChange={(e) => actualizarItem("id_servicio_taller", e.target.value)} required style={styles.input}>
                      <option value="">Seleccionar...</option>
                      {servicios.map((servicio) => (
                        <option key={servicio.id} value={servicio.id}>{servicio.nombre}</option>
                      ))}
                    </select>
                  </label>
                )}

                {itemForm.tipo_item === "linea_libre" && (
                  <label style={styles.field}>
                    <span>Descripcion</span>
                    <input value={itemForm.descripcion_snapshot} onChange={(e) => actualizarItem("descripcion_snapshot", e.target.value)} required style={styles.input} />
                  </label>
                )}

                <div style={styles.twoCols}>
                  <label style={styles.field}>
                    <span>Cantidad</span>
                    <input type="number" min="0.01" step="0.01" value={itemForm.cantidad} onChange={(e) => actualizarItem("cantidad", e.target.value)} required style={styles.input} />
                  </label>
                  <label style={styles.field}>
                    <span>Precio</span>
                    <input type="number" min="0" step="0.01" value={itemForm.precio_unitario} onChange={(e) => actualizarItem("precio_unitario", e.target.value)} placeholder="Auto" style={styles.input} />
                  </label>
                </div>

                {itemSeleccionado && (
                  <div style={styles.notice}>
                    Precio {labelTipoPrecio(cotizacion.tipo_precio).toLowerCase()}: {formatMoney(getPrecioItemSeleccionado(itemSeleccionado, itemForm.tipo_item, cotizacion.tipo_precio))}
                  </div>
                )}

                <button type="submit" disabled={guardando} style={styles.primaryButton}>
                  <Plus size={17} /> Agregar item
                </button>
              </form>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

function normalizarItem(item) {
  return {
    tipo_item: item.tipo_item,
    id_variante: item.id_variante ? Number(item.id_variante) : null,
    id_servicio_taller: item.id_servicio_taller ? Number(item.id_servicio_taller) : null,
    descripcion_snapshot: item.descripcion_snapshot || null,
    cantidad: item.cantidad || "1",
    precio_unitario: item.precio_unitario === "" ? null : item.precio_unitario,
  };
}

function getPrecioItemSeleccionado(item, tipoItem, tipoPrecio) {
  if (tipoItem === "producto") {
    if (tipoPrecio === "mayorista") return Number(item.precio_mayorista || 0);
    return Number(item.precio_minorista || 0);
  }

  return Number(item.precio_sugerido || 0);
}

function labelTipoPrecio(tipoPrecio) {
  return tipoPrecio === "mayorista" ? "Mayorista" : "Minorista";
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function labelEstado(estado) {
  const labels = {
    borrador: "Borrador",
    enviada: "Enviada",
    aceptada: "Aceptada",
    convertida: "Convertida",
    rechazada: "Rechazada",
    vencida: "Vencida",
    cancelada: "Cancelada",
  };
  return labels[estado] || estado;
}

function labelTipoItem(tipo) {
  if (tipo === "servicio_taller") return "Servicio";
  if (tipo === "linea_libre") return "Libre";
  return "Producto";
}

const styles = {
  page: { minHeight: "100vh", display: "grid", gap: spacing.xl, color: colors.text, fontFamily: typography.fontFamily },
  pageMobile: { padding: 10 },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 22, background: "#0f172a", color: "white", marginBottom: 16, boxShadow: "0 18px 40px rgba(15,23,42,.18)" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  heroButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 13, padding: "12px 14px", fontWeight: 1000, cursor: "pointer" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: spacing.md },
  metricsGridMobile: { gridTemplateColumns: "1fr 1fr", gap: 8 },
  metric: { background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, padding: spacing.lg, display: "grid", gap: 5, boxShadow: shadows.sm },
  metricTones: { ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }, info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }, muted: { color: "#475569", background: "#f8fafc" }, orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" } },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: spacing.lg, alignItems: "start" },
  layoutMobile: { gridTemplateColumns: "1fr" },
  mainColumn: { display: "grid", gap: 16 },
  sidePanel: { display: "grid", gap: 16, position: "sticky", top: 16 },
  card: { background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, padding: spacing.lg, boxShadow: shadows.sm },
  cardNoPadding: { background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, overflow: "hidden", boxShadow: shadows.sm },
  sectionHeader: { marginBottom: 4 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  cardTitle: { margin: "4px 0 0", fontSize: 22 },
  sideTitle: { margin: "0 0 12px", fontSize: 20 },
  muted: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  tableHeader: { padding: 18, borderBottom: "1px solid #e2e8f0" },
  itemsList: { display: "grid", gap: 10, padding: 16 },
  itemCard: { border: "1px solid #e2e8f0", borderRadius: 16, padding: 13, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  itemTitleLine: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  itemRight: { display: "grid", gap: 8, justifyItems: "end" },
  quantityEditor: { display: "flex", alignItems: "end", gap: 8, marginTop: 8, flexWrap: "wrap" },
  quantityLabel: { display: "grid", gap: 4, color: "#475569", fontSize: 12, fontWeight: 900 },
  quantityInput: { width: 96, minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 10, padding: "7px 9px", fontWeight: 850 },
  smallSecondary: { display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36, border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 10, padding: "7px 10px", fontWeight: 900, cursor: "pointer" },
  typeBadge: { background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000 },
  smallDanger: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  form: { display: "grid", gap: 12 },
  actionGrid: { display: "grid", gap: 10 },
  field: { display: "grid", gap: spacing.sm, fontSize: typography.label.fontSize, fontWeight: typography.label.fontWeight, color: colors.text },
  input: { width: "100%", minHeight: controls.minHeight, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: controls.padding, boxSizing: "border-box", background: colors.surface, color: colors.text },
  segmented: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  segment: { border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 12, padding: "10px 8px", fontWeight: 1000, cursor: "pointer" },
  segmentActive: { border: "1px solid #f97316", background: "#fff7ed", color: "#c2410c", borderRadius: 12, padding: "10px 8px", fontWeight: 1000, cursor: "pointer" },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", textDecoration: "none" },
  secondaryButtonFull: { width: "100%", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  secondaryLink: { display: "block", textAlign: "center", textDecoration: "none", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000 },
  notice: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 13, padding: 12, fontWeight: 850 },
  noticeDanger: { background: "#fef2f2", borderColor: "#fecaca", color: "#b42318", marginTop: 10 },
  noticeWarning: { background: "#fffbeb", borderColor: "#fde68a", color: "#92400e", marginTop: 10, display: "grid", gap: 5 },
  conversionItems: { display: "grid", gap: 9, margin: "12px 0" },
  conversionItem: { display: "grid", gap: 6, border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, color: "#475569", fontSize: 13 },
  missingText: { color: "#b42318", fontWeight: 950 },
  empty: { padding: 22, color: "#64748b", fontWeight: 900 },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 850 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 850 },
  state: { padding: 24, fontWeight: 900 },
};
