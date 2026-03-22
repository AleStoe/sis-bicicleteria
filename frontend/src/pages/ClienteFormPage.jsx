import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  crearCliente,
  obtenerCliente,
  actualizarCliente,
} from "../services/clientesService";

export default function ClienteFormPage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const esEdicion = !!clienteId;

  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    dni: "",
    direccion: "",
    tipo_cliente: "minorista",
    notas: "",
  });

  const [loading, setLoading] = useState(esEdicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (esEdicion) {
      cargarCliente();
    }
  }, [clienteId]);

  async function cargarCliente() {
    try {
      setLoading(true);
      const data = await obtenerCliente(clienteId);

      const c = data.cliente;

      setForm({
        nombre: c.nombre || "",
        telefono: c.telefono || "",
        dni: c.dni || "",
        direccion: c.direccion || "",
        tipo_cliente: c.tipo_cliente || "minorista",
        notas: c.notas || "",
      });
    } catch (err) {
      setError("No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");

      if (esEdicion) {
        await actualizarCliente(clienteId, {
          ...form,
          activo: true,
        });
      } else {
        await crearCliente(form);
      }

      navigate("/clientes");
    } catch (err) {
      setError(err.message || "Error al guardar cliente");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando...</p>;

  return (
    <div style={{ padding: "24px", background: "#f6f7fb", minHeight: "100vh" }}>
      <h1>{esEdicion ? "Editar cliente" : "Nuevo cliente"}</h1>

      {error && (
        <div
          style={{
            background: "#fff1f0",
            color: "#b42318",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          background: "white",
          padding: "16px",
          borderRadius: "12px",
          maxWidth: "500px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <input
          name="nombre"
          placeholder="Nombre"
          value={form.nombre}
          onChange={handleChange}
          required
        />

        <input
          name="telefono"
          placeholder="Teléfono"
          value={form.telefono}
          onChange={handleChange}
          required
        />

        <input
          name="dni"
          placeholder="DNI"
          value={form.dni}
          onChange={handleChange}
        />

        <input
          name="direccion"
          placeholder="Dirección"
          value={form.direccion}
          onChange={handleChange}
        />

        <select
          name="tipo_cliente"
          value={form.tipo_cliente}
          onChange={handleChange}
        >
          <option value="minorista">Minorista</option>
          <option value="mayorista">Mayorista</option>
        </select>

        <textarea
          name="notas"
          placeholder="Notas"
          value={form.notas}
          onChange={handleChange}
        />

        <button disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </div>
  );
}