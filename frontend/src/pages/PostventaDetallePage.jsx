import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Input, PageHeader, Select, Table } from "../components/ui";
import {
  actualizarCasoPostventa,
  cambiarEstadoCasoPostventa,
  cerrarCasoPostventa,
  crearOrdenTallerDesdeCasoPostventa,
  listarOrdenesTallerCasoPostventa,
  obtenerCasoPostventa,
  reabrirCasoPostventa,
  vincularOrdenTallerCasoPostventa,
} from "../services/postventaService";
import { formatDateTime, formatMoney } from "../utils/formatters";
import {
  labelPostventaEstado,
  labelPostventaPrioridad,
  labelPostventaTipo,
  POSTVENTA_TERMINALES,
  POSTVENTA_TRANSICIONES_UI,
  variantPostventaEstado,
} from "../utils/postventa";
import { colors, radius, spacing } from "../theme";

const OT_COLUMNS = [
  { key: "ot", label: "OT" },
  { key: "estado", label: "Estado" },
  { key: "problema", label: "Problema" },
  { key: "total", label: "Total" },
  { key: "acciones", label: "Acciones" },
];

const EVENT_COLUMNS = [
  { key: "fecha", label: "Fecha" },
  { key: "tipo", label: "Evento" },
  { key: "detalle", label: "Detalle" },
];

