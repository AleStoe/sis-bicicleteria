import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { getDashboardResumen } from "../services/dashboardService";
import { formatMoney, formatInteger, formatNumber, formatPercent } from "../utils/formatters";
import useMediaQuery from "../hooks/useMediaQuery";

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 14px 34px rgba(15,23,42,.07)",
};

const input = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const tableWrap = {
  width: "100%",
  minWidth: 0,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};

const stickyTh = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  padding: 10,
  background: "#fff",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 80,
  display: "grid",
  placeItems: "center",
  padding: 18,
};

const modalStyle = {
  ...card,
  width: "min(1180px, 96vw)",
  maxHeight: "86vh",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
};

const modalHeaderStyle = {
  padding: 16,
  borderBottom: "1px solid #eaecf0",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const severityStyles = {
  alta: {
    background: "#fff1f0",
    border: "#fecaca",
    color: "#b42318",
    icon: "#dc2626",
  },
  media: {
    background: "#fffbeb",
    border: "#fde68a",
    color: "#92400e",
    icon: "#d97706",
  },
  baja: {
    background: "#eff6ff",
    border: "#bfdbfe",
    color: "#1d4ed8",
    icon: "#2563eb",
  },
};

function money(value) {
  return formatMoney(value || 0);
}

function dateShort(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

export default function DashboardPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1000px)");
  const [periodoMes, setPeriodoMes] = useState(mesActual());
  const [diasSinMovimiento, setDiasSinMovimiento] = useState(90);
  const [umbralRepuestosCriticos, setUmbralRepuestosCriticos] = useState(2);
  const [topProductosLimit, setTopProductosLimit] = useState(25);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [productosVendidosAbierto, setProductosVendidosAbierto] = useState(false);
  const [bicicletasVendidasAbierto, setBicicletasVendidasAbierto] = useState(false);

  async function cargarDashboard() {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboardResumen({
        periodo_mes: periodoMes ? `${periodoMes}-01` : undefined,
        dias_sin_movimiento: diasSinMovimiento,
        umbral_repuestos_criticos: umbralRepuestosCriticos,
        limit: 10,
        top_productos_limit: topProductosLimit,
      });
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoMes, diasSinMovimiento, umbralRepuestosCriticos, topProductosLimit]);

  const k = data?.kpis || {};
  const ventasChartData = data?.ventas_ultimos_meses || [];
  const alertas = data?.alertas_operativas || [];
  const resultadoHoy = data?.resultado_hoy;

  return (
    <div style={{ padding: isMobile ? 12 : 24, display: "grid", gap: isMobile ? 14 : 20, minWidth: 0 }}>
      <header style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, color: "#101828", fontSize: isMobile ? 26 : 32, lineHeight: 1.1 }}>Dashboard Administrativo</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Lectura ejecutiva de ventas, resultado, caja y pendientes del negocio.
          </p>
        </div>
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: "1fr", gap: 8, width: isMobile ? "100%" : undefined }}>
          <label style={{ display: "grid", gap: 4, color: "#475467", fontSize: 12, fontWeight: 800 }}>
            Mes analizado
            <input
              style={{ ...input, minWidth: isMobile ? 0 : 170 }}
              type="month"
              value={periodoMes}
              onChange={(e) => setPeriodoMes(e.target.value)}
            />
          </label>
          <button style={{ ...secondaryButton, alignSelf: "end", width: isMobile ? "100%" : undefined, justifyContent: "center" }} onClick={cargarDashboard} disabled={loading}>
            <RefreshCw size={16} />
            Refrescar
          </button>
        </div>
      </header>

      {error && <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}

      <DashboardHero k={k} alertas={alertas} loading={loading} isMobile={isMobile} />

      <SectionHeader
        eyebrow="Resultado"
        title="Lectura economica del mes"
        subtitle="Venta, utilidad liberada, gastos y caja actual en una primera mirada."
      />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: isMobile ? 8 : 12, minWidth: 0 }}>
        <Metric title="Ventas netas del mes" value={money(k.ventas_mes)} strong loading={loading} />
        <Metric
          title="Resultado distribuible"
          value={money(k.resultado_estimado)}
          tone={Number(k.resultado_estimado || 0) >= 0 ? "positive" : "negative"}
          loading={loading}
        />
        <Metric
          title="Margen comercial"
          value={money(k.margen_bruto_mes)}
          detail={formatPercent(k.margen_bruto_porcentaje || 0, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
          })}
          loading={loading}
        />
        <Metric
          title="Utilidad + financiero"
          value={money(k.margen_real_mes)}
          detail={formatPercent(k.margen_real_porcentaje || 0, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
          })}
          tone={Number(k.margen_real_mes || 0) >= 0 ? "positive" : "negative"}
          loading={loading}
        />
        <Metric title="Gastos del mes" value={money(k.gastos_mes)} loading={loading} />
        <Metric
          title="Ticket promedio"
          value={money(k.ticket_promedio_mes)}
          detail={`${formatInteger(k.cantidad_ventas_mes)} venta(s)`}
          loading={loading}
        />
        <Metric title="Caja actual" value={money(k.caja_actual)} loading={loading} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(280px, .75fr) minmax(0, 1.25fr)", gap: isMobile ? 12 : 18, alignItems: "stretch", minWidth: 0 }}>
        <ResultadoHoyCard resultado={resultadoHoy} loading={loading} />
        <OperacionHoyCard alertas={alertas} loading={loading} caja={data?.caja} isMobile={isMobile} />
      </section>

      <SectionHeader
        eyebrow="Indicadores"
        title="Comercial, cartera y operacion"
        subtitle="Senales compactas para detectar pendientes sin saturar la lectura principal."
      />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: isMobile ? 8 : 12, minWidth: 0 }}>
        <Metric title="Deudas abiertas" value={money(k.deudas_abiertas)} loading={loading} />
        <Metric title="Créditos disponibles" value={money(k.creditos_abiertos)} loading={loading} />
        <Metric title="Pendientes de entrega" value={formatInteger(k.ventas_pendientes_entrega)} loading={loading} />
        <Metric title="Órdenes en taller" value={formatInteger(k.taller_pendiente)} loading={loading} />
        <Metric title="Repuestos críticos" value={formatInteger(k.repuestos_criticos)} loading={loading} />
        <Metric title="Sin movimiento" value={formatInteger(k.productos_sin_movimiento)} loading={loading} />
      </section>

      <SectionHeader
        eyebrow="Filtros"
        title="Parametros del tablero"
        subtitle="Ajustan la lectura sin cambiar datos del sistema."
      />
      <section style={{ ...card, padding: isMobile ? 12 : 14, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(180px, 240px))", gap: 12, minWidth: 0 }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Sin movimiento desde
          <select style={input} value={diasSinMovimiento} onChange={(e) => setDiasSinMovimiento(Number(e.target.value))}>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
            <option value={90}>90 días</option>
            <option value={180}>180 días</option>
            <option value={365}>365 días</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Umbral repuestos críticos
          <input style={input} type="number" min="0" value={umbralRepuestosCriticos} onChange={(e) => setUmbralRepuestosCriticos(Number(e.target.value))} />
        </label>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Productos vendidos
          <select style={input} value={topProductosLimit} onChange={(e) => setTopProductosLimit(Number(e.target.value))}>
            <option value={10}>Top 10</option>
            <option value={25}>Top 25</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
        </label>
      </section>

      <SectionHeader
        eyebrow="Tendencia"
        title="Ventas y clientes"
        subtitle="Evolucion mensual y clientes con mas movimiento en el periodo."
      />
      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.25fr) minmax(340px, .75fr)", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <VentasChartCard rows={ventasChartData} loading={loading} />
        <TopClientesCard rows={data?.top_clientes || []} loading={loading} />
      </section>

      <SectionHeader
        eyebrow="Rankings"
        title="Productos vendidos"
        subtitle="Productos ordenados por venta neta; la cantidad queda como referencia operativa."
      />
      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <TopProductosCard
          title="Top productos por venta neta"
          rows={data?.top_productos_cantidad || []}
          loading={loading}
          onOpenDetails={() => setProductosVendidosAbierto(true)}
        />
        <TopProductosCard
          title="Top bicicletas"
          rows={data?.top_bicicletas_cantidad || []}
          loading={loading}
          onOpenDetails={() => setBicicletasVendidasAbierto(true)}
        />
      </section>

      <SectionHeader
        eyebrow="Stock"
        title="Reposicion y capital inmovilizado"
        subtitle="Productos criticos, mercaderia quieta y pendientes operativos."
      />
      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <RepuestosCriticosCard rows={data?.repuestos_criticos || []} loading={loading} />
        <CapitalInmovilizadoCard rows={data?.capital_inmovilizado || []} loading={loading} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <VentasPendientesEntregaCard rows={data?.ventas_pendientes_entrega || []} loading={loading} />
        <TallerPendienteCard rows={data?.taller_pendiente || []} loading={loading} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <ProductosSinMovimientoCard rows={data?.productos_sin_movimiento || []} loading={loading} />
      </section>

      {productosVendidosAbierto ? (
        <ProductosVendidosModal
          title="Productos por venta neta y stock"
          rows={data?.top_productos_cantidad || []}
          loading={loading}
          onClose={() => setProductosVendidosAbierto(false)}
        />
      ) : null}
      {bicicletasVendidasAbierto ? (
        <ProductosVendidosModal
          title="Bicicletas vendidas y stock"
          rows={data?.top_bicicletas_cantidad || []}
          loading={loading}
          onClose={() => setBicicletasVendidasAbierto(false)}
        />
      ) : null}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
      <div style={{ color: "#f97316", fontSize: 12, fontWeight: 950, letterSpacing: 0, textTransform: "uppercase" }}>{eyebrow}</div>
      <h2 style={{ margin: 0, color: "#101828", fontSize: 22, lineHeight: 1.15 }}>{title}</h2>
      {subtitle ? <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>{subtitle}</p> : null}
    </div>
  );
}

