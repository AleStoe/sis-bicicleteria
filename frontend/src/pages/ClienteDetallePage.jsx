import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  obtenerCliente,
  desactivarCliente,
  activarCliente,
} from "../services/clientesService";

export default function ClienteDetallePage() {
  const { clienteId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarCliente();
  }, [clienteId]);
  
  async function handleActivar() {
    const confirmar = window.confirm(
      "¿Seguro que querés activar este cliente?"
    );

    if (!confirmar) return;

    try {
      setError("");
      await activarCliente(clienteId);
      await cargarCliente();
    } catch (err) {
      setError(err.message || "No se pudo activar el cliente");
    }
  }

  async function cargarCliente() {
    try {
      setLoading(true);
      setError("");

      const detalle = await obtenerCliente(clienteId);
      setData(detalle);
    } catch (err) {
      setError(err.message || "No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }

  async function handleDesactivar() {
    const confirmar = window.confirm(
      "¿Seguro que querés desactivar este cliente?"
    );

    if (!confirmar) return;

    try {
      setError("");
      await desactivarCliente(clienteId);
      await cargarCliente();
    } catch (err) {
      setError(err.message || "No se pudo desactivar el cliente");
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

  if (loading) return <p style={{ padding: "24px" }}>Cargando cliente...</p>;

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

  const cliente = data?.cliente;
  const resumen = data?.resumen_ventas;
  const ventas = data?.ventas_recientes || [];

  if (!cliente) {
    return <p style={{ padding: "24px" }}>No se encontró el cliente.</p>;
  }

  return (
    <div style={{ padding: "24px", background: "#f6f7fb", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{cliente.nombre}</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Cliente #{cliente.id}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={cargarCliente}>Refrescar</button>

          <Link to="/clientes" style={linkBtnStyle}>
            Volver
          </Link>

          {cliente.id !== 1 && (
            <Link to={`/clientes/${cliente.id}/editar`} style={linkBtnStyle}>
              Editar
            </Link>
          )}

          {cliente.id !== 1 && (
            <Link to={`/clientes/${cliente.id}/editar`} style={linkBtnStyle}>
              Editar
            </Link>
          )}

          {cliente.id !== 1 && cliente.activo && (
            <button onClick={handleDesactivar}>Desactivar</button>
          )}

          {cliente.id !== 1 && !cliente.activo && (
            <button onClick={handleActivar}>Activar</button>
          )}
        </div>
      </div>

      <div style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Datos del cliente</h2>
          <div style={infoGridStyle}>
            <Info label="Nombre" value={cliente.nombre} />
            <Info label="Teléfono" value={cliente.telefono || "-"} />
            <Info label="DNI" value={cliente.dni || "-"} />
            <Info label="Dirección" value={cliente.direccion || "-"} />
            <Info label="Tipo" value={cliente.tipo_cliente} />
            <Info label="Activo" value={cliente.activo ? "Sí" : "No"} />
            <Info label="Notas" value={cliente.notas || "-"} full />
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen comercial</h2>

          <div style={infoGridStyle}>
            <Info
              label="Cantidad de ventas"
              value={resumen?.cantidad_ventas ?? 0}
            />
            <Info
              label="Total comprado"
              value={`$${Number(
                resumen?.total_comprado ?? 0
              ).toLocaleString("es-AR")}`}
            />
            <Info
              label="Saldo pendiente"
              value={`$${Number(
                resumen?.saldo_pendiente_total ?? 0
              ).toLocaleString("es-AR")}`}
            />
            <Info
              label="Última venta"
              value={
                resumen?.ultima_venta_fecha
                  ? new Date(resumen.ultima_venta_fecha).toLocaleString("es-AR")
                  : "-"
              }
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={cardTitleStyle}>Ventas recientes</h2>

        {ventas.length === 0 ? (
          <div>No hay ventas asociadas a este cliente.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              cellPadding="10"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "760px",
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Fecha</th>
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
                    <td style={tdStyle}>
                      {new Date(venta.fecha).toLocaleString("es-AR")}
                    </td>
                    <td style={tdStyle}>
                      <span style={badgeEstado(venta.estado)}>
                        {venta.estado}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      ${Number(venta.total).toLocaleString("es-AR")}
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
                        Ver venta
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

function Info({ label, value, full = false }) {
  return (
    <div
      style={{
        gridColumn: full ? "1 / -1" : "auto",
        background: "#f9fafb",
        border: "1px solid #eaecf0",
        borderRadius: "12px",
        padding: "12px",
      }}
    >
      <div style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const linkBtnStyle = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  color: "#111827",
  background: "white",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
  marginBottom: "16px",
};

const cardTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "20px",
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
};