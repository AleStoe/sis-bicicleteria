import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import {
  agregarCostoAcondicionamiento,
  agregarItemAcondicionamiento,
  agregarRecuperoAcondicionamiento,
  aplicarAcondicionamiento,
  confirmarAcondicionamiento,
  crearAcondicionamiento,
  listarAcondicionamientosBicicleta,
  quitarCostoAcondicionamiento,
  quitarItemAcondicionamiento,
  quitarRecuperoAcondicionamiento,
  resolverPiezaRetiradaAcondicionamiento,
  revertirAcondicionamiento,
} from "../../services/acondicionamientosService";
import { listarStock } from "../../services/stockService";
import SearchField from "../ui/SearchField";

const TIPOS_INTERVENCION = [
  ["reemplazo", "Reemplazo"],
  ["mejora", "Mejora"],
  ["agregado_incluido", "Agregado incluido"],
];

const TIPOS_COSTO = [
  ["mano_obra", "Mano de obra"],
  ["trabajo_externo", "Trabajo externo"],
  ["consumible_no_inventariado", "Consumible no inventariado"],
  ["otro", "Otro"],
];

const TIPOS_RECUPERO = [
  ["nota_credito", "Nota de crédito"],
  ["garantia", "Garantía"],
  ["recupero", "Recupero"],
  ["otro", "Otro"],
];

const DESTINOS_PIEZA_RETIRADA = [
  ["descarte", "Descarte"],
  ["garantia", "Garantía / reclamo"],
  ["recuperable", "Guardar para recuperar"],
];

const ESTADOS_PIEZA_RETIRADA = {
  descarte: [["descartada", "Descartada"]],
  garantia: [["en_garantia", "En garantía"], ["compensada", "Compensada"]],
  recuperable: [["pendiente", "Pendiente de revisión"], ["recuperada", "Recuperada"], ["descartada", "Descartada"]],
};

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function sugerirPrecioVenta(precioActual, costoActual, costoNuevo) {
  const precio = Number(precioActual || 0);
  const costoBase = Number(costoActual || 0);
  const costoFinal = Number(costoNuevo || 0);
  if (precio <= 0 || costoFinal <= 0) return 0;
  const calculado = costoBase > 0
    ? precio * (costoFinal / costoBase)
    : precio + Math.max(0, costoFinal - costoBase);
  return Math.ceil(calculado / 1000) * 1000;
}

function labelOf(options, value) {
  return options.find(([key]) => key === value)?.[1] || value;
}

function estadoLabel(estado) {
  return {
    borrador: "Borrador",
    confirmado: "Plan confirmado",
    aplicado: "Trabajo aplicado",
    revertido: "Revertido",
  }[estado] || estado;
}

function nombreComponente(item) {
  return [item?.producto_nombre, item?.nombre_variante]
    .filter(Boolean)
    .join(" · ");
}

function codigosComponente(item) {
  return [
    item?.sku && `SKU ${item.sku}`,
    item?.codigo_barras && `EAN ${item.codigo_barras}`,
    item?.codigo_proveedor && `Prov. ${item.codigo_proveedor}`,
  ].filter(Boolean);
}

function textoSeguimientoPieza(destino, estado) {
  if (estado === "compensada") {
    return {
      label: "¿Cómo compensó el proveedor?",
      placeholder: "Ej: NC 0004-123 por $20.000 o pieza reemplazada",
      help: "Anotá la nota de crédito, reintegro o reemplazo recibido.",
    };
  }
  if (estado === "recuperada") {
    return {
      label: "¿Dónde quedó o cómo se reutilizó?",
      placeholder: "Ej: guardada en depósito, estante B",
      help: "Indicá dónde encontrarla o en qué trabajo se reutilizó.",
    };
  }
  if (estado === "descartada" || destino === "descarte") {
    return {
      label: "¿Por qué se descartó?",
      placeholder: "Ej: cubierta rajada, no reutilizable",
      help: "Dejá una explicación corta del motivo del descarte.",
    };
  }
  if (estado === "en_garantia" || destino === "garantia") {
    return {
      label: "Seguimiento de la garantía (opcional)",
      placeholder: "Ej: reclamo #123 enviado a Venzo",
      help: "Podés anotar proveedor, número de reclamo o fecha de envío.",
    };
  }
  return {
    label: "Nota de seguimiento (opcional)",
    placeholder: "Ej: pendiente de revisar en depósito",
    help: "Anotá cualquier dato que ayude a ubicar o resolver esta pieza.",
  };
}

