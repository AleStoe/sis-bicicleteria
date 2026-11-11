import { useEffect, useState } from "react";
import { Ban, Check, ClipboardCopy, MessageSquare, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import {
  actualizarPreferenciaContacto,
  listarComunicacionesCrm,
  registrarComunicacionCliente,
} from "../../services/clientesService";
import { colors, radius, spacing } from "../../theme";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, ResponsiveMetricsGrid, useBreakpoint } from "../ui";
import SearchField from "../ui/SearchField";

const PAGE_SIZE = 10;
const VISTAS = [
  ["inactivos", "Inactivos"],
  ["recientes", "Nuevos"],
  ["recurrentes", "Recurrentes"],
  ["taller", "Frecuentes de taller"],
  ["credito", "Con crédito"],
  ["deuda", "Con deuda"],
  ["alto_valor", "Alto valor"],
  ["todos", "Todos"],
];

export default function ClientesCrmComunicacionesPanel() {
  const { usuarioId } = useSession();
  const isMobile = useBreakpoint();
  const [data, setData] = useState(null);
  const [vista, setVista] = useState("inactivos");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [exclusion, setExclusion] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ canal: "whatsapp", resultado: "contactado", nota: "" });

  useEffect(() => {
    const timer = setTimeout(cargar, busqueda.trim() ? 300 : 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, busqueda, pagina]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      const response = await listarComunicacionesCrm({
        vista,
        q: busqueda.trim() || undefined,
        orden: vista === "inactivos" ? "inactividad" : "reciente",
        limit: PAGE_SIZE,
        offset: pagina * PAGE_SIZE,
      });
      setData(response);
    } catch (err) {
      setError(err.message || "No se pudo cargar la bandeja de comunicaciones");
    } finally {
      setLoading(false);
    }
  }

  async function copiar(item) {
    if (!item.borrador_mensaje) return;
    await navigator.clipboard.writeText(item.borrador_mensaje);
    setCopiadoId(item.id);
  }

  async function registrar(item) {
    try {
      setGuardando(true);
      setError("");
      await registrarComunicacionCliente(item.id, {
        ...form,
        mensaje: item.borrador_mensaje,
        nota: form.nota.trim() || undefined,
        id_usuario_actor: usuarioId || undefined,
      });
      setSeleccionado(null);
      setForm({ canal: "whatsapp", resultado: "contactado", nota: "" });
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo registrar el contacto");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPreferencia(item, estado) {
    const motivo = exclusion?.clienteId === item.id ? exclusion.motivo.trim() : "";
    if (estado === "no_contactar" && !motivo) return;
    try {
      setGuardando(true);
      setError("");
      await actualizarPreferenciaContacto(item.id, {
        estado,
        canal_preferido: estado === "habilitado" ? "whatsapp" : undefined,
        motivo_exclusion: estado === "no_contactar" ? motivo : undefined,
        id_usuario_actor: usuarioId || undefined,
      });
      setExclusion(null);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la preferencia");
    } finally {
      setGuardando(false);
    }
  }

  const resumen = data?.resumen_comunicaciones || {};

  return (
    <div style={styles.page}>
      <PageHeader title="Comunicaciones CRM" subtitle="Prepará contactos uno por uno y registrá el resultado. El sistema no envía mensajes automáticamente." actions={<Button type="button" variant="outline" onClick={cargar}><RefreshCw size={16} /> Actualizar</Button>} />
      <ResponsiveMetricsGrid minWidth={155} mobileColumns={2}>
        <MetricCard label="Contactos · 30 días" value={resumen.contactos || 0} tone="primary" />
        <MetricCard label="Respondieron" value={resumen.respuestas || 0} tone="success" />
        <MetricCard label="Interesados" value={resumen.interesados || 0} />
        <MetricCard label="Convertidos" value={resumen.convertidos || 0} tone="success" />
        <MetricCard label="No contactar" value={resumen.excluidos || 0} tone="warning" />
        <MetricCard label="Tasa respuesta" value={resumen.tasa_respuesta == null ? "-" : `${resumen.tasa_respuesta}%`} />
      </ResponsiveMetricsGrid>

      <Card title="Lista de trabajo" subtitle="Elegí un segmento. Las exclusiones permanecen visibles para evitar contactos accidentales.">
        <div style={isMobile ? styles.filtersMobile : styles.filters}>
          <SearchField value={busqueda} onChange={(value) => { setBusqueda(value); setPagina(0); }} onSearch={cargar} placeholder="Cliente o teléfono" style={styles.search} inputStyle={styles.searchInput} />
          <label style={styles.field}>Segmento<select value={vista} onChange={(event) => { setVista(event.target.value); setPagina(0); }} style={styles.input}>{VISTAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </Card>

      {error && <div style={styles.error}>{error}</div>}
      {loading ? <EmptyState icon={MessageSquare} title="Preparando lista..." description="Calculando segmentos y preferencias." /> : !data?.items?.length ? <EmptyState icon={MessageSquare} title="Sin clientes en este segmento" description="Probá otra lista o búsqueda." /> : (
        <div style={styles.list}>
          {data.items.map((item) => {
            const excluido = item.preferencia_contacto?.estado === "no_contactar";
            return (
              <article key={item.id} style={{ ...styles.card, ...(excluido ? styles.cardExcluded : {}) }}>
                <div style={styles.header}>
                  <div style={styles.identity}>
                    <div style={styles.badges}>{(item.segmentos || []).slice(0, 3).map((segmento) => <Badge key={segmento.clave} variant={segmento.tono === "danger" ? "danger" : segmento.tono === "warning" ? "warning" : "default"}>{segmento.nombre}</Badge>)}</div>
                    <strong>{item.nombre}</strong>
                    <span>{item.telefono || "Sin teléfono"}</span>
                  </div>
                  {excluido && <Badge variant="danger">No contactar</Badge>}
                </div>

                {excluido ? <div style={styles.exclusionReason}><Ban size={16} /> {item.preferencia_contacto.motivo_exclusion}</div> : item.borrador_mensaje ? <div style={styles.draft}>{item.borrador_mensaje}</div> : <div style={styles.muted}>No se puede preparar mensaje porque falta el teléfono.</div>}

                {item.ultima_comunicacion && <div style={styles.lastContact}>Último contacto: {formatDateTime(item.ultima_comunicacion.fecha_contacto)} · {resultadoLabel(item.ultima_comunicacion.resultado)}</div>}

                <div style={styles.actions}>
                  <Link to={`/clientes/${item.id}?tab=seguimientos`} style={styles.link}>Abrir cliente</Link>
                  {!excluido && item.borrador_mensaje && <Button type="button" variant="outline" onClick={() => copiar(item)}>{copiadoId === item.id ? <Check size={16} /> : <ClipboardCopy size={16} />}{copiadoId === item.id ? "Copiado" : "Copiar mensaje"}</Button>}
                  {!excluido && item.puede_contactar && <Button type="button" onClick={() => { setSeleccionado(seleccionado === item.id ? null : item.id); setExclusion(null); }}>Registrar contacto</Button>}
                  <Button type="button" variant="outline" onClick={() => excluido ? guardarPreferencia(item, "habilitado") : setExclusion({ clienteId: item.id, motivo: "" })}>{excluido ? "Habilitar contacto" : "No contactar"}</Button>
                </div>

                {seleccionado === item.id && (
                  <div style={styles.formBox}>
                    <label style={styles.field}>Canal<select value={form.canal} onChange={(e) => setForm((prev) => ({ ...prev, canal: e.target.value }))} style={styles.input}><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option><option value="otro">Otro</option></select></label>
                    <label style={styles.field}>Resultado<select value={form.resultado} onChange={(e) => setForm((prev) => ({ ...prev, resultado: e.target.value }))} style={styles.input}><option value="contactado">Contactado</option><option value="sin_respuesta">Sin respuesta</option><option value="respondio">Respondió</option><option value="interesado">Interesado</option><option value="no_interesado">No interesado</option><option value="convertido">Convertido</option><option value="otro">Otro</option></select></label>
                    <label style={{ ...styles.field, gridColumn: "1 / -1" }}>Nota<input value={form.nota} onChange={(e) => setForm((prev) => ({ ...prev, nota: e.target.value }))} placeholder="Qué respondió o próximo paso" style={styles.input} /></label>
                    <div style={styles.confirmActions}><Button type="button" variant="outline" onClick={() => setSeleccionado(null)}>Cancelar</Button><Button type="button" disabled={guardando} onClick={() => registrar(item)}>{guardando ? "Guardando..." : "Guardar contacto"}</Button></div>
                  </div>
                )}

                {exclusion?.clienteId === item.id && (
                  <div style={styles.excludeBox}>
                    <label style={styles.field}>Motivo de exclusión<input value={exclusion.motivo} onChange={(e) => setExclusion({ clienteId: item.id, motivo: e.target.value })} placeholder="Ej: pidió no recibir mensajes" style={styles.input} /></label>
                    <div style={styles.confirmActions}><Button type="button" variant="outline" onClick={() => setExclusion(null)}>Cancelar</Button><Button type="button" variant="danger" disabled={guardando || !exclusion.motivo.trim()} onClick={() => guardarPreferencia(item, "no_contactar")}>Confirmar exclusión</Button></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!loading && data?.total > PAGE_SIZE && <div style={styles.pagination}><span>Mostrando {pagina * PAGE_SIZE + 1}-{Math.min((pagina + 1) * PAGE_SIZE, data.total)} de {data.total}</span><div style={styles.paginationActions}><Button type="button" variant="outline" disabled={!pagina} onClick={() => setPagina((value) => Math.max(0, value - 1))}>Anterior</Button><Button type="button" variant="outline" disabled={(pagina + 1) * PAGE_SIZE >= data.total} onClick={() => setPagina((value) => value + 1)}>Siguiente</Button></div></div>}
    </div>
  );
}

function resultadoLabel(value) {
  return { contactado: "Contactado", sin_respuesta: "Sin respuesta", respondio: "Respondió", interesado: "Interesado", no_interesado: "No interesado", convertido: "Convertido", otro: "Otro" }[value] || value;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const styles = {
  page: { display: "grid", gap: spacing.md },
  filters: { display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(190px, .35fr)", gap: 10, alignItems: "end" },
  filtersMobile: { display: "grid", gap: 10 },
  search: { minHeight: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceMuted },
  searchInput: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontSize: 14 },
  field: { display: "grid", gap: 4, color: colors.textMuted, fontSize: 12, fontWeight: 800 },
  input: { minHeight: 42, width: "100%", boxSizing: "border-box", border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "0 10px", background: colors.surface, fontWeight: 700 },
  error: { padding: 10, borderRadius: radius.md, color: colors.dangerDark, background: colors.dangerSoft, fontWeight: 800 },
  list: { display: "grid", gap: 10 },
  card: { display: "grid", gap: 11, padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface },
  cardExcluded: { background: colors.surfaceMuted },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  identity: { display: "grid", gap: 4, minWidth: 0 },
  badges: { display: "flex", gap: 5, flexWrap: "wrap" },
  draft: { padding: 10, borderRadius: radius.sm, background: "#eff6ff", color: "#1e3a8a", lineHeight: 1.4 },
  muted: { color: colors.textMuted, fontSize: 13 },
  exclusionReason: { display: "flex", gap: 7, alignItems: "center", color: colors.dangerDark, fontWeight: 800 },
  lastContact: { color: colors.textMuted, fontSize: 12, fontWeight: 700 },
  actions: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" },
  link: { marginRight: "auto", color: colors.secondary, textDecoration: "none", fontWeight: 800 },
  formBox: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 9, paddingTop: 11, borderTop: `1px solid ${colors.border}` },
  excludeBox: { display: "grid", gap: 9, padding: 11, borderRadius: radius.sm, background: colors.dangerSoft },
  confirmActions: { display: "flex", justifyContent: "flex-end", gap: 8, gridColumn: "1 / -1", flexWrap: "wrap" },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", color: colors.textMuted, fontSize: 13, fontWeight: 800 },
  paginationActions: { display: "flex", gap: 8 },
};
