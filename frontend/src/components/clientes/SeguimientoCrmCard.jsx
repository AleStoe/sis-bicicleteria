import { useState } from "react";
import { CalendarClock, Check, History, X } from "lucide-react";
import { Badge, Button } from "../ui";
import {
  cerrarSeguimientoCliente,
  listarEventosSeguimientoCliente,
  reprogramarSeguimientoCliente,
} from "../../services/clientesService";
import { colors, radius, spacing } from "../../theme";

const prioridadVariant = {
  urgente: "danger",
  alta: "warning",
  normal: "default",
  baja: "default",
};

export default function SeguimientoCrmCard({ seguimiento, responsables, actorId, onChanged, compacto = false }) {
  const [accion, setAccion] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [eventos, setEventos] = useState(null);
  const [reprogramacion, setReprogramacion] = useState({
    fecha_objetivo: seguimiento.fecha_objetivo,
    id_usuario_responsable: seguimiento.id_usuario_responsable,
    prioridad: seguimiento.prioridad,
    nota: "",
  });
  const [resultado, setResultado] = useState("");

  async function reprogramar(event) {
    event.preventDefault();
    await ejecutar(async () => {
      await reprogramarSeguimientoCliente(seguimiento.id_cliente, seguimiento.id, {
        ...reprogramacion,
        id_usuario_responsable: Number(reprogramacion.id_usuario_responsable),
        id_usuario_actor: actorId || undefined,
      });
    });
  }

  async function cerrar(estado) {
    if (resultado.trim().length < 3) {
      setError("Escribí brevemente qué pasó antes de cerrar la tarea.");
      return;
    }
    await ejecutar(async () => {
      await cerrarSeguimientoCliente(seguimiento.id_cliente, seguimiento.id, {
        estado,
        resultado: resultado.trim(),
        id_usuario_actor: actorId || undefined,
      });
    });
  }

  async function ejecutar(callback) {
    try {
      setProcesando(true);
      setError("");
      await callback();
      setAccion(null);
      setResultado("");
      await onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el seguimiento");
    } finally {
      setProcesando(false);
    }
  }

  async function alternarHistorial() {
    if (eventos) {
      setEventos(null);
      return;
    }
    try {
      setError("");
      setEventos(await listarEventosSeguimientoCliente(seguimiento.id_cliente, seguimiento.id));
    } catch (err) {
      setError(err.message || "No se pudo cargar el historial");
    }
  }

  const pendiente = seguimiento.estado === "pendiente";
  return (
    <article style={{ ...styles.card, ...(seguimiento.vencido ? styles.overdue : {}), ...(compacto ? styles.compact : {}) }}>
      <div style={styles.header}>
        <div style={styles.titleBlock}>
          <div style={styles.badges}>
            <Badge variant={seguimiento.vencido ? "danger" : seguimiento.es_hoy ? "warning" : "default"}>
              {seguimiento.vencido ? "Vencido" : seguimiento.es_hoy ? "Hoy" : estadoLabel(seguimiento.estado)}
            </Badge>
            <Badge variant={prioridadVariant[seguimiento.prioridad]}>{prioridadLabel(seguimiento.prioridad)}</Badge>
            <span style={styles.type}>{tipoLabel(seguimiento.tipo)}</span>
          </div>
          <strong style={styles.reason}>{seguimiento.motivo}</strong>
          {seguimiento.cliente_nombre && <span style={styles.client}>{seguimiento.cliente_nombre} · {seguimiento.cliente_telefono || "Sin teléfono"}</span>}
        </div>
        <div style={styles.dateBlock}>
          <strong>{formatDateOnly(seguimiento.fecha_objetivo)}</strong>
          <span>{seguimiento.responsable_nombre}</span>
        </div>
      </div>

      {!pendiente && seguimiento.resultado && (
        <div style={styles.result}><strong>Resultado:</strong> {seguimiento.resultado}</div>
      )}
      {error && <div style={styles.error}>{error}</div>}

      {pendiente && !accion && (
        <div style={styles.actions}>
          <Button type="button" variant="outline" onClick={() => setAccion("reprogramar")}><CalendarClock size={15} /> Reprogramar</Button>
          <Button type="button" variant="primary" onClick={() => setAccion("realizada")}><Check size={15} /> Realizada</Button>
          <Button type="button" variant="outline" onClick={() => setAccion("cancelada")}><X size={15} /> Cancelar</Button>
          <Button type="button" variant="outline" onClick={alternarHistorial}><History size={15} /> Historial</Button>
        </div>
      )}

      {accion === "reprogramar" && (
        <form onSubmit={reprogramar} style={styles.form}>
          <label style={styles.field}>Nueva fecha<input type="date" required value={reprogramacion.fecha_objetivo} onChange={(e) => setReprogramacion((prev) => ({ ...prev, fecha_objetivo: e.target.value }))} style={styles.input} /></label>
          <label style={styles.field}>Responsable<select required value={reprogramacion.id_usuario_responsable} onChange={(e) => setReprogramacion((prev) => ({ ...prev, id_usuario_responsable: e.target.value }))} style={styles.input}>{responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label style={styles.field}>Prioridad<select value={reprogramacion.prioridad} onChange={(e) => setReprogramacion((prev) => ({ ...prev, prioridad: e.target.value }))} style={styles.input}><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
          <label style={{ ...styles.field, ...styles.fieldWide }}>Nota<input value={reprogramacion.nota} onChange={(e) => setReprogramacion((prev) => ({ ...prev, nota: e.target.value }))} placeholder="Por qué cambia la fecha" style={styles.input} /></label>
          <div style={styles.formActions}><Button type="button" variant="outline" onClick={() => setAccion(null)}>Volver</Button><Button type="submit" disabled={procesando}>{procesando ? "Guardando..." : "Guardar cambios"}</Button></div>
        </form>
      )}

      {(accion === "realizada" || accion === "cancelada") && (
        <div style={styles.closeBox}>
          <label style={styles.field}>Resultado o motivo<textarea value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder={accion === "realizada" ? "Qué respondió el cliente o cómo terminó" : "Por qué se cancela"} style={styles.textarea} /></label>
          <div style={styles.formActions}><Button type="button" variant="outline" onClick={() => setAccion(null)}>Volver</Button><Button type="button" variant={accion === "cancelada" ? "danger" : "primary"} disabled={procesando} onClick={() => cerrar(accion)}>{procesando ? "Guardando..." : accion === "realizada" ? "Confirmar realizada" : "Confirmar cancelación"}</Button></div>
        </div>
      )}

      {eventos && (
        <div style={styles.timeline}>
          {eventos.map((evento) => <div key={evento.id}><strong>{eventoLabel(evento.tipo_evento)}</strong><span>{evento.usuario_nombre} · {formatDateTime(evento.created_at)}</span>{evento.detalle && <p>{evento.detalle}</p>}</div>)}
          {!eventos.length && <span>Sin eventos registrados.</span>}
        </div>
      )}
      {!pendiente && <Button type="button" variant="outline" onClick={alternarHistorial}><History size={15} /> {eventos ? "Ocultar historial" : "Ver historial"}</Button>}
    </article>
  );
}

function formatDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("es-AR") : "-";
}