export default function AcondicionamientoModal({ bici, usuarioId, onClose, onChanged }) {
  const [ordenes, setOrdenes] = useState([]);
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [formNueva, setFormNueva] = useState({ motivo: "", observaciones: "" });
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [componente, setComponente] = useState(null);
  const [formItem, setFormItem] = useState({
    tipo_intervencion: "reemplazo",
    cantidad: "1",
    detalle_pieza_retirada: "",
    destino_pieza_retirada: "descarte",
    observaciones: "",
  });
  const [formCosto, setFormCosto] = useState({
    tipo: "mano_obra",
    descripcion: "",
    cantidad: "1",
    costo_unitario: "",
    observaciones: "",
  });
  const [formRecupero, setFormRecupero] = useState({
    tipo: "nota_credito",
    descripcion: "",
    monto: "",
    referencia: "",
    observaciones: "",
  });
  const [mostrarAplicacion, setMostrarAplicacion] = useState(false);
  const [actualizarPrecioVenta, setActualizarPrecioVenta] = useState(true);
  const [precioVentaNuevo, setPrecioVentaNuevo] = useState("");
  const [mostrarReversion, setMostrarReversion] = useState(false);
  const [motivoReversion, setMotivoReversion] = useState("");

  const editable = orden?.estado === "borrador";
  const ordenActiva = useMemo(
    () => ordenes.find((item) => item.estado !== "revertido"),
    [ordenes]
  );

  useEffect(() => {
    cargar();
  }, [bici.id]);

  useEffect(() => {
    if (!editable || query.trim().length < 2) {
      setResultados([]);
      return;
    }

    let cancelado = false;
    const timeout = window.setTimeout(async () => {
      try {
        setBuscando(true);
        const data = await listarStock({
          q: query.trim(),
          id_sucursal: bici.id_sucursal_actual,
          tipo_operativo: "no_bicicletas",
          limit: 30,
        });
        if (!cancelado) setResultados(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelado) setError(err.message || "No se pudieron buscar componentes");
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      window.clearTimeout(timeout);
    };
  }, [query, editable, bici.id_sucursal_actual]);

  async function cargar(preferidaId = null) {
    try {
      setLoading(true);
      setError("");
      const data = await listarAcondicionamientosBicicleta(bici.id);
      const lista = Array.isArray(data) ? data : [];
      setOrdenes(lista);
      const preferida = lista.find((item) => item.id === preferidaId);
      const activa = lista.find((item) => item.estado !== "revertido");
      setOrden(preferida || activa || lista[0] || null);
    } catch (err) {
      setError(err.message || "No se pudo cargar el historial de acondicionamiento");
    } finally {
      setLoading(false);
    }
  }

  async function ejecutar(accion, exito) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      const actualizada = await accion();
      setOrden(actualizada);
      setMensaje(exito);
      await cargar(actualizada.id);
      onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo completar la operación");
    } finally {
      setProcesando(false);
    }
  }

  function crear(event) {
    event.preventDefault();
    ejecutar(
      () =>
        crearAcondicionamiento({
          id_bicicleta_serializada: bici.id,
          motivo: formNueva.motivo.trim(),
          observaciones: formNueva.observaciones.trim() || null,
          id_usuario: usuarioId,
        }),
      "Orden de acondicionamiento creada."
    );
  }

  function agregarComponente(event) {
    event.preventDefault();
    if (!componente) {
      setError("Seleccioná un componente de la búsqueda");
      return;
    }
    ejecutar(
      () =>
        agregarItemAcondicionamiento(orden.id, {
          tipo_intervencion: formItem.tipo_intervencion,
          id_variante: componente.variante_id,
          cantidad: Number(formItem.cantidad),
          detalle_pieza_retirada: formItem.detalle_pieza_retirada.trim() || null,
          destino_pieza_retirada: formItem.detalle_pieza_retirada.trim()
            ? formItem.destino_pieza_retirada
            : null,
          observaciones: formItem.observaciones.trim() || null,
          id_usuario: usuarioId,
        }),
      "Componente agregado al plan."
    );
    setComponente(null);
    setQuery("");
    setFormItem((actual) => ({
      ...actual,
      cantidad: "1",
      detalle_pieza_retirada: "",
      destino_pieza_retirada: "descarte",
      observaciones: "",
    }));
  }

  function agregarCosto(event) {
    event.preventDefault();
    ejecutar(
      () =>
        agregarCostoAcondicionamiento(orden.id, {
          ...formCosto,
          descripcion: formCosto.descripcion.trim(),
          cantidad: Number(formCosto.cantidad),
          costo_unitario: Number(formCosto.costo_unitario),
          observaciones: formCosto.observaciones.trim() || null,
          id_usuario: usuarioId,
        }),
      "Costo adicional agregado."
    );
    setFormCosto((actual) => ({
      ...actual,
      descripcion: "",
      cantidad: "1",
      costo_unitario: "",
      observaciones: "",
    }));
  }

  function confirmar() {
    ejecutar(
      () => confirmarAcondicionamiento(orden.id, { id_usuario: usuarioId }),
      "Plan confirmado. La bicicleta quedó en acondicionamiento."
    );
  }

  function agregarRecupero(event) {
    event.preventDefault();
    ejecutar(
      () =>
        agregarRecuperoAcondicionamiento(orden.id, {
          ...formRecupero,
          descripcion: formRecupero.descripcion.trim(),
          monto: Number(formRecupero.monto),
          referencia: formRecupero.referencia.trim() || null,
          observaciones: formRecupero.observaciones.trim() || null,
          id_usuario: usuarioId,
        }),
      "Recupero agregado al cálculo."
    );
    setFormRecupero((actual) => ({
      ...actual,
      descripcion: "",
      monto: "",
      referencia: "",
      observaciones: "",
    }));
  }

  function aplicar() {
    ejecutar(
      () => aplicarAcondicionamiento(orden.id, {
        id_usuario: usuarioId,
        actualizar_precio_venta: actualizarPrecioVenta,
        precio_venta_nuevo: actualizarPrecioVenta ? Number(precioVentaNuevo) : null,
      }),
      actualizarPrecioVenta
        ? "Trabajo aplicado: costo y precio de esta bicicleta actualizados."
        : "Trabajo aplicado: stock y costo de la bicicleta actualizados."
    );
    setMostrarAplicacion(false);
  }

  function abrirAplicacion() {
    const costoActual = Number(bici.costo_total_unitario || 0);
    const costoNuevo = costoActual + Number(orden.total_estimado || 0);
    const sugerido = sugerirPrecioVenta(
      orden.precio_venta_actual || bici.precio_venta_actual,
      costoActual,
      costoNuevo
    );
    setActualizarPrecioVenta(true);
    setPrecioVentaNuevo(String(sugerido || orden.precio_venta_actual || bici.precio_venta_actual || ""));
    setMostrarAplicacion(true);
  }

  function revertir(event) {
    event.preventDefault();
    if (motivoReversion.trim().length < 3) return;
    ejecutar(
      () =>
        revertirAcondicionamiento(orden.id, {
          motivo: motivoReversion.trim(),
          id_usuario: usuarioId,
        }),
      "Orden revertida."
    );
    setMostrarReversion(false);
    setMotivoReversion("");
  }

  return (
    <div style={styles.overlay} onMouseDown={onClose}>
      <section style={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <header style={styles.header}>
          <div>
            <span style={styles.kicker}>ACONDICIONAMIENTO POR CUADRO</span>
            <h2 style={styles.title}>{bici.numero_cuadro}</h2>
            <p style={styles.subtitle}>{bici.producto_nombre} · {bici.nombre_variante}</p>
          </div>
          <button type="button" onClick={onClose} style={styles.iconButton} title="Cerrar">
            <X size={20} />
          </button>
        </header>

        {error && <div style={styles.error}>{error}</div>}
        {mensaje && <div style={styles.success}>{mensaje}</div>}

        {loading ? (
          <div style={styles.empty}>Cargando ficha de trabajo...</div>
        ) : !orden || (!ordenActiva && orden?.estado === "revertido") ? (
          <div style={styles.content}>
            {ordenes.length > 0 && <HistorialOrdenes ordenes={ordenes} onSelect={setOrden} />}
            <form onSubmit={crear} style={styles.formBand}>
              <div>
                <h3 style={styles.sectionTitle}>Nueva orden</h3>
                <p style={styles.help}>Describí qué hay que resolver en esta unidad.</p>
              </div>
              <input
                style={styles.input}
                value={formNueva.motivo}
                onChange={(event) => setFormNueva((actual) => ({ ...actual, motivo: event.target.value }))}
                placeholder="Ej: reemplazar cubiertas defectuosas"
                required
                minLength={3}
              />
              <textarea
                style={styles.textarea}
                value={formNueva.observaciones}
                onChange={(event) => setFormNueva((actual) => ({ ...actual, observaciones: event.target.value }))}
                placeholder="Observaciones internas (opcional)"
              />
              <button type="submit" style={styles.primaryButton} disabled={procesando}>
                <Plus size={18} /> Crear orden
              </button>
            </form>
          </div>
        ) : (
          <div style={styles.content}>
            <div style={styles.summaryBand}>
              <div>
                <span style={styles.kicker}>{orden.codigo}</span>
                <strong style={styles.summaryTitle}>{orden.motivo}</strong>
              </div>
              <span style={{ ...styles.badge, ...(["confirmado", "aplicado"].includes(orden.estado) ? styles.badgeConfirmed : {}) }}>
                {estadoLabel(orden.estado)}
              </span>
              <Metric label={orden.estado === "aplicado" ? "Componentes reales" : "Componentes"} value={formatMoney(orden.estado === "aplicado" ? orden.costo_componentes_real : orden.total_componentes_estimado)} />
              <Metric label="Otros costos" value={formatMoney(orden.estado === "aplicado" ? orden.costo_adicional_real : orden.total_costos_adicionales)} />
              <Metric label="Recuperos" value={`- ${formatMoney(orden.estado === "aplicado" ? orden.recuperos_total : orden.total_recuperos_estimado)}`} />
              <Metric label={orden.estado === "aplicado" ? "Costo aplicado" : "Costo neto estimado"} value={formatMoney(orden.estado === "aplicado" ? orden.costo_acondicionamiento_aplicado : orden.total_estimado)} emphasis />
            </div>

            {orden.estado === "confirmado" && (
              <div style={styles.notice}>
                <CheckCircle2 size={18} /> Plan confirmado. Todavía no descontó stock ni modificó el costo de la bicicleta.
              </div>
            )}


            {orden.estado === "aplicado" && (
              <div style={styles.appliedNotice}>
                <CheckCircle2 size={18} /> Stock descontado y costo congelado. La bicicleta quedó lista con costo total de {formatMoney(orden.costo_total_unidad_nuevo)}
                {orden.precio_venta_actualizado ? ` y precio de venta de ${formatMoney(orden.precio_venta_actual)}.` : "."}
              </div>
            )}

            {editable && (
              <>
                <section style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <h3 style={styles.sectionTitle}>Componentes</h3>
                      <p style={styles.help}>Buscá por SKU, EAN, código de proveedor o nombre.</p>
                    </div>
                  </div>
                  <form onSubmit={agregarComponente} style={styles.formGrid}>
                    <div style={styles.searchArea}>
                      <label style={styles.label}>Buscar componente</label>
                      <SearchField
                          value={query}
                          onChange={(value) => {
                            setQuery(value);
                            setComponente(null);
                          }}
                          placeholder="Ej: cubierta 29, VAR-..., EAN..."
                          style={styles.searchInputWrap}
                          inputStyle={styles.searchInput}
                      />
                      {buscando && <small style={styles.muted}>Buscando...</small>}
                      {componente && (
                        <div style={styles.selectedComponent}>
                          <div style={styles.resultMain}>
                            <span style={styles.selectedEyebrow}>Componente seleccionado</span>
                            <strong style={styles.resultName}>{nombreComponente(componente)}</strong>
                            {codigosComponente(componente).length > 0 && (
                              <span style={styles.resultMeta}>{codigosComponente(componente).join(" · ")}</span>
                            )}
                          </div>
                          <div style={styles.selectedActions}>
                            <span style={Number(componente.stock_disponible) > 0 ? styles.stockOk : styles.stockBad}>
                              {Number(componente.stock_disponible || 0)} disponibles
                            </span>
                            <button
                              type="button"
                              style={styles.changeComponentButton}
                              onClick={() => {
                                setComponente(null);
                                setQuery("");
                                setResultados([]);
                              }}
                            >
                              Cambiar
                            </button>
                          </div>
                        </div>
                      )}
                      {!componente && resultados.length > 0 && (
                        <div style={styles.results}>
                          {resultados.map((item) => (
                            <button
                              type="button"
                              key={`${item.sucursal_id}-${item.variante_id}`}
                              style={styles.resultButton}
                              title={nombreComponente(item)}
                              onClick={() => {
                                setComponente(item);
                                setQuery(nombreComponente(item));
                                setResultados([]);
                              }}
                            >
                              <span style={styles.resultMain}>
                                <strong style={styles.resultName}>{nombreComponente(item)}</strong>
                                {codigosComponente(item).length > 0 && (
                                  <span style={styles.resultMeta}>{codigosComponente(item).join(" · ")}</span>
                                )}
                              </span>
                              <span style={styles.stockColumn}>
                                <small>Disponible</small>
                                <strong style={Number(item.stock_disponible) > 0 ? styles.stockOk : styles.stockBad}>
                                  {Number(item.stock_disponible || 0)}
                                </strong>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Field label="Tipo">
                      <select style={styles.input} value={formItem.tipo_intervencion} onChange={(event) => setFormItem((actual) => ({ ...actual, tipo_intervencion: event.target.value }))}>
                        {TIPOS_INTERVENCION.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </Field>
                    <Field label="Cantidad">
                      <input style={styles.input} type="number" min="0.001" step="0.001" value={formItem.cantidad} onChange={(event) => setFormItem((actual) => ({ ...actual, cantidad: event.target.value }))} required />
                    </Field>
                    {formItem.tipo_intervencion === "reemplazo" && (
                      <>
                        <Field label="Pieza retirada">
                          <input style={styles.input} value={formItem.detalle_pieza_retirada} onChange={(event) => setFormItem((actual) => ({ ...actual, detalle_pieza_retirada: event.target.value }))} placeholder="Ej: cubiertas originales falladas" />
                        </Field>
                        <Field label="Destino de lo retirado">
                          <select style={styles.input} value={formItem.destino_pieza_retirada} onChange={(event) => setFormItem((actual) => ({ ...actual, destino_pieza_retirada: event.target.value }))} disabled={!formItem.detalle_pieza_retirada.trim()}>
                            {DESTINOS_PIEZA_RETIRADA.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                          </select>
                        </Field>
                      </>
                    )}
                    <Field label="Observación">
                      <input style={styles.input} value={formItem.observaciones} onChange={(event) => setFormItem((actual) => ({ ...actual, observaciones: event.target.value }))} placeholder="Opcional" />
                    </Field>
                    <button type="submit" style={styles.secondaryButton} disabled={procesando || !componente}>
                      <Plus size={17} /> Agregar componente
                    </button>
                  </form>
                </section>

                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>Trabajo y otros costos</h3>
                  <form onSubmit={agregarCosto} style={styles.formGrid}>
                    <Field label="Tipo">
                      <select style={styles.input} value={formCosto.tipo} onChange={(event) => setFormCosto((actual) => ({ ...actual, tipo: event.target.value }))}>
                        {TIPOS_COSTO.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </Field>
                    <Field label="Descripción">
                      <input style={styles.input} value={formCosto.descripcion} onChange={(event) => setFormCosto((actual) => ({ ...actual, descripcion: event.target.value }))} required minLength={2} />
                    </Field>
                    <Field label="Cantidad">
                      <input style={styles.input} type="number" min="0.001" step="0.001" value={formCosto.cantidad} onChange={(event) => setFormCosto((actual) => ({ ...actual, cantidad: event.target.value }))} required />
                    </Field>
                    <Field label="Costo unitario">
                      <input style={styles.input} type="number" min="0" step="0.01" value={formCosto.costo_unitario} onChange={(event) => setFormCosto((actual) => ({ ...actual, costo_unitario: event.target.value }))} required />
                    </Field>
                    <button type="submit" style={styles.secondaryButton} disabled={procesando}>
                      <Plus size={17} /> Agregar costo
                    </button>
                  </form>
                </section>


                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>Recuperos</h3>
                  <p style={styles.help}>Notas de crédito, garantías u otros importes que reducen el costo de esta unidad.</p>
                  <form onSubmit={agregarRecupero} style={styles.formGrid}>
                    <Field label="Tipo">
                      <select style={styles.input} value={formRecupero.tipo} onChange={(event) => setFormRecupero((actual) => ({ ...actual, tipo: event.target.value }))}>
                        {TIPOS_RECUPERO.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </Field>
                    <Field label="Descripción">
                      <input style={styles.input} value={formRecupero.descripcion} onChange={(event) => setFormRecupero((actual) => ({ ...actual, descripcion: event.target.value }))} required minLength={2} placeholder="Ej: garantía por cubiertas" />
                    </Field>
                    <Field label="Monto">
                      <input style={styles.input} type="number" min="0.01" step="0.01" value={formRecupero.monto} onChange={(event) => setFormRecupero((actual) => ({ ...actual, monto: event.target.value }))} required />
                    </Field>
                    <Field label="Referencia">
                      <input style={styles.input} value={formRecupero.referencia} onChange={(event) => setFormRecupero((actual) => ({ ...actual, referencia: event.target.value }))} placeholder="NC, garantía, proveedor..." />
                    </Field>
                    <button type="submit" style={styles.secondaryButton} disabled={procesando}>
                      <Plus size={17} /> Agregar recupero
                    </button>
                  </form>
                </section>
              </>
            )}

            <DetalleComponentes
              orden={orden}
              editable={editable}
              procesando={procesando}
              onQuitar={(itemId) => ejecutar(() => quitarItemAcondicionamiento(orden.id, itemId, usuarioId), "Componente quitado.")}
              onResolver={(itemId, data) => ejecutar(() => resolverPiezaRetiradaAcondicionamiento(orden.id, itemId, { ...data, id_usuario: usuarioId }), "Destino de la pieza actualizado.")}
            />
            <DetalleCostos orden={orden} editable={editable} procesando={procesando} onQuitar={(costoId) => ejecutar(() => quitarCostoAcondicionamiento(orden.id, costoId, usuarioId), "Costo quitado.")} />
            <DetalleRecuperos orden={orden} editable={editable} procesando={procesando} onQuitar={(recuperoId) => ejecutar(() => quitarRecuperoAcondicionamiento(orden.id, recuperoId, usuarioId), "Recupero quitado.")} />

            {orden.advertencias?.length > 0 && (
              <div style={styles.error}>
                {orden.advertencias.map((item) => <div key={item}>{item}</div>)}
              </div>
            )}

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Historial</h3>
              <div style={styles.timeline}>
                {orden.historial.map((evento) => (
                  <div key={evento.id} style={styles.timelineRow}>
                    <span>{new Date(evento.fecha).toLocaleString("es-AR")}</span>
                    <strong>{evento.detalle}</strong>
                    <span>{evento.usuario_nombre || "Sistema"}</span>
                  </div>
                ))}
              </div>
            </section>

            {mostrarReversion && (
              <form onSubmit={revertir} style={styles.reversionBand}>
                <Field label="Motivo de la reversión">
                  <input
                    style={styles.input}
                    value={motivoReversion}
                    onChange={(event) => setMotivoReversion(event.target.value)}
                    placeholder="Explicá por qué se cancela este plan"
                    minLength={3}
                    required
                    autoFocus
                  />
                </Field>
                <button type="button" style={styles.historyButton} onClick={() => setMostrarReversion(false)}>
                  Volver
                </button>
                <button type="submit" style={styles.dangerButton} disabled={procesando || motivoReversion.trim().length < 3}>
                  <RotateCcw size={17} /> Confirmar reversión
                </button>
              </form>
            )}


            {mostrarAplicacion && (
              <div style={styles.applyBand}>
                <AlertTriangle size={20} />
                <div style={styles.itemMain}>
                  <strong>Aplicar el trabajo terminado</strong>
                  <span>Se descontarán los repuestos, se congelarán sus costos y la bicicleta quedará lista para vender.</span>
                </div>
                <div style={styles.priceUpdatePanel}>
                  <label style={styles.priceUpdateToggle}>
                    <input
                      type="checkbox"
                      checked={actualizarPrecioVenta}
                      onChange={(event) => setActualizarPrecioVenta(event.target.checked)}
                    />
                    <span>
                      <strong>Actualizar el precio de venta de este cuadro</strong>
                      <small>La sugerencia conserva aproximadamente el margen que tenía antes del trabajo.</small>
                    </span>
                  </label>
                  <div style={styles.pricePreviewGrid}>
                    <Metric label="Precio actual" value={formatMoney(orden.precio_venta_actual || bici.precio_venta_actual)} />
                    <Metric label="Costo nuevo estimado" value={formatMoney(Number(bici.costo_total_unitario || 0) + Number(orden.total_estimado || 0))} />
                    <Field label="Nuevo precio de lista">
                      <input
                        style={styles.input}
                        type="number"
                        min={Number(bici.costo_total_unitario || 0) + Number(orden.total_estimado || 0)}
                        step="1"
                        value={precioVentaNuevo}
                        onChange={(event) => setPrecioVentaNuevo(event.target.value)}
                        disabled={!actualizarPrecioVenta}
                      />
                    </Field>
                  </div>
                  <small style={styles.help}>Solo cambia esta bicicleta ({bici.numero_cuadro}); las demás unidades del modelo conservan su precio.</small>
                </div>
                <button type="button" style={styles.historyButton} onClick={() => setMostrarAplicacion(false)}>Volver</button>
                <button type="button" style={styles.primaryButton} onClick={aplicar} disabled={procesando || !orden.puede_aplicar || (actualizarPrecioVenta && Number(precioVentaNuevo) <= 0)}>
                  <CheckCircle2 size={18} /> Aplicar ahora
                </button>
              </div>
            )}

            <footer style={styles.footer}>
              {ordenes.length > 1 && <HistorialOrdenes ordenes={ordenes} onSelect={setOrden} compact />}
              <div style={styles.footerActions}>
                {(["borrador", "confirmado", "aplicado"].includes(orden.estado)) && (
                  <button type="button" style={styles.dangerButton} onClick={() => setMostrarReversion(true)} disabled={procesando || mostrarReversion}>
                    <RotateCcw size={17} /> Revertir orden
                  </button>
                )}
                {editable && (
                  <button type="button" style={styles.primaryButton} onClick={confirmar} disabled={procesando || !orden.puede_confirmar}>
                    <CheckCircle2 size={18} /> Confirmar plan
                  </button>
                )}
                {orden.estado === "confirmado" && (
                  <button type="button" style={styles.primaryButton} onClick={abrirAplicacion} disabled={procesando || !orden.puede_aplicar || mostrarAplicacion}>
                    <CheckCircle2 size={18} /> Aplicar trabajo terminado
                  </button>
                )}
              </div>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span>{children}</label>;
}

function Metric({ label, value, emphasis }) {
  return <div style={{ ...styles.metric, ...(emphasis ? styles.metricEmphasis : {}) }}><span>{label}</span><strong>{value}</strong></div>;
}

function DetalleComponentes({ orden, editable, procesando, onQuitar, onResolver }) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>Repuestos previstos ({orden.items.length})</h3>
      {orden.items.length === 0 ? <p style={styles.help}>Todavía no se agregaron componentes.</p> : (
        <div style={styles.rows}>
          {orden.items.map((item) => (
            <div key={item.id} style={styles.itemRow}>
              <div style={styles.itemMain}>
                <strong>{item.producto_nombre_snapshot} {item.variante_nombre_snapshot}</strong>
                <span>{labelOf(TIPOS_INTERVENCION, item.tipo_intervencion)} · {Number(item.cantidad)} unidad(es) · {item.sku_snapshot || "Sin SKU"}</span>
                {item.detalle_pieza_retirada && <small>Se retira: {item.detalle_pieza_retirada}</small>}
                {item.destino_pieza_retirada && (
                  <small>
                    Destino: {labelOf(DESTINOS_PIEZA_RETIRADA, item.destino_pieza_retirada)} · Estado: {labelOf(ESTADOS_PIEZA_RETIRADA[item.destino_pieza_retirada] || [], item.estado_pieza_retirada)}
                  </small>
                )}
                {item.resolucion_pieza_retirada && <small>Detalle registrado: {item.resolucion_pieza_retirada}</small>}
                {item.id_movimiento_consumo && <small>Movimiento de stock #{item.id_movimiento_consumo} · costo unitario congelado {formatMoney(item.costo_unitario_real)}</small>}
                {item.id_movimiento_reversion && <small>Consumo revertido por movimiento #{item.id_movimiento_reversion}</small>}
              </div>
              {orden.estado !== "aplicado" && orden.estado !== "revertido" && (
                <div style={item.disponibilidad_suficiente ? styles.stockOk : styles.stockBad}>
                  Disponible {Number(item.stock_disponible_actual)}
                </div>
              )}
              <strong>{formatMoney(item.subtotal_real ?? item.subtotal_estimado)}</strong>
              {orden.estado === "aplicado" && item.destino_pieza_retirada && (
                <PiezaRetiradaControl item={item} procesando={procesando} onResolver={onResolver} />
              )}
              {editable && <button type="button" style={styles.deleteButton} onClick={() => onQuitar(item.id)} disabled={procesando} title="Quitar componente"><Trash2 size={17} /></button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PiezaRetiradaControl({ item, procesando, onResolver }) {
  const opciones = ESTADOS_PIEZA_RETIRADA[item.destino_pieza_retirada] || [];
  const [estado, setEstado] = useState(item.estado_pieza_retirada || opciones[0]?.[0] || "");
  const [resolucion, setResolucion] = useState(item.resolucion_pieza_retirada || "");
  const requiereDetalle = ["compensada", "recuperada", "descartada"].includes(estado);
  const sinCambios = estado === item.estado_pieza_retirada && resolucion.trim() === (item.resolucion_pieza_retirada || "");
  const copy = textoSeguimientoPieza(item.destino_pieza_retirada, estado);

  return (
    <div style={styles.withdrawnControl}>
      <label style={styles.withdrawnField}>
        <span style={styles.label}>¿Qué pasó con la pieza retirada?</span>
        <select style={styles.input} value={estado} onChange={(event) => setEstado(event.target.value)}>
          {opciones.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label style={styles.withdrawnFieldWide}>
        <span style={styles.label}>{copy.label}</span>
        <input style={styles.input} value={resolucion} onChange={(event) => setResolucion(event.target.value)} placeholder={copy.placeholder} />
        <small style={styles.muted}>{copy.help}</small>
      </label>
      <button
        type="button"
        style={styles.historyButton}
        disabled={procesando || sinCambios || (requiereDetalle && resolucion.trim().length < 3)}
        onClick={() => onResolver(item.id, { estado, resolucion: resolucion.trim() || null })}
      >
        Guardar destino
      </button>
    </div>
  );
}

function DetalleCostos({ orden, editable, procesando, onQuitar }) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>Costos adicionales ({orden.costos.length})</h3>
      {orden.costos.length === 0 ? <p style={styles.help}>Sin mano de obra ni costos adicionales cargados.</p> : (
        <div style={styles.rows}>
          {orden.costos.map((costo) => (
            <div key={costo.id} style={styles.itemRow}>
              <div style={styles.itemMain}>
                <strong>{costo.descripcion}</strong>
                <span>{labelOf(TIPOS_COSTO, costo.tipo)} · {Number(costo.cantidad)} x {formatMoney(costo.costo_unitario)}</span>
              </div>
              <strong>{formatMoney(costo.total_real ?? costo.total)}</strong>
              {editable && <button type="button" style={styles.deleteButton} onClick={() => onQuitar(costo.id)} disabled={procesando} title="Quitar costo"><Trash2 size={17} /></button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DetalleRecuperos({ orden, editable, procesando, onQuitar }) {
  if (!orden.recuperos?.length) return null;
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>Recuperos aplicados ({orden.recuperos.length})</h3>
      <div style={styles.rows}>
        {orden.recuperos.map((recupero) => (
          <div key={recupero.id} style={styles.itemRow}>
            <div style={styles.itemMain}>
              <strong>{recupero.descripcion}</strong>
              <span>{labelOf(TIPOS_RECUPERO, recupero.tipo)}{recupero.referencia ? ` · ${recupero.referencia}` : ""}</span>
            </div>
            <strong style={styles.recoveryAmount}>- {formatMoney(recupero.monto)}</strong>
            {editable && <button type="button" style={styles.deleteButton} onClick={() => onQuitar(recupero.id)} disabled={procesando} title="Quitar recupero"><Trash2 size={17} /></button>}
          </div>
        ))}
      </div>
    </section>
  );
}

function HistorialOrdenes({ ordenes, onSelect, compact = false }) {
  return (
    <div style={compact ? styles.historyCompact : styles.section}>
      {!compact && <h3 style={styles.sectionTitle}>Órdenes anteriores</h3>}
      <div style={styles.historyButtons}>
        {ordenes.map((item) => (
          <button key={item.id} type="button" style={styles.historyButton} onClick={() => onSelect(item)}>
            {item.codigo} · {estadoLabel(item.estado)}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,23,42,.58)", display: "grid", placeItems: "center", padding: 16 },
  modal: { width: "min(1180px, 100%)", maxHeight: "94vh", overflow: "auto", background: "#fff", borderRadius: 8, boxShadow: "0 24px 70px rgba(15,23,42,.28)" },
  header: { position: "sticky", top: 0, zIndex: 4, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", padding: "18px 22px", borderBottom: "1px solid #dbe3ef", background: "#fff" },
  kicker: { display: "block", color: "#ea580c", fontSize: 12, fontWeight: 900 },
  title: { margin: "3px 0", fontSize: 25 },
  subtitle: { margin: 0, color: "#64748b" },
  iconButton: { width: 40, height: 40, display: "grid", placeItems: "center", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: "pointer" },
  content: { padding: 20, display: "grid", gap: 16 },
  empty: { padding: 48, textAlign: "center", color: "#64748b" },
  error: { margin: "14px 20px 0", padding: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 7, fontWeight: 700 },
  success: { margin: "14px 20px 0", padding: 12, border: "1px solid #86efac", background: "#ecfdf5", color: "#047857", borderRadius: 7, fontWeight: 700 },
  notice: { display: "flex", gap: 9, alignItems: "center", padding: 12, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", borderRadius: 7, fontWeight: 700 },
  appliedNotice: { display: "flex", gap: 9, alignItems: "center", padding: 12, border: "1px solid #86efac", background: "#ecfdf5", color: "#047857", borderRadius: 7, fontWeight: 700 },
  summaryBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "stretch", paddingBottom: 16, borderBottom: "1px solid #dbe3ef" },
  summaryTitle: { display: "block", marginTop: 5 },
  badge: { alignSelf: "center", padding: "7px 10px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontWeight: 900, whiteSpace: "nowrap" },
  badgeConfirmed: { background: "#dcfce7", color: "#047857" },
  metric: { padding: 10, border: "1px solid #dbe3ef", borderRadius: 7, display: "grid", gap: 4, background: "#f8fafc" },
  metricEmphasis: { borderColor: "#86efac", background: "#ecfdf5", color: "#047857" },
  formBand: { display: "grid", gap: 12, maxWidth: 760, margin: "20px auto", width: "100%" },
  section: { padding: "15px 0", borderBottom: "1px solid #dbe3ef" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: 12 },
  sectionTitle: { margin: "0 0 4px", fontSize: 17 },
  help: { margin: 0, color: "#64748b", fontSize: 13 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, alignItems: "end", marginTop: 12 },
  field: { display: "grid", gap: 5 },
  label: { fontSize: 12, fontWeight: 800, color: "#334155" },
  input: { minWidth: 0, width: "100%", boxSizing: "border-box", padding: "10px 11px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" },
  textarea: { width: "100%", boxSizing: "border-box", minHeight: 76, padding: 11, border: "1px solid #cbd5e1", borderRadius: 7, resize: "vertical" },
  searchArea: { position: "relative", display: "grid", gap: 7, gridColumn: "1 / -1" },
  searchInputWrap: { display: "flex", alignItems: "center", padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" },
  searchInput: { width: "100%", padding: "11px 0", border: 0, outline: 0, fontSize: 15 },
  results: { position: "absolute", zIndex: 7, top: "100%", left: 0, right: 0, maxHeight: 340, overflowY: "auto", overflowX: "hidden", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 7, boxShadow: "0 14px 34px rgba(15,23,42,.18)" },
  resultButton: { width: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 16, padding: "11px 13px", border: 0, borderBottom: "1px solid #e2e8f0", background: "#fff", textAlign: "left", cursor: "pointer" },
  resultMain: { minWidth: 0, display: "grid", gap: 4 },
  resultName: { color: "#0f172a", fontSize: 14, lineHeight: 1.3, overflowWrap: "anywhere" },
  resultMeta: { color: "#64748b", fontSize: 12, lineHeight: 1.3, overflowWrap: "anywhere" },
  stockColumn: { minWidth: 74, display: "grid", justifyItems: "end", gap: 2, color: "#64748b", whiteSpace: "nowrap" },
  selectedComponent: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 14, padding: "10px 12px", border: "1px solid #86efac", borderRadius: 7, background: "#ecfdf5" },
  selectedEyebrow: { color: "#047857", fontSize: 11, fontWeight: 900, textTransform: "uppercase" },
  selectedActions: { display: "grid", justifyItems: "end", gap: 5, whiteSpace: "nowrap" },
  changeComponentButton: { border: 0, background: "transparent", color: "#1d4ed8", padding: 0, fontWeight: 800, cursor: "pointer" },
  muted: { color: "#64748b" },
  stockOk: { color: "#047857", fontWeight: 800, whiteSpace: "nowrap" },
  stockBad: { color: "#b91c1c", fontWeight: 800, whiteSpace: "nowrap" },
  recoveryAmount: { color: "#047857" },
  primaryButton: { minHeight: 42, padding: "0 16px", border: 0, borderRadius: 7, background: "#0f172a", color: "#fff", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  secondaryButton: { minHeight: 42, padding: "0 14px", border: "1px solid #f97316", borderRadius: 7, background: "#fff7ed", color: "#c2410c", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" },
  dangerButton: { minHeight: 42, padding: "0 14px", border: "1px solid #fecaca", borderRadius: 7, background: "#fff1f2", color: "#b91c1c", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" },
  deleteButton: { width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid #fecaca", borderRadius: 7, background: "#fff", color: "#dc2626", cursor: "pointer" },
  rows: { display: "grid", marginTop: 10 },
  itemRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "11px 0", borderTop: "1px solid #eef2f7" },
  itemMain: { flex: 1, minWidth: 0, display: "grid", gap: 3 },
  withdrawnControl: { flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", padding: "11px 0 2px 14px", borderLeft: "3px solid #f97316" },
  withdrawnField: { flex: "1 1 210px", display: "grid", gap: 5 },
  withdrawnFieldWide: { flex: "3 1 340px", minWidth: 0, display: "grid", gap: 5 },
  timeline: { display: "grid", marginTop: 8 },
  timelineRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, padding: "9px 0", borderTop: "1px solid #eef2f7", fontSize: 13 },
  footer: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "center" },
  reversionBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end", padding: 14, border: "1px solid #fecaca", borderRadius: 7, background: "#fff7f7" },
  applyBand: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: 14, border: "1px solid #fdba74", borderRadius: 7, background: "#fff7ed", color: "#9a3412" },
  priceUpdatePanel: { flexBasis: "100%", display: "grid", gap: 10, padding: 12, border: "1px solid #fed7aa", borderRadius: 7, background: "#fff" },
  priceUpdateToggle: { display: "flex", alignItems: "flex-start", gap: 9, color: "#0f172a", cursor: "pointer" },
  pricePreviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 9, alignItems: "end" },
  footerActions: { marginLeft: "auto", display: "flex", gap: 10 },
  historyCompact: { minWidth: 0 },
  historyButtons: { display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 },
  historyButton: { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", cursor: "pointer" },
};