export default function PostventaDetallePage() {
  const { casoId } = useParams();
  const navigate = useNavigate();
  const [caso, setCaso] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editForm, setEditForm] = useState({});
  const [estadoForm, setEstadoForm] = useState({ nuevo_estado: "", motivo: "" });
  const [cierreForm, setCierreForm] = useState({ resultado_final: "", resolucion_aplicada: "", observaciones: "" });
  const [reaperturaForm, setReaperturaForm] = useState({ motivo: "" });
  const [otForm, setOtForm] = useState({ id_orden_taller: "", observaciones: "" });
  const [crearOtForm, setCrearOtForm] = useState({
    id_sucursal: "",
    fecha_prometida: "",
    prioridad: "normal",
    problema_reportado: "",
    observaciones_vinculo: "",
  });

  useEffect(() => {
    cargarTodo();
  }, [casoId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [casoData, ordenesData] = await Promise.all([
        obtenerCasoPostventa(casoId),
        listarOrdenesTallerCasoPostventa(casoId),
      ]);
      setCaso(casoData);
      setOrdenes(ordenesData || []);
      setEditForm(buildEditForm(casoData));
      setCrearOtForm((prev) => ({
        ...prev,
        problema_reportado: prev.problema_reportado || casoData.motivo_cliente || "",
      }));
      setEstadoForm({ nuevo_estado: "", motivo: "" });
    } catch (err) {
      setError(err.message || "No se pudo cargar el caso de postventa");
    } finally {
      setLoading(false);
    }
  }

  const bloqueado = caso ? POSTVENTA_TERMINALES.has(caso.estado) : true;
  const transiciones = useMemo(() => {
    if (!caso) return [];
    return POSTVENTA_TRANSICIONES_UI[caso.estado] || [];
  }, [caso?.estado]);
  const transicionesEstado = transiciones.filter((estado) => estado !== "cerrado");
  const puedeCerrar = transiciones.includes("cerrado");

  async function guardarCambios(event) {
    event.preventDefault();
    await ejecutar("Caso actualizado correctamente.", async () => {
      await actualizarCasoPostventa(casoId, normalizePayload(editForm));
      await cargarTodo();
    });
  }

  async function cambiarEstado(event) {
    event.preventDefault();
    if (!estadoForm.nuevo_estado) return;

    await ejecutar("Estado actualizado correctamente.", async () => {
      await cambiarEstadoCasoPostventa(casoId, {
        nuevo_estado: estadoForm.nuevo_estado,
        motivo: estadoForm.motivo.trim() || null,
      });
      await cargarTodo();
    });
  }

  async function cerrarCaso(event) {
    event.preventDefault();
    await ejecutar("Caso cerrado correctamente.", async () => {
      await cerrarCasoPostventa(casoId, normalizePayload(cierreForm));
      setCierreForm({ resultado_final: "", resolucion_aplicada: "", observaciones: "" });
      await cargarTodo();
    });
  }

  async function reabrirCaso(event) {
    event.preventDefault();
    await ejecutar("Caso reabierto correctamente.", async () => {
      await reabrirCasoPostventa(casoId, { motivo: reaperturaForm.motivo.trim() });
      setReaperturaForm({ motivo: "" });
      await cargarTodo();
    });
  }

  async function vincularOT(event) {
    event.preventDefault();
    await ejecutar("Orden de taller vinculada correctamente.", async () => {
      await vincularOrdenTallerCasoPostventa(casoId, {
        id_orden_taller: Number(otForm.id_orden_taller),
        observaciones: otForm.observaciones.trim() || null,
      });
      setOtForm({ id_orden_taller: "", observaciones: "" });
      await cargarTodo();
    });
  }

  async function crearOT(event) {
    event.preventDefault();
    await ejecutar("Orden de taller creada y vinculada correctamente.", async () => {
      await crearOrdenTallerDesdeCasoPostventa(casoId, normalizeCrearOtPayload(crearOtForm));
      setCrearOtForm((prev) => ({
        ...prev,
        problema_reportado: caso?.motivo_cliente || prev.problema_reportado,
        observaciones_vinculo: "",
      }));
      await cargarTodo();
    });
  }

  async function ejecutar(okMessage, action) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await action();
      setSuccess(okMessage);
    } catch (err) {
      setError(err.message || "No se pudo completar la operacion");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !caso) {
    return <Card title="Postventa" subtitle="Cargando caso..." />;
  }

  if (!caso) {
    return (
      <Card title="Postventa" subtitle="No se pudo abrir el caso.">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button variant="outline" onClick={() => navigate("/postventa")}>Volver</Button>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Caso ${caso.codigo || `#${caso.id}`}`}
        subtitle={`${labelPostventaTipo(caso.tipo_caso)} · ${caso.cliente_nombre || `Cliente #${caso.id_cliente}`}`}
        actions={
          <>
            <Button variant="outline" onClick={cargarTodo} disabled={loading || saving}>Refrescar</Button>
            <Button variant="outline" onClick={() => navigate("/postventa")}>Volver</Button>
          </>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <section style={styles.summaryGrid}>
        <Summary label="Estado" value={<Badge variant={variantPostventaEstado(caso.estado)}>{labelPostventaEstado(caso.estado)}</Badge>} />
        <Summary label="Prioridad" value={labelPostventaPrioridad(caso.prioridad)} />
        <Summary label="Cliente" value={caso.cliente_nombre || `#${caso.id_cliente}`} />
        <Summary label="Venta origen" value={caso.id_venta_origen ? `#${caso.id_venta_origen}` : "-"} />
        <Summary label="Bicicleta" value={caso.bicicleta_cliente_descripcion || caso.bicicleta_numero_cuadro || "-"} />
        <Summary label="Fecha apertura" value={formatDateTime(caso.fecha_apertura)} />
      </section>

      <section style={styles.layout}>
        <main style={styles.mainColumn}>
          <Card title="Datos del caso" subtitle={bloqueado ? "Caso cerrado o cancelado. Reabrilo para modificar." : "Evaluacion, decisiones y cobertura."}>
            <form onSubmit={guardarCambios} style={styles.form}>
              <Textarea
                label="Motivo informado por el cliente"
                value={editForm.motivo_cliente || ""}
                disabled={bloqueado}
                onChange={(event) => setEditForm((prev) => ({ ...prev, motivo_cliente: event.target.value }))}
              />
              <Textarea
                label="Evaluacion tecnica"
                value={editForm.evaluacion_tecnica || ""}
                disabled={bloqueado}
                onChange={(event) => setEditForm((prev) => ({ ...prev, evaluacion_tecnica: event.target.value }))}
              />
              <Textarea
                label="Causa determinada"
                value={editForm.causa_determinada || ""}
                disabled={bloqueado}
                onChange={(event) => setEditForm((prev) => ({ ...prev, causa_determinada: event.target.value }))}
              />

              <div style={styles.formGrid}>
                <Input
                  label="Decision proveedor"
                  value={editForm.decision_proveedor || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, decision_proveedor: event.target.value }))}
                />
                <Input
                  label="Decision local"
                  value={editForm.decision_local || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, decision_local: event.target.value }))}
                />
                <Input
                  label="Cobertura"
                  value={editForm.cobertura_tipo || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, cobertura_tipo: event.target.value }))}
                />
                <Input
                  label="Responsable economico"
                  value={editForm.responsable_economico || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, responsable_economico: event.target.value }))}
                />
              </div>

              <div style={styles.formGrid}>
                <Input
                  label="Cubierto proveedor"
                  type="number"
                  min="0"
                  value={editForm.monto_cubierto_proveedor || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, monto_cubierto_proveedor: event.target.value }))}
                />
                <Input
                  label="Cubierto local"
                  type="number"
                  min="0"
                  value={editForm.monto_cubierto_local || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, monto_cubierto_local: event.target.value }))}
                />
                <Input
                  label="A cargo cliente"
                  type="number"
                  min="0"
                  value={editForm.monto_a_cargo_cliente || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, monto_a_cargo_cliente: event.target.value }))}
                />
                <Input
                  label="Reconocido proveedor"
                  type="number"
                  min="0"
                  value={editForm.monto_reconocido_proveedor || ""}
                  disabled={bloqueado}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, monto_reconocido_proveedor: event.target.value }))}
                />
              </div>

              <Textarea
                label="Resolucion aplicada"
                value={editForm.resolucion_aplicada || ""}
                disabled={bloqueado}
                onChange={(event) => setEditForm((prev) => ({ ...prev, resolucion_aplicada: event.target.value }))}
              />
              <Textarea
                label="Resultado final"
                value={editForm.resultado_final || ""}
                disabled={bloqueado}
                onChange={(event) => setEditForm((prev) => ({ ...prev, resultado_final: event.target.value }))}
              />

              <Button type="submit" disabled={bloqueado || saving}>Guardar cambios</Button>
            </form>
          </Card>

          <Card title="Ordenes de taller vinculadas" subtitle="Una OT no puede pertenecer a dos casos." style={{ marginTop: spacing.lg }}>
            <Table
              columns={OT_COLUMNS}
              data={ordenes}
              emptyMessage="No hay ordenes de taller vinculadas."
              renderRow={(orden) => (
                <>
                  <td style={styles.td}>OT #{orden.id_orden_taller}</td>
                  <td style={styles.td}>{orden.estado}</td>
                  <td style={styles.td}>{orden.problema_reportado}</td>
                  <td style={styles.td}>{formatMoney(orden.total_final)}</td>
                  <td style={styles.td}>
                    <Link to={`/taller/${orden.id_orden_taller}`} style={styles.linkAction}>Abrir OT</Link>
                  </td>
                </>
              )}
            />
          </Card>

          <Card title="Timeline" subtitle="Eventos operativos del caso." style={{ marginTop: spacing.lg }}>
            <Table
              columns={EVENT_COLUMNS}
              data={caso.eventos || []}
              emptyMessage="Sin eventos registrados."
              renderRow={(evento) => (
                <>
                  <td style={styles.td}>{formatDateTime(evento.fecha)}</td>
                  <td style={styles.td}>{evento.tipo_evento}</td>
                  <td style={styles.td}>{evento.detalle || "-"}</td>
                </>
              )}
            />
          </Card>
        </main>

        <aside style={styles.sideColumn}>
          <Card title="Acciones">
            {bloqueado && caso.estado === "cerrado" ? (
              <form onSubmit={reabrirCaso} style={styles.form}>
                <Textarea
                  label="Motivo de reapertura"
                  required
                  value={reaperturaForm.motivo}
                  onChange={(event) => setReaperturaForm({ motivo: event.target.value })}
                />
                <Button type="submit" disabled={saving}>Reabrir caso</Button>
              </form>
            ) : bloqueado ? (
              <div style={styles.emptyBox}>El caso esta cancelado. No tiene acciones disponibles.</div>
            ) : (
              <div style={styles.form}>
                <form onSubmit={cambiarEstado} style={styles.form}>
                  <Select
                    label="Cambiar estado"
                    value={estadoForm.nuevo_estado}
                    onChange={(event) => setEstadoForm((prev) => ({ ...prev, nuevo_estado: event.target.value }))}
                  >
                    <option value="">Elegir estado...</option>
                    {transicionesEstado.map((estado) => (
                      <option key={estado} value={estado}>{labelPostventaEstado(estado)}</option>
                    ))}
                  </Select>
                  <Textarea
                    label="Motivo / nota"
                    value={estadoForm.motivo}
                    onChange={(event) => setEstadoForm((prev) => ({ ...prev, motivo: event.target.value }))}
                  />
                  <Button type="submit" disabled={saving || !estadoForm.nuevo_estado}>Aplicar estado</Button>
                </form>

                <div style={styles.actionBlock}>
                  <strong>Crear OT desde el caso</strong>
                  {!caso.id_bicicleta_cliente ? (
                    <div style={styles.emptyBox}>
                      Este caso no tiene bicicleta asociada. Taller requiere una bicicleta del cliente para crear la OT.
                    </div>
                  ) : (
                    <form onSubmit={crearOT} style={styles.form}>
                      <Input
                        label="Sucursal"
                        type="number"
                        min="1"
                        required
                        value={crearOtForm.id_sucursal}
                        onChange={(event) => setCrearOtForm((prev) => ({ ...prev, id_sucursal: event.target.value }))}
                        placeholder="Ej: 1"
                      />
                      <Input
                        label="Fecha prometida"
                        type="date"
                        value={crearOtForm.fecha_prometida}
                        onChange={(event) => setCrearOtForm((prev) => ({ ...prev, fecha_prometida: event.target.value }))}
                      />
                      <Select
                        label="Prioridad"
                        value={crearOtForm.prioridad}
                        onChange={(event) => setCrearOtForm((prev) => ({ ...prev, prioridad: event.target.value }))}
                      >
                        <option value="normal">Normal</option>
                        <option value="urgente">Urgente</option>
                      </Select>
                      <Textarea
                        label="Problema inicial"
                        required
                        value={crearOtForm.problema_reportado}
                        onChange={(event) => setCrearOtForm((prev) => ({ ...prev, problema_reportado: event.target.value }))}
                      />
                      <Textarea
                        label="Observacion del vinculo"
                        value={crearOtForm.observaciones_vinculo}
                        onChange={(event) => setCrearOtForm((prev) => ({ ...prev, observaciones_vinculo: event.target.value }))}
                      />
                      <Button type="submit" disabled={saving || !crearOtForm.id_sucursal || !crearOtForm.problema_reportado.trim()}>
                        Crear OT
                      </Button>
                    </form>
                  )}
                </div>

                <form onSubmit={vincularOT} style={styles.actionBlock}>
                  <strong>Vincular OT existente</strong>
                  <Input
                    label="Numero de OT"
                    type="number"
                    min="1"
                    value={otForm.id_orden_taller}
                    onChange={(event) => setOtForm((prev) => ({ ...prev, id_orden_taller: event.target.value }))}
                    placeholder="Numero de OT"
                  />
                  <Textarea
                    label="Observacion del vinculo"
                    value={otForm.observaciones}
                    onChange={(event) => setOtForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                  <Button type="submit" variant="outline" disabled={saving || !otForm.id_orden_taller}>Vincular OT</Button>
                </form>

                {puedeCerrar ? (
                  <form onSubmit={cerrarCaso} style={styles.form}>
                    <Textarea
                      label="Resultado final"
                      required
                      value={cierreForm.resultado_final}
                      onChange={(event) => setCierreForm((prev) => ({ ...prev, resultado_final: event.target.value }))}
                    />
                    <Textarea
                      label="Resolucion aplicada"
                      required
                      value={cierreForm.resolucion_aplicada}
                      onChange={(event) => setCierreForm((prev) => ({ ...prev, resolucion_aplicada: event.target.value }))}
                    />
                    <Textarea
                      label="Observaciones de cierre"
                      value={cierreForm.observaciones}
                      onChange={(event) => setCierreForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                    />
                    <Button type="submit" variant="secondary" disabled={saving}>Cerrar caso</Button>
                  </form>
                ) : (
                  <div style={styles.emptyBox}>
                    Para cerrar, primero avanza el caso hasta un estado que permita cierre.
                  </div>
                )}
              </div>
            )}
          </Card>
        </aside>
      </section>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Textarea({ label, style = {}, ...props }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800, color: colors.text, ...style }}>
      <span>{label}</span>
      <textarea style={styles.textarea} {...props} />
    </label>
  );
}

