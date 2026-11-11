import { useEffect, useState } from "react";
import { CalendarPlus, ClipboardCheck } from "lucide-react";
import { useSession } from "../../context/SessionContext";
import {
  crearSeguimientoCliente,
  listarResponsablesCrm,
  listarSeguimientosCliente,
  listarComunicacionesCliente,
} from "../../services/clientesService";
import { colors, radius, spacing } from "../../theme";
import { Button, Card, EmptyState } from "../ui";
import SeguimientoCrmCard from "./SeguimientoCrmCard";
import ClientesCrmOportunidadesPanel from "./ClientesCrmOportunidadesPanel";

export default function ClienteSeguimientosPanel({ clienteId }) {
  const { usuarioId } = useSession();
  const [data, setData] = useState(null);
  const [responsables, setResponsables] = useState([]);
  const [comunicaciones, setComunicaciones] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(formInicial());

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, soloPendientes]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      const [seguimientos, usuarios, contactos] = await Promise.all([
        listarSeguimientosCliente(clienteId, { bandeja: soloPendientes ? "pendientes" : "todos" }),
        listarResponsablesCrm(),
        listarComunicacionesCliente(clienteId, { limit: 10 }),
      ]);
      setData(seguimientos);
      setResponsables(usuarios || []);
      setComunicaciones(contactos);
      setForm((prev) => ({
        ...prev,
        id_usuario_responsable: prev.id_usuario_responsable || usuarioId || usuarios?.[0]?.id || "",
      }));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los seguimientos");
    } finally {
      setLoading(false);
    }
  }

  async function crear(event) {
    event.preventDefault();
    try {
      setGuardando(true);
      setError("");
      await crearSeguimientoCliente(clienteId, {
        ...form,
        id_usuario_responsable: Number(form.id_usuario_responsable),
        id_usuario_actor: usuarioId || undefined,
      });
      setForm({ ...formInicial(), id_usuario_responsable: usuarioId || responsables[0]?.id || "" });
      setMostrarForm(false);
      setSoloPendientes(true);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo crear el seguimiento");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={styles.page}>
      <ClientesCrmOportunidadesPanel clienteId={clienteId} ocultarVacio />
      <Card
        title="Seguimientos"
        subtitle="Acciones internas pendientes y contactos ya realizados. No se envía ningún mensaje automáticamente."
        actions={<Button type="button" onClick={() => setMostrarForm((value) => !value)}><CalendarPlus size={16} /> {mostrarForm ? "Cerrar formulario" : "Nuevo seguimiento"}</Button>}
      >
        {error && <div style={styles.error}>{error}</div>}
        {mostrarForm && (
          <form onSubmit={crear} style={styles.form}>
            <label style={styles.field}>Tipo<select value={form.tipo} onChange={(e) => update("tipo", e.target.value)} style={styles.input}><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="service">Service</option><option value="presupuesto">Presupuesto</option><option value="reserva">Reserva</option><option value="deuda">Deuda</option><option value="postventa">Postventa</option><option value="otro">Otro</option></select></label>
            <label style={styles.field}>Fecha objetivo<input type="date" required value={form.fecha_objetivo} onChange={(e) => update("fecha_objetivo", e.target.value)} style={styles.input} /></label>
            <label style={styles.field}>Responsable<select required value={form.id_usuario_responsable} onChange={(e) => update("id_usuario_responsable", e.target.value)} style={styles.input}><option value="">Seleccionar</option>{responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label style={styles.field}>Prioridad<select value={form.prioridad} onChange={(e) => update("prioridad", e.target.value)} style={styles.input}><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
            <label style={{ ...styles.field, ...styles.reasonField }}>Motivo<textarea required minLength={3} maxLength={500} value={form.motivo} onChange={(e) => update("motivo", e.target.value)} placeholder="Ej: consultar si acepta el presupuesto pendiente" style={styles.textarea} /></label>
            <div style={styles.formActions}><Button type="button" variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button><Button type="submit" disabled={guardando || !responsables.length}>{guardando ? "Creando..." : "Crear seguimiento"}</Button></div>
          </form>
        )}
      </Card>

      <div style={styles.toolbar}>
        <strong>{data?.total || 0} seguimiento(s)</strong>
        <label style={styles.toggle}><input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo pendientes</label>
      </div>

      {loading ? (
        <EmptyState icon={ClipboardCheck} title="Cargando seguimientos..." description="Revisando tareas e historial del cliente." />
      ) : !data?.items?.length ? (
        <EmptyState icon={ClipboardCheck} title={soloPendientes ? "No hay acciones pendientes" : "Todavía no hay seguimientos"} description="Podés crear una tarea cuando exista algo concreto para recordar o contactar." />
      ) : (
        <div style={styles.list}>{data.items.map((item) => <SeguimientoCrmCard key={item.id} seguimiento={item} responsables={responsables} actorId={usuarioId} onChanged={cargar} />)}</div>
      )}

      <Card
        title="Historial de contactos"
        subtitle="Resultados registrados manualmente; no confirma que un mensaje haya sido leído."
        actions={comunicaciones?.preferencia_contacto?.estado === "no_contactar" ? <span style={styles.excluded}>No contactar</span> : null}
      >
        {!comunicaciones?.items?.length ? <span style={styles.muted}>Todavía no se registraron contactos CRM.</span> : (
          <div style={styles.contactList}>{comunicaciones.items.map((item) => (
            <div key={item.id} style={styles.contactRow}>
              <div><strong>{contactLabel(item.resultado)}</strong><span style={styles.contactMeta}>{item.canal} · {formatDateTime(item.fecha_contacto)} · {item.usuario_nombre}</span></div>
              {(item.nota || item.mensaje) && <span style={styles.contactText}>{item.nota || item.mensaje}</span>}
            </div>
          ))}</div>
        )}
      </Card>
    </div>
  );

  function update(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }
}

function contactLabel(value) {
  return { contactado: "Contactado", sin_respuesta: "Sin respuesta", respondio: "Respondió", interesado: "Interesado", no_interesado: "No interesado", convertido: "Convertido", otro: "Otro" }[value] || value;
}

function formatDateTime(value) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
}

