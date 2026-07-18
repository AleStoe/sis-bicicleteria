import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw, Replace, Save } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { colors, radius, shadows, spacing } from "../theme";
import { formatMoney, formatNumber, formatPercent } from "../utils/formatters";
import {
  agregarCostoOrdenArmado,
  actualizarControlFinalOrdenArmado,
  actualizarCostoFinalOrdenArmado,
  cambiarEstadoOrdenArmado,
  cancelarOrdenArmado,
  editarOrdenArmado,
  finalizarOrdenArmado,
  iniciarOrdenArmado,
  obtenerOrdenArmado,
  recalcularDisponibilidadOrdenArmado,
  pasarOrdenArmadoAControlFinal,
  sustituirItemOrdenArmado,
  volverOrdenArmadoAEnArmado,
} from "../services/armadoService";

const ESTADOS = [
  ["borrador", "Borrador"],
  ["pendiente_componentes", "Pendiente componentes"],
  ["lista_para_armar", "Lista para armar"],
  ["cancelada", "Cancelada"],
];

const LABELS_CONTROLES = {
  direccion_ajustada: "Dirección ajustada",
  frenos_ajustados: "Frenos ajustados",
  transmision_regulada: "Transmisión regulada",
  ruedas_revisadas: "Ruedas revisadas",
  torque_general_verificado: "Torque general verificado",
  presion_cubiertas_verificada: "Presión de cubiertas verificada",
  prueba_funcional_realizada: "Prueba funcional realizada",
  limpieza_final_realizada: "Limpieza final realizada",
  numero_cuadro_verificado: "Número de cuadro verificado",
};

