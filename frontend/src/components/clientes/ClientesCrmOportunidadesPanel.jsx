import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, CalendarPlus, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { useSession } from "../../context/SessionContext";
import {
  crearSeguimientoCliente,
  listarOportunidadesCliente,
  listarOportunidadesCrm,
  listarResponsablesCrm,
} from "../../services/clientesService";
import { colors, radius, spacing } from "../../theme";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, ResponsiveMetricsGrid, useBreakpoint } from "../ui";
import SearchField from "../ui/SearchField";

const TIPOS = [
  { id: "", label: "Todas" },
  { id: "service", label: "Services" },
  { id: "cotizacion", label: "Presupuestos" },
  { id: "reserva", label: "Reservas" },
  { id: "postventa", label: "Postventa" },
];
const PAGE_SIZE = 10;

export default function ClientesCrmOportunidadesPanel({ clienteId = null, ocultarVacio = false }) {
  const { usuarioId } = useSession();
  const isMobile = useBreakpoint();
  const [data, setData] = useState(null);
  const [responsables, setResponsables] = useState([]);
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);
  const [confirmacion, setConfirmacion] = useState({ responsable: "", fecha: "", prioridad: "normal" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarResponsablesCrm().then((items) => {
      setResponsables(items || []);
      setConfirmacion((prev) => ({ ...prev, responsable: usuarioId || items?.[0]?.id || "" }));
    }).catch(() => setResponsables([]));
  }, [usuarioId]);

  useEffect(() => {
    const timer = setTimeout(cargar, busqueda.trim() ? 300 : 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, tipo, busqueda, pagina]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      const params = {
        tipo: tipo || undefined,
        q: !clienteId ? busqueda.trim() || undefined : undefined,
        limit: PAGE_SIZE,
        offset: pagina * PAGE_SIZE,
      };
      const resultado = clienteId
        ? await listarOportunidadesCliente(clienteId, params)
        : await listarOportunidadesCrm(params);
      setData(resultado);
    } catch (err) {
      setError(err.message || "No se pudieron calcular las oportunidades");
    } finally {
      setLoading(false);
    }
  }

  function preparar(item) {
    setSeleccionada(item);
    setConfirmacion({
      responsable: usuarioId || responsables[0]?.id || "",
      fecha: item.fecha_sugerida,
      prioridad: item.prioridad,
    });
  }

  async function confirmar() {
    if (!seleccionada || !confirmacion.responsable) return;
    try {
      setGuardando(true);
      setError("");
      await crearSeguimientoCliente(seleccionada.id_cliente, {
        tipo: seleccionada.tipo_seguimiento,
        motivo: seleccionada.motivo_sugerido,
        fecha_objetivo: confirmacion.fecha,
        prioridad: confirmacion.prioridad,
        id_usuario_responsable: Number(confirmacion.responsable),
        id_usuario_actor: usuarioId || undefined,
        ...seleccionada.referencias,
      });
      setSeleccionada(null);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo crear el seguimiento");
    } finally {
      setGuardando(false);
    }
  }

  if (ocultarVacio && !loading && !error && !data?.total) return null;

  return (
    <div style={styles.page}>
      {!clienteId && <PageHeader title="Oportunidades CRM" subtitle="Señales calculadas con fechas y estados reales. Revisalas antes de crear una tarea." actions={<Button type="button" variant="outline" onClick={cargar}><RefreshCw size={16} /> Recalcular</Button>} />}
      {!clienteId && (
        <ResponsiveMetricsGrid minWidth={170} mobileColumns={2}>
          <MetricCard label="Services" value={data?.resumen?.service || 0} tone="primary" />
          <MetricCard label="Presupuestos" value={data?.resumen?.cotizacion || 0} />
          <MetricCard label="Reservas" value={data?.resumen?.reserva || 0} tone="warning" />
          <MetricCard label="Postventa" value={data?.resumen?.postventa || 0} tone="danger" />
        </ResponsiveMetricsGrid>
      )}
      <Card title={clienteId ? "Oportunidades detectadas" : "Revisión"} subtitle="Una sugerencia no crea tareas ni contacta al cliente hasta que la confirmes.">
        <div style={isMobile ? styles.filtersMobile : styles.filters}>
          {!clienteId && <SearchField value={busqueda} onChange={(value) => { setBusqueda(value); setPagina(0); }} onSearch={cargar} placeholder="Cliente, teléfono o evidencia" style={styles.search} inputStyle={styles.searchInput} />}
          <label style={styles.field}>Tipo<select value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(0); }} style={styles.select}>{TIPOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
      </Card>
      {error && <div style={styles.error}>{error}</div>}
      {loading ? <EmptyState icon={ShieldCheck} title="Calculando oportunidades..." description="Verificando fechas, estados y tareas existentes." /> : !data?.items?.length ? <EmptyState icon={ShieldCheck} title="No hay oportunidades pendientes" description="No encontramos señales verificables con estos filtros." /> : <div style={styles.list}>{data.items.map((item) => (
        <article key={`${item.tipo_oportunidad}-${item.referencia_id}`} style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>
              <div style={styles.badges}><Badge variant={item.prioridad === "urgente" ? "danger" : item.prioridad === "alta" ? "warning" : "default"}>{prioridadLabel(item.prioridad)}</Badge><span style={styles.kind}>{tipoLabel(item.tipo_oportunidad)}</span></div>
              <strong>{item.titulo}</strong>
              <span style={styles.client}>{item.cliente_nombre} · {item.cliente_telefono || "Sin teléfono"}</span>
            </div>
            {iconoOportunidad(item.tipo_oportunidad)}
          </div>
          <div style={styles.evidence}><span>Evidencia</span><strong>{item.evidencia}</strong></div>
          <div style={styles.actions}><Link to={referenciaUrl(item)} style={styles.link}>Abrir origen</Link><Button type="button" onClick={() => preparar(item)}><CalendarPlus size={16} /> Crear seguimiento</Button></div>
          {seleccionada?.tipo_oportunidad === item.tipo_oportunidad && seleccionada?.referencia_id === item.referencia_id && (
            <div style={styles.confirmBox}>
              <label style={styles.field}>Responsable<select value={confirmacion.responsable} onChange={(e) => setConfirmacion((prev) => ({ ...prev, responsable: e.target.value }))} style={styles.select}>{responsables.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}</select></label>
              <label style={styles.field}>Fecha<input type="date" value={confirmacion.fecha} onChange={(e) => setConfirmacion((prev) => ({ ...prev, fecha: e.target.value }))} style={styles.select} /></label>
              <label style={styles.field}>Prioridad<select value={confirmacion.prioridad} onChange={(e) => setConfirmacion((prev) => ({ ...prev, prioridad: e.target.value }))} style={styles.select}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="baja">Baja</option></select></label>
              <div style={styles.confirmActions}><Button type="button" variant="outline" onClick={() => setSeleccionada(null)}>Volver</Button><Button type="button" disabled={guardando} onClick={confirmar}>{guardando ? "Creando..." : "Confirmar tarea"}</Button></div>
            </div>
          )}
        </article>
      ))}</div>}
      {!loading && data?.total > PAGE_SIZE && (
        <div style={styles.pagination}>
          <span>Mostrando {pagina * PAGE_SIZE + 1}-{Math.min((pagina + 1) * PAGE_SIZE, data.total)} de {data.total}</span>
          <div style={styles.paginationActions}>
            <Button type="button" variant="outline" disabled={pagina === 0} onClick={() => setPagina((value) => Math.max(0, value - 1))}>Anterior</Button>
            <Button type="button" variant="outline" disabled={(pagina + 1) * PAGE_SIZE >= data.total} onClick={() => setPagina((value) => value + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function referenciaUrl(item) {
  if (item.tipo_oportunidad === "cotizacion") return `/cotizaciones/${item.referencia_id}`;
  if (item.tipo_oportunidad === "reserva") return `/reservas/${item.referencia_id}`;
  if (item.tipo_oportunidad === "postventa") return `/postventa/${item.referencia_id}`;
  return `/clientes/${item.id_cliente}/bicicletas/${item.referencia_id}`;
}

function tipoLabel(tipo) {
  return { service: "Service", cotizacion: "Presupuesto", reserva: "Reserva", postventa: "Postventa" }[tipo] || tipo;
}

function prioridadLabel(prioridad) {
  return { urgente: "Urgente", alta: "Prioridad alta", normal: "Normal", baja: "Baja" }[prioridad] || prioridad;
}

function iconoOportunidad(tipo) {
  if (tipo === "service") return <Bike size={24} color={colors.primary} />;
  if (tipo === "postventa") return <ShieldCheck size={24} color={colors.danger} />;
  return <FileCheck2 size={24} color={colors.secondary} />;
}

const styles = {
  page: { display: "grid", gap: spacing.md },
  filters: { display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(180px, .35fr)", gap: 10, alignItems: "end" },
  filtersMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  search: { minHeight: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceMuted },
  searchInput: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontSize: 14 },
  field: { display: "grid", gap: 4, color: colors.textMuted, fontSize: 12, fontWeight: 800 },
  select: { minHeight: 42, width: "100%", boxSizing: "border-box", border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "0 10px", background: colors.surface, fontWeight: 700 },
  error: { background: colors.dangerSoft, color: colors.dangerDark, borderRadius: radius.md, padding: 10, fontWeight: 700 },
  list: { display: "grid", gap: 10 },
  card: { display: "grid", gap: 12, padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardTitle: { display: "grid", gap: 5, minWidth: 0 },
  badges: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  kind: { color: colors.textMuted, fontSize: 12, fontWeight: 800, textTransform: "uppercase" },
  client: { color: colors.secondary, fontWeight: 800 },
  evidence: { display: "grid", gap: 4, padding: 10, borderRadius: radius.sm, background: colors.surfaceMuted },
  actions: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" },
  link: { color: colors.secondary, fontWeight: 800, textDecoration: "none" },
  confirmBox: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, paddingTop: 12, borderTop: `1px solid ${colors.border}` },
  confirmActions: { display: "flex", justifyContent: "flex-end", alignItems: "end", gap: 8, gridColumn: "1 / -1", flexWrap: "wrap" },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", color: colors.textMuted, fontSize: 13, fontWeight: 800 },
  paginationActions: { display: "flex", gap: 8 },
};
