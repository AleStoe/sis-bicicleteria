import { useEffect, useState } from "react";
import {
  listarVentas,
  entregarVenta,
  anularVenta,
  obtenerVenta,
} from "../services/ventasService";

export default function VentasPage() {
  const [ventas, setVentas] = useState([]);
  const [ventaDetalle, setVentaDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

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

  async function verDetalle(ventaId) {
    try {
      setCargandoDetalle(true);
      setError("");
      setMensaje("");

      const data = await obtenerVenta(ventaId);
      setVentaDetalle(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el detalle de la venta");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle() {
    setVentaDetalle(null);
  }

  async function handleEntregar(ventaId) {
    const confirmar = window.confirm(`¿Entregar la venta #${ventaId}?`);
    if (!confirmar) return;

    try {
      setProcesandoId(ventaId);
      setError("");
      setMensaje("");

      await entregarVenta(ventaId, {
        id_usuario: 1,
      });

      setMensaje(`Venta #${ventaId} entregada correctamente`);

      if (ventaDetalle?.venta?.id === ventaId) {
        const detalleActualizado = await obtenerVenta(ventaId);
        setVentaDetalle(detalleActualizado);
      }

      await cargarVentas();
    } catch (err) {
      setError(err.message || `No se pudo entregar la venta #${ventaId}`);
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleAnular(ventaId) {
    const motivo = window.prompt(`Motivo de anulación para la venta #${ventaId}:`);

    if (motivo === null) return;

    const motivoLimpio = motivo.trim();

    if (motivoLimpio.length < 3) {
      setError("El motivo de anulación debe tener al menos 3 caracteres");
      return;
    }

    try {
      setProcesandoId(ventaId);
      setError("");
      setMensaje("");

      await anularVenta(ventaId, {
        motivo: motivoLimpio,
        id_usuario: 1,
      });

      setMensaje(`Venta #${ventaId} anulada correctamente`);

      if (ventaDetalle?.venta?.id === ventaId) {
        const detalleActualizado = await obtenerVenta(ventaId);
        setVentaDetalle(detalleActualizado);
      }

      await cargarVentas();
    } catch (err) {
      setError(err.message || `No se pudo anular la venta #${ventaId}`);
    } finally {
      setProcesandoId(null);
    }
  }

  function colorEstado(estado) {
    switch (estado) {
      case "creada":
        return "darkorange";
      case "entregada":
        return "green";
      case "anulada":
        return "crimson";
      default:
        return "inherit";
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando ventas...</p>;
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1>Ventas</h1>

      <div style={{ marginBottom: "16px", display: "flex", gap: "12px" }}>
        <button onClick={cargarVentas}>Refrescar</button>
        <button onClick={cerrarDetalle} disabled={!ventaDetalle}>
          Cerrar detalle
        </button>
      </div>

      {mensaje && (
        <p style={{ color: "green", marginBottom: "12px" }}>{mensaje}</p>
      )}

      {error && (
        <p style={{ color: "red", marginBottom: "12px" }}>{error}</p>
      )}

      <table border="1" cellPadding="6" style={{ width: "100%", marginBottom: "24px" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Sucursal</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Saldo</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {ventas.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                No hay ventas registradas.
              </td>
            </tr>
          ) : (
            ventas.map((venta) => {
              const procesando = procesandoId === venta.id;
              const puedeModificar = venta.estado === "creada";

              return (
                <tr key={venta.id}>
                  <td>{venta.id}</td>
                  <td>{new Date(venta.fecha).toLocaleString("es-AR")}</td>
                  <td>{venta.cliente_nombre}</td>
                  <td>{venta.sucursal_nombre}</td>
                  <td style={{ color: colorEstado(venta.estado), fontWeight: "bold" }}>
                    {venta.estado}
                  </td>
                  <td>${Number(venta.total_final).toLocaleString("es-AR")}</td>
                  <td>${Number(venta.saldo_pendiente).toLocaleString("es-AR")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button onClick={() => verDetalle(venta.id)} disabled={procesando}>
                        Ver detalle
                      </button>

                      <button
                        onClick={() => handleEntregar(venta.id)}
                        disabled={!puedeModificar || procesando}
                      >
                        {procesando ? "Procesando..." : "Entregar"}
                      </button>

                      <button
                        onClick={() => handleAnular(venta.id)}
                        disabled={!puedeModificar || procesando}
                      >
                        {procesando ? "Procesando..." : "Anular"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <h2>Detalle de venta</h2>

      {cargandoDetalle ? (
        <p>Cargando detalle...</p>
      ) : !ventaDetalle ? (
        <p>Seleccioná una venta para ver el detalle.</p>
      ) : (
        <div style={{ border: "1px solid #ccc", padding: "16px" }}>
          <p>
            <strong>ID:</strong> {ventaDetalle.venta.id}
          </p>
          <p>
            <strong>Cliente:</strong> {ventaDetalle.venta.cliente_nombre}
          </p>
          <p>
            <strong>Sucursal:</strong> {ventaDetalle.venta.sucursal_nombre}
          </p>
          <p>
            <strong>Estado:</strong>{" "}
            <span
              style={{
                color: colorEstado(ventaDetalle.venta.estado),
                fontWeight: "bold",
              }}
            >
              {ventaDetalle.venta.estado}
            </span>
          </p>
          <p>
            <strong>Fecha:</strong>{" "}
            {new Date(ventaDetalle.venta.fecha).toLocaleString("es-AR")}
          </p>
          <p>
            <strong>Subtotal:</strong> $
            {Number(ventaDetalle.venta.subtotal_base).toLocaleString("es-AR")}
          </p>
          <p>
            <strong>Total:</strong> $
            {Number(ventaDetalle.venta.total_final).toLocaleString("es-AR")}
          </p>
          <p>
            <strong>Saldo pendiente:</strong> $
            {Number(ventaDetalle.venta.saldo_pendiente).toLocaleString("es-AR")}
          </p>

          <h3>Items</h3>

          <table border="1" cellPadding="6" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Variante</th>
                <th>Cantidad</th>
                <th>Precio lista</th>
                <th>Precio final</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {ventaDetalle.items.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center" }}>
                    Sin items.
                  </td>
                </tr>
              ) : (
                ventaDetalle.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.descripcion_snapshot}</td>
                    <td>{Number(item.cantidad).toLocaleString("es-AR")}</td>
                    <td>${Number(item.precio_lista).toLocaleString("es-AR")}</td>
                    <td>${Number(item.precio_final).toLocaleString("es-AR")}</td>
                    <td>${Number(item.subtotal).toLocaleString("es-AR")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}