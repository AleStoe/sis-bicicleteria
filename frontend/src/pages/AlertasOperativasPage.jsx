import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerAlertasOperativas } from "../services/alertasOperativasService";
import { formatMoney } from "../utils/formatters";

export default function AlertasOperativasPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setData(await obtenerAlertasOperativas());
    } catch (err) {
      setError(err.message || "No se pudieron cargar alertas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Acción diaria</p>
          <h1 style={styles.title}>Alertas operativas</h1>
        </div>
        <button type="button" onClick={cargar} style={styles.secondary}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {data && (
        <section style={styles.grid}>
          <AlertaCard title="Bicis listas +7 días" items={data.bicis_listas} to={(item) => `/taller/${item.id}`} render={(item) => `${item.cliente_nombre} · ${item.marca || ""} ${item.modelo || ""}`} />
          <AlertaCard title="Reservas vencidas" items={data.reservas_vencidas} to={(item) => `/reservas/${item.id}`} render={(item) => `${item.cliente_nombre} · ${formatMoney(item.saldo_estimado || item.saldo_pendiente || 0)} pendiente`} />
          <AlertaCard title="Deudas vencidas" items={data.deudas_vencidas} to={(item) => `/deudas/${item.id}`} render={(item) => `${item.cliente_nombre} · ${formatMoney(item.saldo_actual || item.saldo_pendiente || 0)}`} />
          <AlertaCard title="Taller atrasado" items={data.taller_atrasado} to={(item) => `/taller/${item.id}`} render={(item) => `OT #${item.id} · ${item.cliente_nombre} · ${item.estado}`} />
          <AlertaCard title="Stock crítico" items={data.stock_critico} to={() => "/stock?estado_stock=stock_bajo"} render={(item) => `${item.producto_nombre} ${item.nombre_variante} · disp. ${item.stock_disponible}`} />
        </section>
      )}
    </main>
  );
}

function AlertaCard({ title, items = [], to, render }) {
  return (
    <article style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{title}</h2>
        <strong style={items.length ? styles.countHot : styles.count}>{items.length}</strong>
      </div>
      {items.length === 0 ? (
        <div style={styles.empty}>Sin pendientes.</div>
      ) : (
        <div style={styles.list}>
          {items.slice(0, 12).map((item, index) => (
            <Link key={`${title}-${item.id || item.id_variante}-${index}`} to={to(item)} style={styles.row}>
              <span>{render(item)}</span>
              <small>Ver</small>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

const styles = {
  page: { padding: 20, minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  kicker: { margin: 0, color: "#f97316", fontWeight: 1000, textTransform: "uppercase", fontSize: 12 },
  title: { margin: "3px 0 0", fontSize: 32 },
  secondary: { border: "1px solid #cbd5e1", background: "white", borderRadius: 8, padding: "10px 12px", fontWeight: 900, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, boxShadow: "0 12px 28px rgba(15,23,42,.05)" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 },
  cardTitle: { margin: 0, fontSize: 19 },
  count: { background: "#ecfdf5", color: "#047857", borderRadius: 999, padding: "5px 9px" },
  countHot: { background: "#fff1f0", color: "#b42318", borderRadius: 999, padding: "5px 9px" },
  list: { display: "grid", gap: 8 },
  row: { display: "flex", justifyContent: "space-between", gap: 10, textDecoration: "none", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, fontWeight: 800 },
  empty: { color: "#64748b", fontWeight: 800, padding: 12, background: "#f8fafc", borderRadius: 8 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 12, fontWeight: 800 },
};
