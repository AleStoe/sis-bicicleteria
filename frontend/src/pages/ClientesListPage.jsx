import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarClientes } from "../services/clientesService";

export default function ClientesListPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  useEffect(() => {
    cargarClientes();
  }, [soloActivos]);

  async function cargarClientes() {
    try {
      setLoading(true);
      setError("");

      const data = await listarClientes({
        q: busqueda.trim() || undefined,
        solo_activos: soloActivos,
      });

      setClientes(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  async function buscar(e) {
    e.preventDefault();
    await cargarClientes();
  }

  function colorTipo(tipo) {
    switch (tipo) {
      case "consumidor_final":
        return "#555";
      case "minorista":
        return "#1565c0";
      case "mayorista":
        return "#137333";
      default:
        return "#444";
    }
  }

  function badgeTipo(tipo) {
    return {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: "999px",
      fontWeight: "bold",
      fontSize: "13px",
      background: "#f3f4f6",
      color: colorTipo(tipo),
      border: `1px solid ${colorTipo(tipo)}33`,
    };
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando clientes...</p>;

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
        <h1 style={{ margin: 0 }}>Clientes</h1>
        <button onClick={cargarClientes}>Refrescar</button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          padding: "16px",
          marginBottom: "16px",
        }}
      >
        <form
          onSubmit={buscar}
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono o DNI"
            style={inputStyle}
          />

          <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            Solo activos
          </label>

          <button type="submit">Buscar</button>
          <Link to="/clientes/nuevo">Nuevo cliente</Link>
        </form>
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

        {clientes.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay clientes para mostrar.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              cellPadding="10"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "900px",
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Teléfono</th>
                  <th style={thStyle}>DNI</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Activo</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>{cliente.id}</td>
                    <td style={tdStyle}>{cliente.nombre}</td>
                    <td style={tdStyle}>{cliente.telefono || "-"}</td>
                    <td style={tdStyle}>{cliente.dni || "-"}</td>
                    <td style={tdStyle}>
                      <span style={badgeTipo(cliente.tipo_cliente)}>
                        {cliente.tipo_cliente}
                      </span>
                    </td>
                    <td style={tdStyle}>{cliente.activo ? "Sí" : "No"}</td>
                    <td style={tdStyle}>
                      <Link
                        to={`/clientes/${cliente.id}`}
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

const inputStyle = {
  minWidth: "280px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
};