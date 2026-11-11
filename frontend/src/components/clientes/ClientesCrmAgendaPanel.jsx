import { useEffect, useState } from "react";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { useSession } from "../../context/SessionContext";
import { listarAgendaCrm, listarResponsablesCrm } from "../../services/clientesService";
import { colors, radius, spacing } from "../../theme";
import { Button, Card, EmptyState, MetricCard, PageHeader, ResponsiveMetricsGrid, useBreakpoint } from "../ui";
import SearchField from "../ui/SearchField";
import SeguimientoCrmCard from "./SeguimientoCrmCard";

const PAGE_SIZE = 25;
const BANDEJAS = [
  { id: "vencidos", label: "Vencidos", count: "vencidos" },
  { id: "hoy", label: "Hoy", count: "hoy" },
  { id: "proximos", label: "Próximos", count: "proximos" },
  { id: "pendientes", label: "Todos pendientes" },
  { id: "cerrados", label: "Cerrados" },
];

export default function ClientesCrmAgendaPanel() {
  const { usuarioId } = useSession();
  const isMobile = useBreakpoint();
  const [data, setData] = useState(null);
  const [responsables, setResponsables] = useState([]);
  const [bandeja, setBandeja] = useState("vencidos");
  const [responsable, setResponsable] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => setPagina(0), [bandeja, responsable, busqueda]);
  useEffect(() => {
    const timer = setTimeout(cargar, busqueda.trim() ? 300 : 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandeja, responsable, busqueda, pagina]);

  useEffect(() => {
    listarResponsablesCrm().then(setResponsables).catch(() => setResponsables([]));
  }, []);

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      setData(await listarAgendaCrm({
        bandeja,
        id_usuario_responsable: responsable || undefined,
        q: busqueda.trim() || undefined,
        limit: PAGE_SIZE,
        offset: pagina * PAGE_SIZE,
      }));
    } catch (err) {
      setError(err.message || "No se pudo cargar la agenda CRM");
    } finally {
      setLoading(false);
    }
  }

  const totalPaginas = Math.max(Math.ceil(Number(data?.total || 0) / PAGE_SIZE), 1);
  return (
    <div style={styles.page}>
      <PageHeader title="Seguimientos CRM" subtitle="Trabajo pendiente ordenado por fecha. Nada se envía automáticamente." actions={<Button type="button" variant="outline" onClick={cargar}><RefreshCw size={16} /> Refrescar</Button>} />
      {error && <div style={styles.error}>{error}</div>}
      <ResponsiveMetricsGrid minWidth={180} mobileColumns={3}>
        <MetricCard label="Vencidos" value={data?.resumen?.vencidos || 0} tone={(data?.resumen?.vencidos || 0) ? "danger" : "default"} />
        <MetricCard label="Para hoy" value={data?.resumen?.hoy || 0} tone={(data?.resumen?.hoy || 0) ? "warning" : "default"} />
        <MetricCard label="Próximos" value={data?.resumen?.proximos || 0} tone="primary" />
      </ResponsiveMetricsGrid>
      <Card title="Bandeja de trabajo" subtitle="Filtrá por responsable para ver la carga de cada persona.">
        <div style={styles.tabs}>{BANDEJAS.map((item) => <button key={item.id} type="button" onClick={() => setBandeja(item.id)} style={{ ...styles.tab, ...(bandeja === item.id ? styles.tabActive : {}) }}>{item.label}{item.count && data?.resumen ? ` ${data.resumen[item.count] || 0}` : ""}</button>)}</div>
        <div style={isMobile ? styles.filtersMobile : styles.filters}>
          <SearchField value={busqueda} onChange={setBusqueda} onSearch={cargar} placeholder="Cliente, teléfono, motivo o responsable" style={styles.search} inputStyle={styles.searchInput} />
          <label style={styles.field}>Responsable<select value={responsable} onChange={(e) => setResponsable(e.target.value)} style={styles.select}><option value="">Todos</option>{responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <Button type="button" variant={String(responsable) === String(usuarioId) ? "primary" : "outline"} onClick={() => setResponsable(String(responsable) === String(usuarioId) ? "" : usuarioId)}>Mis tareas</Button>
        </div>
      </Card>
      {loading ? <EmptyState icon={CalendarCheck} title="Cargando agenda..." description="Ordenando seguimientos por prioridad y fecha." /> : !data?.items?.length ? <EmptyState icon={CalendarCheck} title="La bandeja está vacía" description="No hay seguimientos que coincidan con estos filtros." /> : <div style={styles.list}>{data.items.map((item) => <SeguimientoCrmCard key={item.id} seguimiento={item} responsables={responsables} actorId={usuarioId} onChanged={cargar} compacto />)}</div>}
      {data?.total > PAGE_SIZE && <div style={styles.pagination}><Button type="button" variant="outline" disabled={!pagina} onClick={() => setPagina((value) => Math.max(value - 1, 0))}>Anterior</Button><span>Página {pagina + 1} de {totalPaginas}</span><Button type="button" variant="outline" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((value) => value + 1)}>Siguiente</Button></div>}
    </div>
  );
}

const styles = {
  page: { display: "grid", gap: spacing.md },
  error: { border: `1px solid ${colors.danger}`, borderRadius: radius.md, background: colors.dangerSoft, color: colors.dangerDark, padding: 10, fontWeight: 700 },
  tabs: { display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 },
  tab: { minHeight: 40, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, color: colors.text, padding: "0 12px", fontWeight: 800, whiteSpace: "nowrap", cursor: "pointer" },
  tabActive: { borderColor: colors.primary, background: colors.primarySoft, color: colors.primary },
  filters: { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(190px, .45fr) auto", gap: 10, alignItems: "end", marginTop: spacing.md },
  filtersMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: spacing.md },
  search: { minHeight: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceMuted },
  searchInput: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontSize: 14 },
  field: { display: "grid", gap: 4, color: colors.textMuted, fontSize: 12, fontWeight: 800 },
  select: { minHeight: 42, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "0 10px", background: colors.surface, fontWeight: 700 },
  list: { display: "grid", gap: 10 },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 12 },
};
