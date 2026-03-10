import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { obtenerVenta, anularVenta } from "../services/ventasService";

export default function VentaDetallePage() {
  const { ventaId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
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

      const result = await obtenerVenta(ventaId);
      setData(result);
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

  if (loading) return <p>Cargando detalle de venta...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (!data) return <p>No se encontró la venta.</p>;

  const { venta, items } = data;

  return (
    <div style={{ padding: "24px" }}>
      <button onClick={() => navigate("/ventas")} style={{ marginBottom: "16px" }}>
        Volver
      </button>

      <h1>Detalle de Venta #{venta.id}</h1>

      <div style={{ marginBottom: "24px" }}>
        <p><strong>Fecha:</strong> {new Date(venta.fecha).toLocaleString("es-AR")}</p>
        <p><strong>Cliente:</strong> {venta.cliente_nombre}</p>
        <p><strong>Sucursal:</strong> {venta.sucursal_nombre}</p>
        <p><strong>Estado:</strong> {venta.estado}</p>
        <p><strong>Subtotal:</strong> ${Number(venta.subtotal_base).toLocaleString("es-AR")}</p>
        <p><strong>Descuento:</strong> ${Number(venta.descuento_total).toLocaleString("es-AR")}</p>
        <p><strong>Recargo:</strong> ${Number(venta.recargo_total).toLocaleString("es-AR")}</p>
        <p><strong>Total final:</strong> ${Number(venta.total_final).toLocaleString("es-AR")}</p>
        <p><strong>Saldo pendiente:</strong> ${Number(venta.saldo_pendiente).toLocaleString("es-AR")}</p>
      </div>

      <h2>Items</h2>

      {items.length === 0 ? (
        <p>La venta no tiene items.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ width: "100%", marginBottom: "24px" }}>
          <thead>
            <tr>
              <th>ID Variante</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio Lista</th>
              <th>Precio Final</th>
              <th>Costo Unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.id_variante}</td>
                <td>{item.descripcion_snapshot}</td>
                <td>{Number(item.cantidad).toLocaleString("es-AR")}</td>
                <td>${Number(item.precio_lista).toLocaleString("es-AR")}</td>
                <td>${Number(item.precio_final).toLocaleString("es-AR")}</td>
                <td>${Number(item.costo_unitario_aplicado).toLocaleString("es-AR")}</td>
                <td>${Number(item.subtotal).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {venta.estado === "creada" && (
        <button onClick={handleAnularVenta} disabled={procesando}>
          {procesando ? "Anulando..." : "Anular venta"}
        </button>
      )}
    </div>
  );
}