function tipoLabel(tipo) {
  return { llamada: "Llamada", whatsapp: "WhatsApp", service: "Service", presupuesto: "Presupuesto", reserva: "Reserva", deuda: "Deuda", postventa: "Postventa", otro: "Otro" }[tipo] || tipo;
}

function prioridadLabel(prioridad) {
  return { baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente" }[prioridad] || prioridad;
}

function estadoLabel(estado) {
  return { pendiente: "Pendiente", realizada: "Realizada", cancelada: "Cancelada" }[estado] || estado;
}

function eventoLabel(tipo) {
  return { creado: "Creado", reprogramado: "Reprogramado", realizado: "Realizado", cancelado: "Cancelado" }[tipo] || tipo;
}

const styles = {
  card: { border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, padding: spacing.md, display: "grid", gap: 12 },
  compact: { padding: 12 },
  overdue: { borderColor: colors.danger, background: colors.dangerSoft },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  titleBlock: { display: "grid", gap: 6, minWidth: 0, flex: "1 1 320px" },
  badges: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 },
  type: { color: colors.textMuted, fontSize: 12, fontWeight: 800, textTransform: "uppercase" },
  reason: { fontSize: 16, overflowWrap: "anywhere" },
  client: { color: colors.secondary, fontWeight: 800 },
  dateBlock: { display: "grid", textAlign: "right", gap: 3, color: colors.textMuted, fontSize: 13 },
  result: { background: colors.successSoft, color: colors.successDark, borderRadius: radius.sm, padding: 10 },
  error: { color: colors.dangerDark, background: colors.dangerSoft, borderRadius: radius.sm, padding: 9, fontWeight: 700 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8 },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` },
  closeBox: { display: "grid", gap: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` },
  field: { display: "grid", gap: 5, color: colors.textMuted, fontSize: 12, fontWeight: 800 },
  fieldWide: { gridColumn: "1 / -1" },
  input: { minHeight: 42, width: "100%", boxSizing: "border-box", border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: "0 10px", background: colors.surface, color: colors.text, fontWeight: 700 },
  textarea: { minHeight: 78, width: "100%", boxSizing: "border-box", border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: 10, resize: "vertical", fontFamily: "inherit" },
  formActions: { display: "flex", justifyContent: "flex-end", alignItems: "end", gap: 8, gridColumn: "1 / -1", flexWrap: "wrap" },
  timeline: { display: "grid", gap: 8, padding: 10, background: colors.surfaceMuted, borderRadius: radius.sm },
};