function Alert({ children, tone = "danger" }) {
  const isDanger = tone === "danger";
  return (
    <div style={{
      ...styles.alert,
      background: isDanger ? colors.dangerSoft : colors.successSoft,
      color: isDanger ? colors.dangerDark : colors.successDark,
      borderColor: isDanger ? "#f4c7c3" : "#abefc6",
    }}>
      {children}
    </div>
  );
}

function buildEditForm(caso) {
  return {
    motivo_cliente: caso?.motivo_cliente || "",
    evaluacion_tecnica: caso?.evaluacion_tecnica || "",
    causa_determinada: caso?.causa_determinada || "",
    decision_proveedor: caso?.decision_proveedor || "",
    decision_local: caso?.decision_local || "",
    cobertura_tipo: caso?.cobertura_tipo || "",
    responsable_economico: caso?.responsable_economico || "",
    monto_reconocido_proveedor: numberOrBlank(caso?.monto_reconocido_proveedor),
    monto_cubierto_proveedor: numberOrBlank(caso?.monto_cubierto_proveedor),
    monto_cubierto_local: numberOrBlank(caso?.monto_cubierto_local),
    monto_a_cargo_cliente: numberOrBlank(caso?.monto_a_cargo_cliente),
    resolucion_aplicada: caso?.resolucion_aplicada || "",
    resultado_final: caso?.resultado_final || "",
    observaciones: caso?.observaciones || "",
  };
}