function formInicial() {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  return {
    tipo: "whatsapp",
    motivo: "",
    fecha_objetivo: local.toISOString().slice(0, 10),
    prioridad: "normal",
    id_usuario_responsable: "",
  };
}

const styles = {
  page: { display: "grid", gap: spacing.md },
  error: { background: colors.dangerSoft, color: colors.dangerDark, borderRadius: radius.sm, padding: 10, fontWeight: 700, marginBottom: 10 },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, paddingTop: 8 },
  field: { display: "grid", gap: 5, color: colors.textMuted, fontSize: 12, fontWeight: 800 },
  reasonField: { gridColumn: "1 / -1" },
  input: { minHeight: 42, width: "100%", boxSizing: "border-box", border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: "0 10px", background: colors.surface, color: colors.text, fontWeight: 700 },
  textarea: { minHeight: 80, width: "100%", boxSizing: "border-box", border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: 10, resize: "vertical", fontFamily: "inherit" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 8, gridColumn: "1 / -1", flexWrap: "wrap" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  toggle: { display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, color: colors.textMuted },
  list: { display: "grid", gap: 10 },
  muted: { color: colors.textMuted, fontSize: 13 },
  excluded: { color: colors.dangerDark, background: colors.dangerSoft, borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 },
  contactList: { display: "grid", gap: 8 },
  contactRow: { display: "grid", gap: 4, padding: 10, borderRadius: radius.sm, background: colors.surfaceMuted },
  contactMeta: { display: "block", marginTop: 2, color: colors.textMuted, fontSize: 12, textTransform: "capitalize" },
  contactText: { color: colors.text, fontSize: 13, lineHeight: 1.4 },
};
