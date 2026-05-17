import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PagoVentaPanel from "../components/pagos/PagoVentaPanel";
import { obtenerVenta } from "../services/ventasService";
import { listarPagosDeVenta } from "../services/pagosService";
import { EstadoVentaBadge } from "./VentasListPage";
import { formatDateTime, formatMoney } from "../utils/formatters";

export default function VentaCobroPage() {
  const { ventaId } = useParams();

  const [data, setData] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarTodo();
  }, [ventaId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");

      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el cobro");
    } finally {
      setLoading(false);
    }
  }

  const totalPagadoReal = useMemo(() => {
    return pagos
      .filter((p) => p.estado === "confirmado")
      .reduce((acc, p) => acc + Number(p.monto_total_cobrado || 0), 0);
  }, [pagos]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando cobro...</p>;
  if (!data) return <p style={{ padding: "24px" }}>No se encontró la venta.</p>;

  const { venta } = data;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Cobro venta #{venta.id}</h1>
          <p style={mutedStyle}>
            {ormatDateTime(venta.fecha)} · {venta.cliente_nombre} · {venta.sucursal_nombre}
          </p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarTodo}>Refrescar</button>
          <Link to={`/ventas/${venta.id}`} style={linkBtnStyle}>
            Volver al detalle
          </Link>
        </div>
      </header>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={heroStyle}>
        <HeroMetric label="Total venta" value={formatMoney(venta.total_final)} />
        <HeroMetric label="Pagado real" value={formatMoney(totalPagadoReal)} tone="ok" />
        <HeroMetric
          label="Saldo pendiente"
          value={formatMoney(venta.saldo_pendiente)}
          tone={Number(venta.saldo_pendiente || 0) > 0 ? "danger" : "ok"}
        />
        <div style={heroMetricStyle}>
          <span>Estado</span>
          <EstadoVentaBadge estado={venta.estado} />
        </div>
      </section>

      <PagoVentaPanel
        ventaId={venta.id}
        saldoPendiente={venta.saldo_pendiente}
        estadoVenta={venta.estado}
        autoFocusPago
        onPagoCambiado={cargarTodo}
      />
    </div>
  );
}

function HeroMetric({ label, value, tone }) {
  const style =
    tone === "ok"
      ? heroMetricOkStyle
      : tone === "danger"
        ? heroMetricDangerStyle
        : heroMetricStyle;

  return (
    <div style={style}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const pageStyle = {
  padding: "24px",
  background: "#f6f7fb",
  minHeight: "100vh",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const mutedStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const linkBtnStyle = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  color: "#111827",
  background: "white",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "16px",
};

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const heroMetricStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  display: "grid",
  gap: "8px",
  color: "#344054",
};

const heroMetricOkStyle = {
  ...heroMetricStyle,
  background: "#ecfdf3",
  borderColor: "#abefc6",
  color: "#067647",
};

const heroMetricDangerStyle = {
  ...heroMetricStyle,
  background: "#fff1f0",
  borderColor: "#fecdca",
  color: "#b42318",
};