function numberOrBlank(value) {
  const number = Number(value || 0);
  return number > 0 ? String(number) : "";
}

function normalizePayload(data) {
  const payload = {};

  Object.entries(data).forEach(([key, value]) => {
    if (value === "") {
      payload[key] = null;
      return;
    }

    if (key.startsWith("monto_")) {
      payload[key] = value === null || value === undefined ? null : Number(value);
      return;
    }

    payload[key] = typeof value === "string" ? value.trim() || null : value;
  });

  return payload;
}

function normalizeCrearOtPayload(data) {
  const fecha = data.fecha_prometida ? `${data.fecha_prometida}T00:00:00` : null;
  return {
    id_sucursal: Number(data.id_sucursal),
    fecha_prometida: fecha,
    prioridad: data.prioridad,
    problema_reportado: data.problema_reportado.trim(),
    observaciones_vinculo: data.observaciones_vinculo.trim() || null,
  };
}

const styles = {
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(310px, 360px)",
    gap: spacing.lg,
    alignItems: "start",
  },
  mainColumn: {
    display: "grid",
    minWidth: 0,
  },
  sideColumn: {
    display: "grid",
    gap: spacing.lg,
    position: "sticky",
    top: 12,
  },
  form: { display: "grid", gap: spacing.md },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: spacing.md,
  },
  actionBlock: {
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.md,
    padding: spacing.md,
    display: "grid",
    gap: spacing.md,
    background: colors.surface,
  },
  textarea: {
    width: "100%",
    minHeight: 78,
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: "Arial, sans-serif",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    background: colors.surface,
  },
  td: {
    padding: "12px 16px",
    verticalAlign: "top",
  },
  linkAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 10px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    color: colors.secondary,
    background: colors.surface,
    textDecoration: "none",
    fontWeight: 900,
  },
  alert: {
    border: "1px solid",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    fontWeight: 800,
  },
  emptyBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    background: colors.surfaceMuted,
    color: colors.textMuted,
    fontWeight: 800,
  },
};
