import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarVentas } from "../services/ventasService";

export default function VentasListPage() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarVentas();
  }, []);

  async function cargarVentas() {
    try {
      setLoading(true);
      setError("");

      const data = await listarVentas();
      setVentas(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ventas");
    } finally {
      setLoading(false);
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

  if (loading) return <p style={{ padding: "24px" }}>Cargando ventas...</p>;

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <div
          style={{
            background: "#fff1f0",
            color: "#b42318",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #f4c7c3",
          }}
        >
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h1 style={{ margin: 0 }}>Ventas</h1>
        <button onClick={cargarVentas}>Refrescar</button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Listado</h2>
        </div>

        {ventas.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay ventas registradas.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              cellPadding="10"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "960px",
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Sucursal</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {ventas.map((venta) => (
                  <tr key={venta.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>{venta.id}</td>
                    <td style={tdStyle}>{new Date(venta.fecha).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>{venta.cliente_nombre}</td>
                    <td style={tdStyle}>{venta.sucursal_nombre}</td>
                    <td style={tdStyle}>
                      <span style={badgeEstado(venta.estado)}>{venta.estado}</span>
                    </td>
                    <td style={tdStyle}>
                      ${Number(venta.total_final).toLocaleString("es-AR")}
                    </td>
                    <td style={tdStyle}>
                      ${Number(venta.saldo_pendiente).toLocaleString("es-AR")}
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/ventas/${venta.id}`}
                        style={{
                          textDecoration: "none",
                          fontWeight: "bold",
                        }}
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
};