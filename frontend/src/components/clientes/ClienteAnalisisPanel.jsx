import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CalendarClock, CircleDollarSign } from "lucide-react";
import { Badge, Card, EmptyState, MetricCard, ResponsiveMetricsGrid, useBreakpoint } from "../ui";
import { obtenerAnalisisCliente } from "../../services/clientesService";
import { formatMoney, formatNumber, formatPercent } from "../../utils/formatters";
import { colors, radius, spacing, typography } from "../../theme";

const PERIODOS = [
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "365d", label: "12 meses" },
  { id: "all", label: "Historico" },
];

const badgeVariant = {
  danger: "danger",
  warning: "warning",
  success: "success",
  info: "default",
  neutral: "default",
};

export default function ClienteAnalisisPanel({ clienteId }) {
  const [periodo, setPeriodo] = useState("365d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMobile = useBreakpoint();

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      try {
        setLoading(true);
        setError("");
        const resultado = await obtenerAnalisisCliente(clienteId, periodo);
        if (vigente) setData(resultado);
      } catch (err) {
        if (vigente) setError(err.message || "No se pudo cargar el analisis del cliente");
      } finally {
        if (vigente) setLoading(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [clienteId, periodo]);

  const maxVentaMensual = useMemo(
    () => Math.max(...(data?.evolucion_mensual || []).map((item) => Number(item.ventas_netas || 0)), 0),
    [data],
  );

  if (loading && !data) {
    return <EmptyState title="Calculando analisis..." description="Revisando ventas, costos, taller y saldos del cliente." />;
  }

  if (error && !data) {
    return <EmptyState title="No se pudo cargar el analisis" description={error} />;
  }

  if (!data) return null;

  const resumen = data.resumen || {};
  const actividad = data.actividad || {};
  const financiero = data.estado_financiero || {};
  const puedeVerRentabilidad = Boolean(data.puede_ver_rentabilidad);

  return (
    <div style={styles.stack}>
      <Card bodyStyle={{ padding: isMobile ? 12 : 16 }}>
        <div style={isMobile ? styles.toolbarMobile : styles.toolbar}>
          <div>
            <p style={styles.kicker}>Periodo de analisis</p>
            <p style={styles.periodText}>
              {formatDateOnly(data.periodo?.fecha_desde)} al {formatDateOnly(data.periodo?.fecha_hasta)}
            </p>
          </div>
          <div style={isMobile ? styles.segmentedMobile : styles.segmented} role="group" aria-label="Periodo de analisis">
            {PERIODOS.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => setPeriodo(opcion.id)}
                style={{
                  ...styles.segmentButton,
                  ...(periodo === opcion.id ? styles.segmentButtonActive : {}),
                }}
                aria-pressed={periodo === opcion.id}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && <div style={styles.error}>{error}</div>}

      <ResponsiveMetricsGrid minWidth={180} mobileColumns={2}>
        <MetricCard
          label="Ventas netas"
          value={formatMoney(resumen.ventas_netas)}
          tone="primary"
          emphasize
          footer={isMobile ? comparacionCompacta(data.comparacion?.ventas_netas) : comparacionTexto(data.comparacion?.ventas_netas)}
          valueStyle={isMobile ? styles.mobileMetricValue : {}}
        />
        <MetricCard
          label="Operaciones"
          value={resumen.cantidad_operaciones || 0}
          emphasize
          footer={isMobile ? comparacionCompacta(data.comparacion?.cantidad_operaciones, false) : comparacionTexto(data.comparacion?.cantidad_operaciones, false)}
          valueStyle={isMobile ? styles.mobileMetricValue : {}}
        />
        <MetricCard
          label="Ticket promedio"
          value={formatMoney(resumen.ticket_promedio)}
          footer={isMobile ? comparacionCompacta(data.comparacion?.ticket_promedio) : comparacionTexto(data.comparacion?.ticket_promedio)}
          valueStyle={isMobile ? styles.mobileMetricValue : {}}
        />
        {puedeVerRentabilidad && (
          <MetricCard
            label="Ganancia comercial"
            value={formatMoney(resumen.ganancia_comercial)}
            tone="success"
            emphasize
            footer={`${resumen.margen_porcentaje == null ? "Sin margen calculable" : `${formatPercent(resumen.margen_porcentaje)} sobre ventas`} · antes de gastos`}
            valueStyle={isMobile ? styles.mobileMetricValue : {}}
          />
        )}
        <MetricCard
          label="Ultima actividad"
          value={actividad.ultima_actividad_fecha ? formatDateOnly(actividad.ultima_actividad_fecha) : "Sin actividad"}
          tone={Number(actividad.dias_desde_ultima_actividad || 0) >= 90 ? "warning" : "default"}
          footer={actividad.dias_desde_ultima_actividad == null ? "Todavia no hay movimientos" : `Hace ${actividad.dias_desde_ultima_actividad} dias`}
          valueStyle={isMobile ? styles.mobileMetricValue : {}}
        />
        <MetricCard
          label="Taller"
          value={`${actividad.ordenes_taller_periodo || 0} OT`}
          footer={`${actividad.bicicletas_registradas || 0} bicicleta(s) registrada(s)`}
          valueStyle={isMobile ? styles.mobileMetricValue : {}}
        />
      </ResponsiveMetricsGrid>

      <Card>
        <div style={isMobile ? styles.singleColumn : styles.readingGrid}>
          <div>
            <SectionTitle Icon={Activity} title="Lectura rapida" />
            <p style={styles.reading}>{data.lectura}</p>
          </div>
          <div style={styles.balanceBox}>
            <span style={styles.balanceLabel}>Situacion actual</span>
            <div style={styles.balanceRows}>
              <BalanceRow label="Deuda vigente" value={financiero.deuda_vigente} tone="danger" />
              <BalanceRow label="Credito disponible" value={financiero.credito_vigente} tone="success" />
            </div>
          </div>
        </div>
        <div style={styles.badges}>
          {(data.segmentos || []).length ? data.segmentos.map((segmento) => (
            <span key={segmento.clave} title={segmento.motivo}>
              <Badge variant={badgeVariant[segmento.tono] || "default"}>{segmento.nombre}</Badge>
            </span>
          )) : <span style={styles.muted}>Sin segmentos especiales para este periodo.</span>}
        </div>
      </Card>

      <div style={isMobile ? styles.singleColumn : styles.twoColumns}>
        <Card title="Evolucion mensual" subtitle="Ventas del periodo y cantidad de operaciones.">
          {(data.evolucion_mensual || []).length ? (
            <div style={styles.monthList}>
              {data.evolucion_mensual.map((mes) => (
                <div key={mes.mes} style={styles.monthRow}>
                  <div style={styles.monthHeader}>
                    <strong>{formatMonth(mes.mes)}</strong>
                    <span>{formatMoney(mes.ventas_netas)} · {mes.cantidad_operaciones} op.</span>
                  </div>
                  <div style={styles.track}>
                    <div
                      style={{
                        ...styles.bar,
                        width: `${maxVentaMensual ? Math.max((Number(mes.ventas_netas || 0) / maxVentaMensual) * 100, 2) : 0}%`,
                      }}
                    />
                  </div>
                  {puedeVerRentabilidad && (
                    <small style={styles.monthProfit}>Ganancia {formatMoney(mes.ganancia_comercial)}</small>
                  )}
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin ventas en este periodo" description="Probá con un periodo más amplio." />}
        </Card>

        <Card title="Productos y servicios principales" subtitle="Ordenados por importe vendido en el periodo.">
          {(data.productos_principales || []).length ? (
            <div style={styles.productList}>
              {data.productos_principales.map((producto, index) => (
                <div key={`${producto.nombre}-${producto.variante || ""}`} style={styles.productRow}>
                  <span style={styles.rank}>{index + 1}</span>
                  <div style={styles.productText}>
                    <strong>{producto.nombre}</strong>
                    {producto.variante && <span>{producto.variante}</span>}
                    <small>{formatNumber(producto.cantidad)} unidad(es) · {producto.cantidad_operaciones} operación(es)</small>
                  </div>
                  <strong style={styles.productAmount}>{formatMoney(producto.ventas_netas)}</strong>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin productos para mostrar" description="No hay operaciones comerciales en el periodo." />}
        </Card>
      </div>

      <Card
        title="Actividad por rubro"
        subtitle={puedeVerRentabilidad ? "Ventas, costos y ganancia comercial antes de gastos operativos." : "Ventas y movimiento comercial por rubro."}
      >
        {(data.rubros || []).length ? (
          isMobile ? (
            <div style={styles.rubroCards}>
              {data.rubros.map((rubro) => (
                <div key={rubro.clave} style={styles.rubroCard}>
                  <div style={styles.rubroCardHeader}>
                    <strong>{rubro.nombre}</strong>
                    <strong>{formatMoney(rubro.ventas_netas)}</strong>
                  </div>
                  <div style={styles.rubroCardMetrics}>
                    <span>{rubro.cantidad_operaciones} operaciones</span>
                    <span>{formatNumber(rubro.cantidad_unidades)} unidades</span>
                    {puedeVerRentabilidad && <span>Ganancia {formatMoney(rubro.ganancia_comercial)}</span>}
                    {puedeVerRentabilidad && <span>Margen {rubro.margen_porcentaje == null ? "-" : formatPercent(rubro.margen_porcentaje)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Rubro</th>
                  <th style={styles.thNumber}>Operaciones</th>
                  <th style={styles.thNumber}>Unidades</th>
                  <th style={styles.thNumber}>Ventas</th>
                  {puedeVerRentabilidad && <th style={styles.thNumber}>Costo</th>}
                  {puedeVerRentabilidad && <th style={styles.thNumber}>Ganancia</th>}
                  {puedeVerRentabilidad && <th style={styles.thNumber}>Margen</th>}
                </tr>
              </thead>
              <tbody>
                {data.rubros.map((rubro) => (
                  <tr key={rubro.clave}>
                    <td style={styles.td}><strong>{rubro.nombre}</strong></td>
                    <td style={styles.tdNumber}>{rubro.cantidad_operaciones}</td>
                    <td style={styles.tdNumber}>{formatNumber(rubro.cantidad_unidades)}</td>
                    <td style={styles.tdNumber}>{formatMoney(rubro.ventas_netas)}</td>
                    {puedeVerRentabilidad && <td style={styles.tdNumber}>{formatMoney(rubro.costo_mercaderia)}</td>}
                    {puedeVerRentabilidad && <td style={{ ...styles.tdNumber, color: colors.successDark, fontWeight: 800 }}>{formatMoney(rubro.ganancia_comercial)}</td>}
                    {puedeVerRentabilidad && <td style={styles.tdNumber}>{rubro.margen_porcentaje == null ? "-" : formatPercent(rubro.margen_porcentaje)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin actividad por rubro" description="No hay ventas válidas dentro del periodo elegido." />}
      </Card>

      {puedeVerRentabilidad && data.calidad_datos && (
        <Card>
          <SectionTitle Icon={BarChart3} title="Control de los numeros" />
          <div style={data.calidad_datos.valida ? styles.qualityOk : styles.qualityWarning}>
            <strong>{data.calidad_datos.valida ? "El detalle coincide con el resumen." : "Hay diferencias que revisar."}</strong>
            <span>
              {data.calidad_datos.servicios_costo_cero || 0} servicio(s) con costo directo cero · {data.calidad_datos.mercaderia_sin_costo || 0} mercadería(s) sin costo cargado.
            </span>
          </div>
          {(data.calidad_datos.notas || []).map((nota) => <p key={nota} style={styles.qualityNote}>{nota}</p>)}
        </Card>
      )}
    </div>
  );
}

function SectionTitle({ Icon, title }) {
  return (
    <div style={styles.sectionTitle}>
      <Icon size={18} aria-hidden="true" />
      <h3 style={styles.sectionTitleText}>{title}</h3>
    </div>
  );
}

function BalanceRow({ label, value, tone }) {
  const amount = Number(value || 0);
  const icon = tone === "danger" ? <CalendarClock size={16} /> : <CircleDollarSign size={16} />;
  return (
    <div style={styles.balanceRow}>
      <span>{icon}{label}</span>
      <strong style={{ color: amount > 0 ? (tone === "danger" ? colors.dangerDark : colors.successDark) : colors.text }}>
        {formatMoney(amount)}
      </strong>
    </div>
  );
}

function comparacionTexto(comparacion, dinero = true) {
  if (!comparacion) return "Sin comparación para este periodo";
  const diferencia = Number(comparacion.diferencia || 0);
  const signo = diferencia > 0 ? "+" : "";
  const valor = dinero ? formatMoney(diferencia) : formatNumber(diferencia);
  const porcentaje = comparacion.variacion_porcentaje == null
    ? "sin porcentaje comparable"
    : `${signo}${formatPercent(comparacion.variacion_porcentaje)}`;
  return `${signo}${valor} vs. periodo anterior · ${porcentaje}`;
}

function comparacionCompacta(comparacion, dinero = true) {
  if (!comparacion) return "Sin comparacion";
  const diferencia = Number(comparacion.diferencia || 0);
  const signo = diferencia > 0 ? "+" : "";
  return `Vs. anterior: ${signo}${dinero ? formatMoney(diferencia) : formatNumber(diferencia)}`;
}

function formatMonth(value) {
  const [year, month] = String(value).split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatDateOnly(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const styles = {
  stack: { display: "grid", gap: spacing.md },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  toolbarMobile: { display: "grid", gap: 10 },
  kicker: { margin: 0, color: colors.textMuted, fontSize: 12, fontWeight: 800, textTransform: "uppercase" },
  periodText: { margin: "3px 0 0", fontWeight: 800, color: colors.textStrong },
  segmented: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: "hidden", minWidth: 0 },
  segmentedMobile: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: "hidden", minWidth: 0 },
  segmentButton: { border: 0, borderRight: `1px solid ${colors.border}`, background: colors.surface, color: colors.textMuted, padding: "9px 12px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  segmentButtonActive: { background: colors.textStrong, color: colors.surface },
  error: { border: `1px solid ${colors.danger}`, background: colors.dangerSoft, color: colors.dangerDark, borderRadius: radius.md, padding: 12, fontWeight: 700 },
  readingGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(240px, .8fr)", gap: spacing.lg, alignItems: "start" },
  singleColumn: { display: "grid", gap: spacing.md },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: spacing.md },
  sectionTitle: { display: "flex", alignItems: "center", gap: 8, color: colors.textStrong },
  sectionTitleText: { margin: 0, fontSize: 16, lineHeight: 1.25 },
  reading: { margin: "10px 0 0", color: colors.text, lineHeight: 1.55 },
  balanceBox: { border: `1px solid ${colors.border}`, background: colors.background, borderRadius: radius.md, padding: 12 },
  balanceLabel: { display: "block", marginBottom: 8, color: colors.textMuted, fontWeight: 800, fontSize: 12, textTransform: "uppercase" },
  balanceRows: { display: "grid", gap: 8 },
  balanceRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  badges: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderSoft}` },
  muted: { color: colors.textMuted, fontSize: 13 },
  monthList: { display: "grid", gap: 14 },
  monthRow: { display: "grid", gap: 6 },
  monthHeader: { display: "flex", justifyContent: "space-between", gap: 12, color: colors.text, fontSize: 13 },
  track: { height: 8, background: colors.borderSoft, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: "100%", background: colors.primary, borderRadius: radius.pill },
  monthProfit: { color: colors.successDark, fontWeight: 700 },
  productList: { display: "grid" },
  productRow: { display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", gap: 10, alignItems: "start", padding: "11px 0", borderBottom: `1px solid ${colors.borderSoft}` },
  rank: { width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: radius.sm, background: colors.background, color: colors.textMuted, fontWeight: 900, fontSize: 12 },
  productText: { display: "grid", gap: 2, minWidth: 0, overflowWrap: "anywhere" },
  productAmount: { whiteSpace: "nowrap", color: colors.textStrong },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 720 },
  th: { padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${colors.border}`, color: colors.textMuted, fontSize: 12 },
  thNumber: { padding: "10px 12px", textAlign: "right", borderBottom: `1px solid ${colors.border}`, color: colors.textMuted, fontSize: 12 },
  td: { padding: "12px", borderBottom: `1px solid ${colors.borderSoft}`, color: colors.text },
  tdNumber: { padding: "12px", borderBottom: `1px solid ${colors.borderSoft}`, textAlign: "right", whiteSpace: "nowrap", color: colors.text },
  qualityOk: { display: "grid", gap: 4, marginTop: 10, padding: 12, borderRadius: radius.md, background: colors.successSoft, color: colors.successDark },
  qualityWarning: { display: "grid", gap: 4, marginTop: 10, padding: 12, borderRadius: radius.md, background: colors.warningSoft, color: colors.warningDark },
  qualityNote: { margin: "8px 0 0", color: colors.textMuted, fontSize: typography.small.fontSize },
  mobileMetricValue: { fontSize: 21, lineHeight: 1.05 },
  rubroCards: { display: "grid", gap: 10 },
  rubroCard: { border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: 12, display: "grid", gap: 9 },
  rubroCardHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" },
  rubroCardMetrics: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, color: colors.textMuted, fontSize: 12 },
};