export default function ArmadoOrdenDetallePage() {
  const { ordenId } = useParams();
  const [orden, setOrden] = useState(null);
  const [form, setForm] = useState({});
  const [costoForm, setCostoForm] = useState({
    tipo: "mano_obra",
    descripcion: "",
    cantidad: "1",
    costo_unitario: "",
  });
  const [sustitucion, setSustitucion] = useState({ itemId: "", id_variante_utilizada: "", cantidad_utilizada: "", motivo_sustitucion: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const data = await obtenerOrdenArmado(ordenId);
      setOrden(data);
      setForm({
        talle: data.talle || "",
        color: data.color || "",
        numero_cuadro: data.numero_cuadro || "",
        descripcion_final: data.descripcion_final || "",
        precio_objetivo: data.precio_objetivo || "",
        margen_objetivo: data.margen_objetivo || "",
        observaciones: data.observaciones || "",
      });
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [ordenId]);

  async function guardarDatos(event) {
    event.preventDefault();
    try {
      const data = await editarOrdenArmado(ordenId, {
        ...form,
        precio_objetivo: form.precio_objetivo || null,
        margen_objetivo: form.margen_objetivo || null,
      });
      setOrden(data);
      setError("");
    } catch (err) {
      setError(err.message || "No se pudieron guardar los datos");
    }
  }

  async function agregarCosto(event) {
    event.preventDefault();
    try {
      const data = await agregarCostoOrdenArmado(ordenId, costoForm);
      setOrden(data);
      setCostoForm({ tipo: "mano_obra", descripcion: "", cantidad: "1", costo_unitario: "" });
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo agregar el costo");
    }
  }

  async function aplicarSustitucion(event) {
    event.preventDefault();
    if (!sustitucion.itemId) return;
    try {
      const data = await sustituirItemOrdenArmado(ordenId, sustitucion.itemId, {
        id_variante_utilizada: Number(sustitucion.id_variante_utilizada),
        cantidad_utilizada: sustitucion.cantidad_utilizada,
        motivo_sustitucion: sustitucion.motivo_sustitucion,
      });
      setOrden(data);
      setSustitucion({ itemId: "", id_variante_utilizada: "", cantidad_utilizada: "", motivo_sustitucion: "" });
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo sustituir el componente");
    }
  }

  async function cambiarEstado(estado) {
    try {
      const data = await cambiarEstadoOrdenArmado(ordenId, { estado });
      setOrden(data);
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    }
  }

  async function recalcular() {
    try {
      setOrden(await recalcularDisponibilidadOrdenArmado(ordenId));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo recalcular disponibilidad");
    }
  }

  async function iniciarArmado() {
    const confirmar = window.confirm(
      "Al iniciar se descontaran todos los componentes del stock.\n\nEsta operacion no permite sustituciones posteriores."
    );
    if (!confirmar) return;
    setAccionLoading(true);
    try {
      setOrden(await iniciarOrdenArmado(ordenId));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo iniciar el armado");
    } finally {
      setAccionLoading(false);
    }
  }

  async function cancelarArmado() {
    const motivo = window.prompt("Motivo de cancelacion");
    if (!motivo) return;
    const confirmar = window.confirm(
      "Se cancelara la orden. Si ya esta en armado, se devolveran los componentes al stock con contramovimientos."
    );
    if (!confirmar) return;
    setAccionLoading(true);
    try {
      setOrden(await cancelarOrdenArmado(ordenId, { motivo_cancelacion: motivo }));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo cancelar la orden");
    } finally {
      setAccionLoading(false);
    }
  }

  async function pasarAControlFinal() {
    setAccionLoading(true);
    try {
      setOrden(await pasarOrdenArmadoAControlFinal(ordenId));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo pasar a control final");
    } finally {
      setAccionLoading(false);
    }
  }

  async function volverAArmado() {
    const motivo = window.prompt("Motivo para volver a armado");
    if (!motivo) return;
    setAccionLoading(true);
    try {
      setOrden(await volverOrdenArmadoAEnArmado(ordenId, { motivo }));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo volver a armado");
    } finally {
      setAccionLoading(false);
    }
  }

  async function actualizarControl(control, aprobado) {
    try {
      setOrden(await actualizarControlFinalOrdenArmado(ordenId, {
        codigo_control: control.codigo_control,
        aprobado,
        observaciones: control.observaciones || "",
      }));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo actualizar el control");
    }
  }

  async function actualizarObservacionControl(control, observaciones) {
    try {
      setOrden(await actualizarControlFinalOrdenArmado(ordenId, {
        codigo_control: control.codigo_control,
        aprobado: control.aprobado,
        observaciones,
      }));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la observacion");
    }
  }

  async function actualizarCostoFinal(costo) {
    const valor = window.prompt("Costo unitario final", costo.costo_unitario_final ?? costo.costo_unitario);
    if (valor === null) return;
    try {
      setOrden(await actualizarCostoFinalOrdenArmado(ordenId, costo.id, { costo_unitario_final: valor }));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo actualizar el costo final");
    }
  }

  async function finalizarArmado() {
    const confirmar = window.confirm("Se creara la bicicleta serializada disponible y la orden quedara terminada. ¿Confirmas?");
    if (!confirmar) return;
    setAccionLoading(true);
    try {
      setOrden(await finalizarOrdenArmado(ordenId));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo finalizar la orden");
    } finally {
      setAccionLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={orden ? `${orden.codigo} · ${orden.modelo_nombre}` : "Orden de armado"}
        subtitle={orden ? `${orden.version_nombre} · Rev. ${orden.configuracion_revision} · ${labelEstado(orden.estado)}` : "Detalle de fabricacion"}
        actions={
          <>
            <Link to="/armado/ordenes" style={styles.softLink}>Volver a ordenes</Link>
            <Button variant="outline" onClick={cargar}>
              <RefreshCw size={16} /> Refrescar
            </Button>
          </>
        }
      />

      {error ? <div style={styles.error}>{error}</div> : null}
      {loading ? <div style={styles.empty}>Cargando orden...</div> : null}

      {orden ? (
        <>
          <section style={styles.metrics}>
            <Metric title="Estado" value={labelEstado(orden.estado)} tone={orden.estado === "lista_para_armar" ? "success" : "info"} />
            <Metric title="Costo componentes" value={formatMoney(orden.costo_componentes_previsto)} />
            <Metric title="Costos adicionales" value={formatMoney(orden.costo_adicional_previsto)} />
            <Metric title="Costo total" value={formatMoney(orden.costo_total_previsto)} />
            <Metric title="Costo real" value={formatMoney(orden.costo_total_real || 0)} tone={orden.estado === "en_armado" || orden.estado === "cancelada" ? "info" : "neutral"} />
            <Metric title="Desvio comp." value={formatMoney(orden.desvio_componentes || 0)} tone={Number(orden.desvio_componentes || 0) ? "warning" : "neutral"} />
            <Metric title="Costo final" value={formatMoney(orden.costo_fabricacion_final || 0)} tone={orden.estado === "terminada" ? "success" : "neutral"} />
            <Metric title="Desvio total" value={formatMoney(orden.desvio_total || 0)} tone={Number(orden.desvio_total || 0) ? "warning" : "neutral"} />
            <Metric title="Utilidad prevista" value={orden.utilidad_prevista !== null ? formatMoney(orden.utilidad_prevista) : "-"} />
            <Metric title="Margen previsto" value={orden.margen_previsto !== null ? formatPercent(orden.margen_previsto) : "-"} />
            <Metric title="Fabricables" value={orden.cantidad_fabricable ?? "-"} tone={orden.advertencias?.length ? "warning" : "success"} />
          </section>

          <section style={styles.layout}>
            <div style={{ display: "grid", gap: spacing.lg }}>
              <form onSubmit={guardarDatos} style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <div style={styles.eyebrow}>Bicicleta final</div>
                    <h2 style={styles.title}>Datos del armado</h2>
                  </div>
                  <button type="submit" style={styles.primaryButton}>
                    <Save size={16} /> Guardar
                  </button>
                </div>
                <div style={styles.formGrid}>
                  <Input label="Talle" value={form.talle} onChange={(value) => setForm((prev) => ({ ...prev, talle: value }))} />
                  <Input label="Color" value={form.color} onChange={(value) => setForm((prev) => ({ ...prev, color: value }))} />
                  <Input label="Numero de cuadro" value={form.numero_cuadro} onChange={(value) => setForm((prev) => ({ ...prev, numero_cuadro: value }))} />
                  <Input label="Precio objetivo" value={form.precio_objetivo} onChange={(value) => setForm((prev) => ({ ...prev, precio_objetivo: value }))} />
                  <Input label="Margen objetivo %" value={form.margen_objetivo} onChange={(value) => setForm((prev) => ({ ...prev, margen_objetivo: value }))} />
                </div>
                <label style={styles.label}>
                  Descripcion final
                  <textarea value={form.descripcion_final} onChange={(event) => setForm((prev) => ({ ...prev, descripcion_final: event.target.value }))} style={{ ...styles.input, minHeight: 80 }} />
                </label>
                <label style={styles.label}>
                  Observaciones
                  <textarea value={form.observaciones} onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))} style={{ ...styles.input, minHeight: 70 }} />
                </label>
              </form>

              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <div style={styles.eyebrow}>Componentes</div>
                    <h2 style={styles.title}>Snapshot de la orden</h2>
                  </div>
                  <button type="button" style={styles.softButton} onClick={recalcular}>
                    <RefreshCw size={16} /> Recalcular disponibilidad
                  </button>
                </div>
                <div style={styles.table}>
                  <div style={styles.tableHeader}>
                    <span>Previsto</span>
                    <span>Utilizado</span>
                    <span>Cantidad</span>
                    <span>Costo</span>
                    <span>Stock</span>
                    <span>Estado</span>
                  </div>
                  {orden.items.map((item) => (
                    <div key={item.id} style={styles.row}>
                      <div>
                        <strong>{item.producto_previsto_nombre}</strong>
                        <small>{item.variante_prevista_nombre}</small>
                      </div>
                      <div>
                        <strong>{item.producto_utilizado_nombre}</strong>
                        <small>{item.es_sustitucion ? "Sustitucion" : "Original"}</small>
                      </div>
                      <span>{formatNumber(item.cantidad_utilizada)}</span>
                      <span>{item.subtotal_previsto !== null ? formatMoney(item.subtotal_previsto) : "Falta costo"}</span>
                      <span>{item.stock_disponible !== null && item.stock_disponible !== undefined ? formatNumber(item.stock_disponible) : "-"}</span>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={badgeItem(item)}>{labelItem(item.estado)}</span>
                        {item.estado === "consumido" || item.estado === "revertido" ? (
                          <small style={{ color: colors.textMuted }}>
                            Real {item.subtotal_real !== null ? formatMoney(item.subtotal_real) : "-"}
                            {item.id_movimiento_consumo ? ` · Mov. #${item.id_movimiento_consumo}` : ""}
                            {item.id_movimiento_reversion ? ` · Rev. #${item.id_movimiento_reversion}` : ""}
                          </small>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside style={{ display: "grid", gap: spacing.lg }}>
              <section style={styles.panel}>
                <div style={styles.eyebrow}>Estado</div>
                <h2 style={styles.title}>Avance de orden</h2>
                {orden.estado === "lista_para_armar" ? (
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={iniciarArmado}
                    disabled={accionLoading}
                  >
                    Iniciar armado
                  </button>
                ) : null}
                {orden.estado === "en_armado" ? (
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={pasarAControlFinal}
                    disabled={accionLoading}
                  >
                    Pasar a control final
                  </button>
                ) : null}
                {orden.estado === "control_final" ? (
                  <>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={finalizarArmado}
                      disabled={accionLoading}
                    >
                      Finalizar y crear bicicleta
                    </button>
                    <button
                      type="button"
                      style={styles.softButton}
                      onClick={volverAArmado}
                      disabled={accionLoading}
                    >
                      Volver a armado
                    </button>
                  </>
                ) : null}
                {orden.estado === "en_armado" ? (
                  <button
                    type="button"
                    style={styles.dangerButton}
                    onClick={cancelarArmado}
                    disabled={accionLoading}
                  >
                    Cancelar y devolver componentes
                  </button>
                ) : null}
                {orden.estado === "terminada" ? (
                  <div style={styles.infoBox}>
                    <strong>Bicicleta creada:</strong> #{orden.id_bicicleta_serializada_resultante}
                    <br />
                    <strong>Costo fabricacion:</strong> {formatMoney(orden.costo_fabricacion_final || 0)}
                    <br />
                    <strong>Fecha:</strong> {orden.fecha_finalizacion ? new Date(orden.fecha_finalizacion).toLocaleString() : "-"}
                  </div>
                ) : null}
                <div style={styles.stateButtons}>
                  {ESTADOS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => cambiarEstado(value)}
                      disabled={orden.estado === value}
                      style={orden.estado === value ? styles.stateActive : styles.stateButton}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {orden.fecha_inicio ? (
                  <div style={styles.infoBox}>
                    <strong>Inicio:</strong> {new Date(orden.fecha_inicio).toLocaleString()}
                    <br />
                    <strong>Componentes reales:</strong> {formatMoney(orden.costo_componentes_real || 0)}
                    <br />
                    <strong>Desvio:</strong> {formatMoney(orden.desvio_componentes || 0)}
                  </div>
                ) : null}
                {orden.advertencias?.length ? (
                  <div style={styles.warningBox}>
                    {orden.advertencias.map((advertencia) => (
                      <div key={advertencia}>{advertencia}</div>
                    ))}
                  </div>
                ) : null}
              </section>

              <form onSubmit={agregarCosto} style={styles.panel}>
                <div style={styles.eyebrow}>Costos adicionales</div>
                <h2 style={styles.title}>Mano de obra y extras</h2>
                <label style={styles.label}>
                  Tipo
                  <select value={costoForm.tipo} onChange={(event) => setCostoForm((prev) => ({ ...prev, tipo: event.target.value }))} style={styles.input}>
                    <option value="mano_obra">Mano de obra</option>
                    <option value="consumible_no_inventariado">Consumible no inventariado</option>
                    <option value="trabajo_externo">Trabajo externo</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <Input label="Descripcion" value={costoForm.descripcion} onChange={(value) => setCostoForm((prev) => ({ ...prev, descripcion: value }))} />
                <Input label="Cantidad" value={costoForm.cantidad} onChange={(value) => setCostoForm((prev) => ({ ...prev, cantidad: value }))} />
                <Input label="Costo unitario" value={costoForm.costo_unitario} onChange={(value) => setCostoForm((prev) => ({ ...prev, costo_unitario: value }))} />
                <button type="submit" style={styles.primaryButton}>Agregar costo</button>
              </form>

              <form onSubmit={aplicarSustitucion} style={styles.panel}>
                <div style={styles.eyebrow}>Sustituciones</div>
                <h2 style={styles.title}>Cambiar componente</h2>
                <label style={styles.label}>
                  Item
                  <select value={sustitucion.itemId} onChange={(event) => setSustitucion((prev) => ({ ...prev, itemId: event.target.value }))} style={styles.input}>
                    <option value="">Seleccionar item</option>
                    {orden.items.map((item) => (
                      <option key={item.id} value={item.id}>{item.producto_previsto_nombre}</option>
                    ))}
                  </select>
                </label>
                <Input label="ID variante reemplazo" value={sustitucion.id_variante_utilizada} onChange={(value) => setSustitucion((prev) => ({ ...prev, id_variante_utilizada: value }))} />
                <Input label="Cantidad usada" value={sustitucion.cantidad_utilizada} onChange={(value) => setSustitucion((prev) => ({ ...prev, cantidad_utilizada: value }))} />
                <Input label="Motivo" value={sustitucion.motivo_sustitucion} onChange={(value) => setSustitucion((prev) => ({ ...prev, motivo_sustitucion: value }))} />
                <button type="submit" style={styles.softButton}>
                  <Replace size={16} /> Sustituir
                </button>
              </form>

              {orden.costos.length ? (
                <section style={styles.panel}>
                  <div style={styles.eyebrow}>Extras cargados</div>
                  {orden.costos.map((costo) => (
                    <div key={costo.id} style={styles.costRow}>
                      <div>
                        <strong>{costo.descripcion}</strong>
                        <small style={{ display: "block", color: colors.textMuted }}>
                          Previsto {formatMoney(costo.total)}
                          {costo.total_final !== null && costo.total_final !== undefined ? ` · Final ${formatMoney(costo.total_final)}` : ""}
                        </small>
                      </div>
                      {orden.estado === "en_armado" || orden.estado === "control_final" ? (
                        <button type="button" style={styles.softButton} onClick={() => actualizarCostoFinal(costo)}>
                          Ajustar final
                        </button>
                      ) : (
                        <span>{formatMoney(costo.total_final ?? costo.total)}</span>
                      )}
                    </div>
                  ))}
                </section>
              ) : null}

              {orden.estado === "control_final" || orden.estado === "terminada" ? (
                <section style={styles.panel}>
                  <div style={styles.eyebrow}>Control final</div>
                  <h2 style={styles.title}>Checklist de salida</h2>
                  <div style={{ display: "grid", gap: 10 }}>
                    {orden.controles.map((control) => (
                      <div key={control.codigo_control} style={styles.controlRow}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(control.aprobado)}
                            disabled={orden.estado === "terminada"}
                            onChange={(event) => actualizarControl(control, event.target.checked)}
                          />
                          {LABELS_CONTROLES[control.codigo_control] || control.codigo_control}
                        </label>
                        <input
                          value={control.observaciones || ""}
                          disabled={orden.estado === "terminada"}
                          onBlur={(event) => actualizarObservacionControl(control, event.target.value)}
                          onChange={(event) => {
                            const value = event.target.value;
                            setOrden((prev) => ({
                              ...prev,
                              controles: prev.controles.map((row) => (
                                row.codigo_control === control.codigo_control
                                  ? { ...row, observaciones: value }
                                  : row
                              )),
                            }));
                          }}
                          placeholder="Observacion"
                          style={styles.input}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label style={styles.label}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

function Metric({ title, value, tone = "neutral" }) {
  const palette = {
    neutral: [colors.surface, colors.border, colors.textStrong],
    success: [colors.successSoft, "#bbf7d0", colors.successDark],
    warning: [colors.warningSoft, "#fde68a", colors.warningDark],
    info: [colors.infoSoft, "#bfdbfe", colors.info],
  }[tone];
  return (
    <div style={{ ...styles.metric, background: palette[0], borderColor: palette[1], color: palette[2] }}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function labelEstado(estado) {
  return {
    borrador: "Borrador",
    pendiente_componentes: "Pendiente componentes",
    lista_para_armar: "Lista para armar",
    en_armado: "En armado",
    control_final: "Control final",
    terminada: "Terminada",
    cancelada: "Cancelada",
  }[estado] || estado;
}

function labelItem(estado) {
  return {
    disponible: "Disponible",
    faltante: "Faltante",
    sustituido: "Sustituido",
    consumido: "Consumido",
    revertido: "Revertido",
    omitido: "Omitido",
  }[estado] || estado;
}

function badgeItem(item) {
  const palette = item.estado === "disponible" || item.estado === "sustituido"
    ? [colors.successSoft, colors.successDark]
    : [colors.warningSoft, colors.warningDark];
  return { ...styles.badge, background: palette[0], color: palette[1] };
}

const styles = {
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: spacing.lg },
  metric: { border: "1px solid", borderRadius: radius.lg, padding: 14, display: "grid", gap: 7, boxShadow: shadows.sm },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: spacing.lg, alignItems: "start" },
  panel: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: spacing.lg },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 },
  eyebrow: { color: colors.primary, fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  title: { margin: "4px 0 14px", fontSize: 22, color: colors.textStrong },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 10 },
  label: { display: "grid", gap: 6, fontWeight: 800, color: colors.textStrong, marginBottom: 10 },
  input: { minHeight: 40, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 10px", fontWeight: 800, background: "#fff" },
  table: { display: "grid", border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, overflow: "hidden" },
  tableHeader: { display: "grid", gridTemplateColumns: "1.4fr 1.4fr .7fr .8fr .8fr .8fr", gap: 10, padding: "10px 12px", background: colors.surfaceMuted, fontSize: 12, fontWeight: 900, color: colors.textMuted, textTransform: "uppercase" },
  row: { display: "grid", gridTemplateColumns: "1.4fr 1.4fr .7fr .8fr .8fr .8fr", gap: 10, alignItems: "center", padding: 12, borderTop: `1px solid ${colors.borderSoft}` },
  badge: { display: "inline-flex", justifyContent: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  primaryButton: { minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 13px", borderRadius: radius.md, border: 0, background: colors.primary, color: "#fff", fontWeight: 900, cursor: "pointer" },
  dangerButton: { minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 13px", borderRadius: radius.md, border: 0, background: colors.danger, color: "#fff", fontWeight: 900, cursor: "pointer" },
  softButton: { minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 13px", borderRadius: radius.md, border: `1px solid ${colors.border}`, background: "#fff", color: colors.textStrong, fontWeight: 900, cursor: "pointer" },
  softLink: { minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 13px", borderRadius: radius.md, border: `1px solid ${colors.border}`, background: "#fff", color: colors.textStrong, textDecoration: "none", fontWeight: 900 },
  stateButtons: { display: "grid", gap: 8 },
  stateButton: { minHeight: 38, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: "#fff", fontWeight: 900, cursor: "pointer" },
  stateActive: { minHeight: 38, border: `1px solid ${colors.primary}`, borderRadius: radius.md, background: colors.primarySoft, color: colors.primaryHover, fontWeight: 900 },
  warningBox: { marginTop: 12, padding: 12, border: `1px solid ${colors.warning}`, borderRadius: radius.md, background: colors.warningSoft, color: colors.warningDark, display: "grid", gap: 4, fontWeight: 800 },
  infoBox: { marginTop: 12, padding: 12, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.infoSoft, color: colors.textStrong, fontWeight: 800, lineHeight: 1.5 },
  costRow: { display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.borderSoft}` },
  controlRow: { display: "grid", gridTemplateColumns: "minmax(180px, .8fr) minmax(160px, 1fr)", gap: 10, alignItems: "center", padding: 10, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md },
  error: { marginBottom: 14, padding: 12, borderRadius: radius.md, background: colors.dangerSoft, color: colors.dangerDark, fontWeight: 800 },
  empty: { padding: 18, background: colors.surfaceMuted, borderRadius: radius.md, color: colors.textMuted, fontWeight: 800 },
};