function DashboardHero({ k, alertas, loading, isMobile }) {
  const resultado = Number(k.resultado_estimado || 0);
  const resultadoOk = resultado >= 0;
  const alertaCount = alertas.length;
  const lectura = getDashboardHeroReading(k, alertas, loading);

  return (
    <section
      style={{
        borderRadius: 18,
        padding: isMobile ? 18 : 22,
        background: "linear-gradient(135deg, #1f120d 0%, #331b12 54%, #ff6b00 130%)",
        color: "#fff",
        boxShadow: "0 18px 42px rgba(31, 18, 13, .18)",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.2fr) minmax(320px, .8fr)",
        gap: 18,
        alignItems: "stretch",
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", alignContent: "space-between", gap: 18, minWidth: 0 }}>
        <div>
          <div style={{ color: "#ffb27a", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>Pulso del negocio</div>
          <h2 style={{ margin: "6px 0 0", fontSize: isMobile ? 28 : 38, lineHeight: 1.05 }}>
            {lectura.titulo}
          </h2>
          <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.78)", fontSize: 15, maxWidth: 680 }}>
            {lectura.bajada}
          </p>
          <div
            style={{
              marginTop: 14,
              background: "rgba(255,255,255,.10)",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 14,
              padding: 12,
              maxWidth: 720,
            }}
          >
            <div style={{ color: "#ffb27a", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>Lectura rapida</div>
            <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
              {lectura.puntos.map((punto) => (
                <div key={punto} style={{ display: "grid", gridTemplateColumns: "8px 1fr", gap: 9, alignItems: "start", color: "rgba(255,255,255,.86)", fontSize: 14, lineHeight: 1.35 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "#ffb27a", marginTop: 6 }} />
                  <span>{punto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <HeroChip label={alertaCount ? `${alertaCount} alerta(s)` : "Sin alertas criticas"} tone={alertaCount ? "warn" : "ok"} />
          <HeroChip label={`${formatInteger(k.cantidad_ventas_mes)} venta(s)`} />
          <HeroChip label={`Caja ${money(k.caja_actual)}`} />
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,.12)",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 16,
          padding: 16,
          display: "grid",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div>
          <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13, fontWeight: 850 }}>Resultado distribuible</div>
          <div style={{ marginTop: 4, color: resultadoOk ? "#bbf7d0" : "#fecaca", fontSize: isMobile ? 30 : 38, lineHeight: 1, fontWeight: 1000, overflowWrap: "anywhere" }}>
            {loading ? "..." : money(k.resultado_estimado)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <HeroMiniMetric label="Ventas netas" value={money(k.ventas_mes)} />
          <HeroMiniMetric label="Utilidad + financiero" value={money(k.margen_real_mes)} />
          <HeroMiniMetric label="Gastos" value={money(k.gastos_mes)} />
          <HeroMiniMetric label="Ticket promedio" value={money(k.ticket_promedio_mes)} />
        </div>
      </div>
    </section>
  );
}

function getDashboardHeroReading(k, alertas, loading) {
  if (loading) {
    return {
      titulo: "Leyendo el mes...",
      bajada: "Estoy juntando ventas, caja, pendientes y stock para darte una lectura rapida.",
      puntos: [
        "En unos segundos vas a ver si conviene mirar resultado, operacion o reposicion.",
        "La lectura se arma con datos reales del tablero, sin cambiar ningun calculo.",
        "Si hay pendientes fuertes, aparecen como alertas operativas.",
      ],
    };
  }

  const ventas = Number(k.ventas_mes || 0);
  const resultado = Number(k.resultado_estimado || 0);
  const utilidad = Number(k.margen_real_mes || 0);
  const gastos = Number(k.gastos_mes || 0);
  const caja = Number(k.caja_actual || 0);
  const ventasCantidad = Number(k.cantidad_ventas_mes || 0);
  const gastoSobreVenta = ventas > 0 ? gastos / ventas : 0;
  const alertaCount = alertas.length;

  const titulo = resultado > 0
    ? alertaCount > 0
      ? "Buen mes, con frentes para ordenar"
      : "Mes sano y bien encaminado"
    : ventas > 0
      ? "Hay ventas, pero falta liberar resultado"
      : "Todavia no hay movimiento fuerte";

  const bajada = ventas > 0
    ? `Se vendieron ${money(ventas)} en ${formatInteger(ventasCantidad)} venta(s). El foco ahora es cuidar caja, gastos y pendientes.`
    : "Cuando empiecen a entrar ventas, esta lectura te va a marcar donde mirar primero.";

  const puntos = [];

  if (resultado > 0) {
    puntos.push(`Quedarian ${money(resultado)} como resultado distribuible estimado, despues de utilidad, financiero y gastos.`);
  } else if (ventas > 0) {
    puntos.push("La venta existe, pero todavia no aparece resultado distribuible positivo. Conviene mirar cobros, costos y gastos.");
  } else {
    puntos.push("Sin ventas relevantes en el periodo, el tablero queda principalmente como control de caja y stock.");
  }

  if (alertaCount > 0) {
    puntos.push(`Hay ${formatInteger(alertaCount)} alerta(s) operativa(s): resolviendo eso, el tablero queda mucho mas limpio.`);
  } else {
    puntos.push("No hay alertas criticas visibles: buen momento para revisar reposicion o mercaderia quieta.");
  }

  if (gastoSobreVenta >= 0.12) {
    puntos.push(`Los gastos pesan ${formatPercent(gastoSobreVenta, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} de las ventas; vale la pena mirarlos.`);
  } else if (utilidad > 0) {
    puntos.push(`La utilidad mas financiero viene en ${money(utilidad)} y la caja actual marca ${money(caja)}.`);
  } else {
    puntos.push(`Caja actual: ${money(caja)}. Si hay cobros pendientes, ahi puede estar la diferencia.`);
  }

  return { titulo, bajada, puntos };
}

function HeroChip({ label, tone = "default" }) {
  const colors = tone === "ok"
    ? { background: "rgba(16,185,129,.18)", border: "rgba(187,247,208,.5)", color: "#dcfce7" }
    : tone === "warn"
      ? { background: "rgba(251,191,36,.18)", border: "rgba(253,230,138,.55)", color: "#fef3c7" }
      : { background: "rgba(255,255,255,.12)", border: "rgba(255,255,255,.18)", color: "#fff" };

  return (
    <span style={{ background: colors.background, border: `1px solid ${colors.border}`, color: colors.color, borderRadius: 999, padding: "8px 10px", fontSize: 13, fontWeight: 900 }}>
      {label}
    </span>
  );
}

function HeroMiniMetric({ label, value }) {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,.16)", paddingTop: 10, minWidth: 0 }}>
      <div style={{ color: "rgba(255,255,255,.62)", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 3, color: "#fff", fontSize: 17, fontWeight: 950, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function CardTitle({ title, count }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <span style={{ background: "#f2f4f7", color: "#344054", border: "1px solid #e4e7ec", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900 }}>
        {formatInteger(count)}
      </span>
    </div>
  );
}

function OperacionHoyCard({ alertas, loading, caja, isMobile }) {
  const cajaAbierta = Boolean(caja?.caja_abierta_id);

  return (
    <section style={{ ...card, padding: isMobile ? 12 : 16, display: "grid", gap: 12 }}>
      <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#344054", fontSize: 13, fontWeight: 900 }}>
            {alertas.length ? <AlertTriangle size={16} color="#d97706" /> : <CheckCircle2 size={16} color="#059669" />}
            Operacion de hoy
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 22, color: "#101828" }}>
            {loading ? "Revisando pendientes..." : alertas.length ? `${alertas.length} frente(s) para mirar` : "Sin alertas criticas"}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusPill label={cajaAbierta ? "Caja abierta" : "Caja cerrada"} tone={cajaAbierta ? "ok" : "hot"} />
          <Link to="/alertas-operativas" style={{ ...secondaryButton, textDecoration: "none", padding: "8px 10px" }}>
            Ver alertas
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#667085", fontWeight: 800 }}>Cargando alertas...</div>
      ) : alertas.length === 0 ? (
        <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857", borderRadius: 10, padding: 12, fontWeight: 850 }}>
          No hay vencimientos operativos detectados. Buen momento para revisar stock o cargar movimientos pendientes.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10, minWidth: 0 }}>
          {alertas.slice(0, 6).map((alerta) => (
            <AlertaOperativa key={alerta.tipo} alerta={alerta} />
          ))}
        </div>
      )}
    </section>
  );
}

function ResultadoHoyCard({ resultado, loading }) {
  const valor = Number(resultado?.resultado_estimado || 0);
  const positivo = valor >= 0;
  const Icon = positivo ? TrendingUp : TrendingDown;
  const accent = positivo ? "#059669" : "#dc2626";
  const bg = positivo ? "#ecfdf5" : "#fff1f0";
  const border = positivo ? "#bbf7d0" : "#fecaca";

  return (
    <Link
      to="/rentabilidad"
      style={{
        ...card,
        padding: 16,
        display: "grid",
        alignContent: "space-between",
        gap: 14,
        textDecoration: "none",
        color: "#101828",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ color: "#344054", fontSize: 13, fontWeight: 900 }}>Resultado de hoy</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 1000, color: loading ? "#667085" : accent }}>
            {loading ? "..." : money(resultado?.resultado_estimado)}
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: bg, border: `1px solid ${border}`, display: "grid", placeItems: "center" }}>
          <Icon size={20} color={accent} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <MiniBalanceRow label="Ventas" value={money(resultado?.ventas_total)} />
        <MiniBalanceRow label="Costo mercaderia" value={`- ${money(resultado?.cmv)}`} />
        <MiniBalanceRow label="Gastos" value={`- ${money(resultado?.gastos_operativos)}`} />
      </div>

      <div style={{ color: "#667085", fontSize: 12, fontWeight: 800 }}>
        Estimado segun costos y gastos cargados.
      </div>
    </Link>
  );
}

function MiniBalanceRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: "#667085", fontWeight: 800 }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AlertaOperativa({ alerta }) {
  const tone = severityStyles[alerta.severidad] || severityStyles.baja;

  return (
    <Link
      to={alerta.to}
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr auto",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        background: tone.background,
        border: `1px solid ${tone.border}`,
        borderRadius: 10,
        padding: 12,
        color: tone.color,
        minWidth: 0,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", display: "grid", placeItems: "center" }}>
        <AlertTriangle size={17} color={tone.icon} />
      </div>
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", color: "#101828" }}>{alerta.titulo}</strong>
        <span style={{ display: "block", fontSize: 12, color: "#475467", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {alerta.detalle}
        </span>
      </div>
      <strong style={{ fontSize: 20 }}>{formatInteger(alerta.cantidad)}</strong>
    </Link>
  );
}

function StatusPill({ label, tone }) {
  const style = tone === "ok"
    ? { background: "#ecfdf5", color: "#047857", border: "#bbf7d0" }
    : { background: "#fff1f0", color: "#b42318", border: "#fecaca" };

  return (
    <span style={{ border: `1px solid ${style.border}`, background: style.background, color: style.color, borderRadius: 999, padding: "8px 10px", fontWeight: 950, fontSize: 13 }}>
      {label}
    </span>
  );
}

function Metric({ title, value, strong = false, tone = "default", detail = "", loading = false }) {
  const valueColor = strong
    ? "#f97316"
    : tone === "positive"
      ? "#047857"
      : tone === "negative"
        ? "#b42318"
        : "#101828";

  return (
    <div style={{ ...card, padding: 16, minWidth: 0, minHeight: 94, display: "grid", alignContent: "space-between", gap: 8 }}>
      <div style={{ color: "#667085", fontSize: 13, fontWeight: 850, lineHeight: 1.25 }}>{title}</div>
      <div style={{ color: loading ? "#98a2b3" : valueColor, fontSize: 24, fontWeight: 950, lineHeight: 1.08, overflowWrap: "anywhere" }}>
        {loading ? "..." : value}
      </div>
      {detail ? <div style={{ color: "#667085", fontSize: 12, fontWeight: 750 }}>{detail}</div> : null}
    </div>
  );
}

function VentasChartCard({ rows, loading }) {
  const points = useMemo(() => {
    const values = rows.map((r) => Number(r.ventas_total || 0));
    const max = Math.max(...values, 1);
    return rows.map((r, index) => {
      const x = rows.length <= 1 ? 50 : 8 + (index * 84) / (rows.length - 1);
      const y = 82 - (Number(r.ventas_total || 0) * 64) / max;
      return { ...r, x, y };
    });
  }, [rows]);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = points.length ? `${path} L ${points.at(-1).x} 88 L ${points[0].x} 88 Z` : "";

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Ventas últimos meses</h2>
          <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>Evolución mensual sin ventas anuladas ni devueltas totales.</p>
        </div>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div style={{ marginTop: 14 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 220, display: "block" }}>
            <defs>
              <linearGradient id="ventasGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1="6" y1="88" x2="96" y2="88" stroke="#e5e7eb" strokeWidth="0.8" />
            <line x1="6" y1="55" x2="96" y2="55" stroke="#f2f4f7" strokeWidth="0.6" />
            <line x1="6" y1="22" x2="96" y2="22" stroke="#f2f4f7" strokeWidth="0.6" />
            {area ? <path d={area} fill="url(#ventasGradient)" /> : null}
            {path ? <path d={path} fill="none" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
            {points.map((p) => <circle key={p.periodo} cx={p.x} cy={p.y} r="1.8" fill="#f97316" vectorEffect="non-scaling-stroke" />)}
          </svg>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, 1fr)`, gap: 6 }}>
            {points.map((p) => (
              <div key={p.periodo} style={{ textAlign: "center", fontSize: 12, color: "#667085" }}>
                <div style={{ fontWeight: 800, color: "#344054" }}>{money(p.ventas_total)}</div>
                <div>{p.etiqueta}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopClientesCard({ rows, loading }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>Top clientes</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {loading ? <p>Cargando...</p> : rows.length === 0 ? <p style={{ color: "#667085" }}>Sin datos</p> : rows.map((c, index) => (
          <div key={c.id_cliente} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f2f4f7" }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: "#fff7ed", color: "#f97316", display: "grid", placeItems: "center", fontWeight: 950 }}>{index + 1}</div>
            <div>
              <strong>{c.cliente_nombre}</strong>
              <div style={{ color: "#667085", fontSize: 12 }}>{formatInteger(c.cantidad_compras)} compras · ticket {money(c.ticket_promedio)}</div>
            </div>
            <div style={{ fontWeight: 950 }}>{money(c.total_comprado)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProductosCard({ title, rows, loading, onOpenDetails }) {
  const visibleRows = rows.slice(0, 10);
  const extraRows = Math.max(rows.length - visibleRows.length, 0);

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>{title}</h2>
          <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>Ranking del periodo con stock actual.</p>
        </div>
        <button
          type="button"
          style={{ ...secondaryButton, padding: "8px 10px" }}
          onClick={onOpenDetails}
          disabled={loading || rows.length === 0}
        >
          Ver stock
        </button>
      </div>
      <TableState loading={loading} empty={rows.length === 0} colSpan={3} />
      {!loading && rows.length > 0 ? (
        <div style={tableWrap}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={{ padding: 10 }}>Producto</th>
                <th style={{ padding: 10 }}>Cantidad</th>
                <th style={{ padding: 10 }}>Stock</th>
                <th style={{ padding: 10 }}>Venta neta</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((p) => (
                <tr key={`${p.id_variante}-${p.producto}`} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={{ padding: 10 }}><strong>{p.producto}</strong><div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div></td>
                  <td style={{ padding: 10, fontWeight: 900 }}>{formatNumber(p.cantidad_vendida)}</td>
                  <td style={{ padding: 10 }}>
                    <strong>{formatNumber(p.stock_disponible ?? 0)}</strong>
                    <div style={{ color: "#667085", fontSize: 12 }}>físico {formatNumber(p.stock_fisico ?? 0)}</div>
                  </td>
                  <td style={{ padding: 10, fontWeight: 900 }}>{money(p.venta_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {extraRows > 0 ? (
            <div style={{ padding: "10px 4px 0", color: "#667085", fontSize: 13, fontWeight: 800 }}>
              Hay {extraRows} más en Ver stock.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProductosVendidosModal({ title, rows, loading, onClose }) {
  return (
    <div style={modalOverlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <header style={modalHeaderStyle}>
          <div>
            <h2 style={{ margin: "0 0 4px", color: "#101828" }}>{title}</h2>
            <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>
              Ranking del periodo cruzado con stock actual. Sirve para mirar qué se vendió y qué queda.
            </p>
          </div>
          <button type="button" style={secondaryButton} onClick={onClose}>Cerrar</button>
        </header>

        <div style={{ ...tableWrap, overflow: "auto" }}>
          <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={{ padding: 10 }}>Producto</th>
                <th style={{ padding: 10 }}>Vendido</th>
                <th style={{ padding: 10 }}>Venta neta</th>
                <th style={{ padding: 10 }}>Margen</th>
                <th style={{ padding: 10 }}>Físico</th>
                <th style={{ padding: 10 }}>Reservado</th>
                <th style={{ padding: 10 }}>Pendiente entrega</th>
                <th style={{ padding: 10 }}>Disponible</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ padding: 18 }}>Cargando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 18, color: "#667085" }}>Sin productos vendidos para mostrar</td></tr>
              ) : rows.map((p) => (
                <tr key={`modal-${p.id_variante}-${p.producto}`} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={{ padding: 10 }}>
                    <strong>{p.producto}</strong>
                    <div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div>
                  </td>
                  <td style={{ padding: 10, fontWeight: 900 }}>{formatNumber(p.cantidad_vendida)}</td>
                  <td style={{ padding: 10, fontWeight: 900 }}>{money(p.venta_total)}</td>
                  <td style={{ padding: 10 }}>{money(p.margen_bruto)}</td>
                  <td style={{ padding: 10 }}>{formatNumber(p.stock_fisico ?? 0)}</td>
                  <td style={{ padding: 10 }}>{formatNumber(p.stock_reservado ?? 0)}</td>
                  <td style={{ padding: 10 }}>{formatNumber(p.stock_vendido_pendiente_entrega ?? 0)}</td>
                  <td style={{ padding: 10, fontWeight: 950, color: Number(p.stock_disponible || 0) <= 0 ? "#b42318" : "#027a48" }}>
                    {formatNumber(p.stock_disponible ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RepuestosCriticosCard({ rows, loading }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <CardTitle title="Repuestos criticos" count={rows.length} />
      <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 13 }}>Piezas bajo umbral que conviene mirar antes de hacer pedido.</p>
      <TableState loading={loading} empty={rows.length === 0} colSpan={3} />
      {!loading && rows.length > 0 ? (
        <div style={{ ...tableWrap, maxHeight: 330, overflow: "auto", borderTop: "1px solid #f2f4f7" }}>
          <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}><th style={stickyTh}>Producto</th><th style={stickyTh}>Stock</th><th style={stickyTh}>Costo</th></tr></thead>
            <tbody>{rows.map((p) => <tr key={p.id_variante} style={{ borderBottom: "1px solid #f2f4f7" }}><td style={{ padding: 10 }}><strong>{p.producto}</strong><div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div></td><td style={{ padding: 10, fontWeight: 900 }}>{formatNumber(p.stock_fisico)}</td><td style={{ padding: 10 }}>{money(p.costo_promedio_vigente)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
function CapitalInmovilizadoCard({ rows, loading }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <CardTitle title="Capital inmovilizado" count={rows.length} />
      <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 13 }}>Productos no bicicleta ordenados por plata quieta en stock.</p>
      <TableState loading={loading} empty={rows.length === 0} colSpan={3} />
      {!loading && rows.length > 0 ? (
        <div style={{ ...tableWrap, maxHeight: 330, overflow: "auto", borderTop: "1px solid #f2f4f7" }}>
          <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}><th style={stickyTh}>Producto</th><th style={stickyTh}>Stock</th><th style={stickyTh}>Capital</th></tr></thead>
            <tbody>{rows.map((p) => <tr key={p.id_variante} style={{ borderBottom: "1px solid #f2f4f7" }}><td style={{ padding: 10 }}><strong>{p.producto}</strong><div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div></td><td style={{ padding: 10 }}>{formatNumber(p.stock_fisico)}</td><td style={{ padding: 10, fontWeight: 900 }}>{money(p.capital_inmovilizado)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
function VentasPendientesEntregaCard({ rows, loading }) {
  return (
    <SimpleListCard
      title="Ventas pendientes de entrega"
      loading={loading}
      rows={rows}
      emptyText="Sin ventas pendientes de entrega"
      renderRow={(v) => (
        <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px solid #f2f4f7" }}>
          <strong>#{v.id} · {v.cliente_nombre}</strong>
          <div style={{ color: "#667085", fontSize: 12 }}>{v.estado} · {dateShort(v.fecha)} · {formatNumber(v.cantidad_items)} ítems</div>
          <div style={{ color: "#475467", fontSize: 13 }}>Total {money(v.total_final)} · saldo {money(v.saldo_pendiente)}</div>
        </div>
      )}
    />
  );
}

function TallerPendienteCard({ rows, loading }) {
  return (
    <SimpleListCard
      title="Taller pendiente"
      loading={loading}
      rows={rows}
      emptyText="Sin órdenes pendientes"
      renderRow={(o) => (
        <div key={o.id} style={{ padding: "10px 0", borderBottom: "1px solid #f2f4f7" }}>
          <strong>#{o.id} · {o.cliente_nombre}</strong>
          <div style={{ color: "#667085", fontSize: 12 }}>{o.estado} · {dateShort(o.fecha_ingreso)}</div>
          <div style={{ color: "#475467", fontSize: 13 }}>{o.problema_reportado}</div>
        </div>
      )}
    />
  );
}

function ProductosSinMovimientoCard({ rows, loading }) {
  const headerCellStyle = {
    padding: "10px 8px",
    whiteSpace: "nowrap",
  };

  return (
    <section style={{ ...card, padding: 16 }}>
      <CardTitle title="Productos sin movimiento" count={rows.length} />
      <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 13 }}>Mercaderia quieta ordenada por capital inmovilizado.</p>
      <div style={{ ...tableWrap, maxHeight: 360, overflow: "auto", borderTop: "1px solid #f2f4f7" }}>
        <table style={{ width: "100%", minWidth: 650, tableLayout: "fixed", borderCollapse: "collapse", fontSize: 14 }}>
          <colgroup>
            <col style={{ width: "48%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
              <th style={{ ...stickyTh, ...headerCellStyle }}>Producto</th>
              <th style={{ ...stickyTh, ...headerCellStyle }}>Variante</th>
              <th style={{ ...stickyTh, ...headerCellStyle }}>Stock</th>
              <th style={{ ...stickyTh, ...headerCellStyle }}>Ult. venta</th>
              <th style={{ ...stickyTh, ...headerCellStyle }}>Dias</th>
              <th style={{ ...stickyTh, ...headerCellStyle, textAlign: "right" }}>Capital</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="6" style={{ padding: 18 }}>Cargando...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" style={{ padding: 18, color: "#667085" }}>Sin productos para mostrar</td></tr> : rows.map((p) => (
              <tr key={p.id_variante} style={{ borderBottom: "1px solid #f2f4f7" }}>
                <td style={{ padding: "12px 8px", fontWeight: 800, overflowWrap: "anywhere" }}>{p.producto}</td>
                <td style={{ padding: "12px 8px", overflowWrap: "anywhere" }}>{p.variante || "-"}</td>
                <td style={{ padding: "12px 8px" }}>{formatNumber(p.stock_fisico)}</td>
                <td style={{ padding: "12px 8px", whiteSpace: "nowrap" }}>{dateShort(p.ultima_venta) || "Nunca"}</td>
                <td style={{ padding: "12px 8px" }}>{p.dias_sin_movimiento ?? "-"}</td>
                <td style={{ padding: "12px 8px", fontWeight: 900, textAlign: "right", whiteSpace: "nowrap" }}>{money(p.capital_inmovilizado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function SimpleListCard({ title, rows, loading, emptyText, renderRow }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <CardTitle title={title} count={rows.length} />
      {loading ? <p>Cargando...</p> : rows.length === 0 ? <p style={{ color: "#667085" }}>{emptyText}</p> : (
        <div style={{ display: "grid", maxHeight: 330, overflow: "auto", borderTop: "1px solid #f2f4f7" }}>{rows.map(renderRow)}</div>
      )}
    </div>
  );
}
function TableState({ loading, empty }) {
  if (loading) return <div style={{ padding: 18 }}>Cargando...</div>;
  if (empty) return <div style={{ padding: 18, color: "#667085" }}>Sin datos</div>;
  return null;
}


