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

  if (loading) return <p>Cargando ventas...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div style={{ padding: "24px" }}>
      <h1>Ventas</h1>

      {ventas.length === 0 ? (
        <p>No hay ventas registradas.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Sucursal</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Saldo</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {ventas.map((venta) => (
              <tr key={venta.id}>
                <td>{venta.id}</td>
                <td>{new Date(venta.fecha).toLocaleString("es-AR")}</td>
                <td>{venta.cliente_nombre}</td>
                <td>{venta.sucursal_nombre}</td>
                <td>{venta.estado}</td>
                <td>${Number(venta.total_final).toLocaleString("es-AR")}</td>
                <td>${Number(venta.saldo_pendiente).toLocaleString("es-AR")}</td>
                <td>
                  <Link to={`/ventas/${venta.id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}