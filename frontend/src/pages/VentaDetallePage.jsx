import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  obtenerVenta,
  anularVenta,
  listarPagosDeVenta,
} from "../services/ventasService";

export default function VentaDetallePage() {
  const { ventaId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarVenta();
  }, [ventaId]);

  async function cargarVenta() {
    try {
      setLoading(true);
      setError("");

      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData);
    } catch (err) {
      setError(err.message || "No se pudo cargar la venta");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnularVenta() {
    const confirmar = window.confirm("¿Seguro que querés anular esta venta?");
    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");

      await anularVenta(ventaId, {
        motivo: "Anulada desde frontend",
        id_usuario: 1,
      });

      await cargarVenta();
      alert("Venta anulada correctamente");
    } catch (err) {
      setError(err.message || "No se pudo anular la venta");
    } finally {
      setProcesando(false);
    }
  }

  function colorEstado(estado) {
    switch (estado) {
      case "creada":
        return "#b26a00";
      case "pagada_parcial":
        return "#8a6d00";
      case "pagada_total":
        return "#1565c0";
      case "entregada":
        return "#137333";
      case "anulada":
        return "#b42318";
      default:
        return "#444";
    }
  }

  function badgeEstado(estado) {
    return {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: "999px",
      fontWeight: "bold",
      fontSize: "13px",
      background: "#f3f4f6",
      color: colorEstado(estado),
      border: `1px solid ${colorEstado(estado)}33`,
    };
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando detalle de venta...</p>;
  if (error) return <p style={{ color: "red", padding: "24px" }}>Error: {error}</p>;
  if (!data) return <p style={{ padding: "24px" }}>No se encontró la venta.</p>;

  const { venta, items } = data;

  return (
    <div style={{ padding: "24px", background: "#f6f7fb", minHeight: "100vh" }}>
      <button onClick={() => navigate("/ventas")} style={{ marginBottom: "16px" }}>
        Volver
      </button>

      <h1 style={{ marginBottom: "16px" }}>Detalle de Venta #{venta.id}</h1>

      <div style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <Info label="Fecha" value={new Date(venta.fecha).toLocaleString("es-AR")} />
          <Info label="Cliente" value={venta.cliente_nombre} />
          <Info label="Sucursal" value={venta.sucursal_nombre} />
          <Info label="Estado" value={<span style={badgeEstado(venta.estado)}>{venta.estado}</span>} />
          <Info label="Subtotal" value={`$${Number(venta.subtotal_base).toLocaleString("es-AR")}`} />
          <Info label="Descuento" value={`$${Number(venta.descuento_total).toLocaleString("es-AR")}`} />
          <Info label="Recargo" value={`$${Number(venta.recargo_total).toLocaleString("es-AR")}`} />
          <Info label="Total final" value={`$${Number(venta.total_final).toLocaleString("es-AR")}`} />
          <Info label="Saldo pendiente" value={`$${Number(venta.saldo_pendiente).toLocaleString("es-AR")}`} />
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Items</h2>

        {items.length === 0 ? (
          <p>La venta no tiene items.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID Variante</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>Cantidad</th>
                  <th style={thStyle}>Precio Lista</th>
                  <th style={thStyle}>Precio Final</th>
                  <th style={thStyle}>Costo Unitario</th>
                  <th style={thStyle}>Subtotal</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>{item.id_variante}</td>
                    <td style={tdStyle}>{item.descripcion_snapshot}</td>
                    <td style={tdStyle}>{Number(item.cantidad).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>${Number(item.precio_lista).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>${Number(item.precio_final).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>${Number(item.costo_unitario_aplicado).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>${Number(item.subtotal).toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Pagos</h2>

        {pagos.length === 0 ? (
          <p>Sin pagos registrados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Medio</th>
                  <th style={thStyle}>Monto</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>{pago.id}</td>
                    <td style={tdStyle}>{new Date(pago.fecha).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>{pago.medio_pago}</td>
                    <td style={tdStyle}>${Number(pago.monto_total_cobrado).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>{pago.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {venta.estado === "creada" && (
        <button onClick={handleAnularVenta} disabled={procesando}>
          {procesando ? "Anulando..." : "Anular venta"}
        </button>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #eee",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "18px",
  marginBottom: "16px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
};