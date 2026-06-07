import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getDashboardResumen } from "../services/dashboardService";
import { formatMoney, formatInteger, formatNumber } from "../utils/formatters";

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

const input = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

function money(value) {
  return formatMoney(value || 0);
}

function dateShort(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

export default function DashboardPage() {
  const [periodoMes, setPeriodoMes] = useState(mesActual());
  const [diasSinMovimiento, setDiasSinMovimiento] = useState(90);
  const [umbralRepuestosCriticos, setUmbralRepuestosCriticos] = useState(2);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function cargarDashboard() {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboardResumen({
        periodo_mes: periodoMes,
        dias_sin_movimiento: diasSinMovimiento,
        umbral_repuestos_criticos: umbralRepuestosCriticos,
        limit: 10,
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
  }, [periodoMes, diasSinMovimiento, umbralRepuestosCriticos]);

  const k = data?.kpis || {};
  const ventasChartData = data?.ventas_ultimos_meses || [];

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, color: "#101828" }}>Dashboard</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Tablero operativo: ventas, caja, clientes, repuestos, stock inmovilizado y taller.
          </p>
        </div>
        <button style={secondaryButton} onClick={cargarDashboard} disabled={loading}>
          <RefreshCw size={16} />
          Refrescar
        </button>
      </header>

      {error && <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}

      <section style={{ ...card, padding: 16, display: "grid", gridTemplateColumns: "220px 220px 240px", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Mes
          <input style={input} type="date" value={periodoMes} onChange={(e) => setPeriodoMes(e.target.value)} />
        </label>
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
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <Metric title="Ventas mes" value={money(k.ventas_mes)} strong />
        <Metric title="Caja actual" value={money(k.caja_actual)} />
        <Metric title="Gastos mes" value={money(k.gastos_mes)} />
        <Metric title="Deudas clientes" value={money(k.deudas_abiertas)} />
        <Metric title="Créditos clientes" value={money(k.creditos_abiertos)} />
        <Metric title="Ventas pendientes entrega" value={formatInteger(k.ventas_pendientes_entrega)} />
        <Metric title="Taller pendiente" value={formatInteger(k.taller_pendiente)} />
        <Metric title="Repuestos críticos" value={formatInteger(k.repuestos_criticos)} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(340px, .75fr)", gap: 18, alignItems: "start" }}>
        <VentasChartCard rows={ventasChartData} loading={loading} />
        <TopClientesCard rows={data?.top_clientes || []} loading={loading} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <TopProductosCard title="Top productos vendidos" rows={data?.top_productos_cantidad || []} loading={loading} />
        <RepuestosCriticosCard rows={data?.repuestos_criticos || []} loading={loading} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <CapitalInmovilizadoCard rows={data?.capital_inmovilizado || []} loading={loading} />
        <VentasPendientesEntregaCard rows={data?.ventas_pendientes_entrega || []} loading={loading} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <TallerPendienteCard rows={data?.taller_pendiente || []} loading={loading} />
        <ProductosSinMovimientoCard rows={data?.productos_sin_movimiento || []} loading={loading} />
      </section>
    </div>
  );
}

function Metric({ title, value, strong = false }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ color: strong ? "#f97316" : "#101828", fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
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

function TopProductosCard({ title, rows, loading }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>{title}</h2>
      <TableState loading={loading} empty={rows.length === 0} colSpan={3} />
      {!loading && rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
              <th style={{ padding: 10 }}>Producto</th>
              <th style={{ padding: 10 }}>Cantidad</th>
              <th style={{ padding: 10 }}>Venta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={`${p.id_variante}-${p.producto}`} style={{ borderBottom: "1px solid #f2f4f7" }}>
                <td style={{ padding: 10 }}><strong>{p.producto}</strong><div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div></td>
                <td style={{ padding: 10, fontWeight: 900 }}>{formatNumber(p.cantidad_vendida)}</td>
                <td style={{ padding: 10, fontWeight: 900 }}>{money(p.venta_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function RepuestosCriticosCard({ rows, loading }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <h2 style={{ margin: "0 0 4px" }}>Repuestos críticos</h2>
      <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 13 }}>Excluye bicicletas para evitar falsas alertas por unidades de exhibición o depósito.</p>
      <TableState loading={loading} empty={rows.length === 0} colSpan={3} />
      {!loading && rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}><th style={{ padding: 10 }}>Producto</th><th style={{ padding: 10 }}>Stock</th><th style={{ padding: 10 }}>Costo</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.id_variante} style={{ borderBottom: "1px solid #f2f4f7" }}><td style={{ padding: 10 }}><strong>{p.producto}</strong><div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div></td><td style={{ padding: 10, fontWeight: 900 }}>{formatNumber(p.stock_fisico)}</td><td style={{ padding: 10 }}>{money(p.costo_promedio_vigente)}</td></tr>)}</tbody>
        </table>
      ) : null}
    </div>
  );
}

function CapitalInmovilizadoCard({ rows, loading }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <h2 style={{ margin: "0 0 4px" }}>Capital inmovilizado</h2>
      <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 13 }}>Productos no bicicleta ordenados por plata quieta en stock.</p>
      <TableState loading={loading} empty={rows.length === 0} colSpan={3} />
      {!loading && rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}><th style={{ padding: 10 }}>Producto</th><th style={{ padding: 10 }}>Stock</th><th style={{ padding: 10 }}>Capital</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.id_variante} style={{ borderBottom: "1px solid #f2f4f7" }}><td style={{ padding: 10 }}><strong>{p.producto}</strong><div style={{ color: "#667085", fontSize: 12 }}>{p.variante || "-"}</div></td><td style={{ padding: 10 }}>{formatNumber(p.stock_fisico)}</td><td style={{ padding: 10, fontWeight: 900 }}>{money(p.capital_inmovilizado)}</td></tr>)}</tbody>
        </table>
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
  return (
    <section style={{ ...card, padding: 16 }}>
      <h2 style={{ margin: "0 0 4px" }}>Productos sin movimiento</h2>
      <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 13 }}>Excluye bicicletas. Muestra stock físico inmovilizado según última venta registrada.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
              <th style={{ padding: 10 }}>Producto</th>
              <th style={{ padding: 10 }}>Variante</th>
              <th style={{ padding: 10 }}>Stock</th>
              <th style={{ padding: 10 }}>Última venta</th>
              <th style={{ padding: 10 }}>Días</th>
              <th style={{ padding: 10 }}>Capital inmovilizado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="6" style={{ padding: 18 }}>Cargando...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" style={{ padding: 18, color: "#667085" }}>Sin productos para mostrar</td></tr> : rows.map((p) => (
              <tr key={p.id_variante} style={{ borderBottom: "1px solid #f2f4f7" }}>
                <td style={{ padding: 10, fontWeight: 800 }}>{p.producto}</td>
                <td style={{ padding: 10 }}>{p.variante || "-"}</td>
                <td style={{ padding: 10 }}>{formatNumber(p.stock_fisico)}</td>
                <td style={{ padding: 10 }}>{dateShort(p.ultima_venta) || "Nunca"}</td>
                <td style={{ padding: 10 }}>{p.dias_sin_movimiento ?? "-"}</td>
                <td style={{ padding: 10, fontWeight: 900 }}>{money(p.capital_inmovilizado)}</td>
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
      <h2 style={{ margin: "0 0 12px" }}>{title}</h2>
      {loading ? <p>Cargando...</p> : rows.length === 0 ? <p style={{ color: "#667085" }}>{emptyText}</p> : <div style={{ display: "grid" }}>{rows.map(renderRow)}</div>}
    </div>
  );
}

function TableState({ loading, empty }) {
  if (loading) return <div style={{ padding: 18 }}>Cargando...</div>;
  if (empty) return <div style={{ padding: 18, color: "#667085" }}>Sin datos</div>;
  return null;
}
