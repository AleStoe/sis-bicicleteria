import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  crearCliente,
  obtenerCliente,
  actualizarCliente,
} from "../services/clientesService";
import { normalizeTextUpper } from "../utils/textNormalization";

const FORM_INICIAL = {
  nombre: "",
  nombre_persona: "",
  apellido: "",
  telefono: "",
  dni: "",
  direccion: "",
  tipo_cliente: "minorista",
  condicion_iva: "consumidor_final",
  cuit: "",
  razon_social: "",
  notas: "",
};

export default function ClienteFormPage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const esEdicion = Boolean(clienteId);

  const [form, setForm] = useState(FORM_INICIAL);
  const [loading, setLoading] = useState(esEdicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (esEdicion) cargarCliente();
  }, [clienteId]);

  async function cargarCliente() {
    try {
      setLoading(true);
      setError("");

      const data = await obtenerCliente(clienteId);
      const c = data.cliente;

      setForm({
        nombre: c.nombre || "",
        nombre_persona: c.nombre_persona || "",
        apellido: c.apellido || "",
        telefono: c.telefono || "",
        dni: c.dni || "",
        direccion: c.direccion || "",
        tipo_cliente: c.tipo_cliente || "minorista",
        condicion_iva: c.condicion_iva || "consumidor_final",
        cuit: c.cuit || "",
        razon_social: c.razon_social || "",
        notas: c.notas || "",
      });
    } catch (err) {
      setError(err.message || "No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: UPPER_FIELDS.has(name) ? normalizeTextUpper(value) : value,
    }));
  }

  function limpiarOpcional(value) {
    const limpio = String(value || "").trim();
    return limpio ? limpio : null;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");

      const payload = {
        nombre:
          [form.nombre_persona, form.apellido]
            .map((parte) => parte.trim())
            .filter(Boolean)
            .join(" ") || form.nombre.trim(),
        nombre_persona: limpiarOpcional(form.nombre_persona),
        apellido: limpiarOpcional(form.apellido),
        telefono: form.telefono.trim(),
        dni: limpiarOpcional(form.dni),
        direccion: limpiarOpcional(form.direccion),
        tipo_cliente: form.tipo_cliente,
        condicion_iva: form.condicion_iva,
        cuit: limpiarOpcional(form.cuit),
        razon_social: limpiarOpcional(form.razon_social),
        notas: limpiarOpcional(form.notas),
      };

      if (esEdicion) {
        await actualizarCliente(clienteId, {
          ...payload,
          activo: true,
        });

        navigate(`/clientes/${clienteId}`);
      } else {
        const creado = await crearCliente(payload);
        navigate(`/clientes/${creado.cliente_id}`);
      }
    } catch (err) {
      setError(err.message || "Error al guardar cliente");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando...</p>;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{esEdicion ? "Editar cliente" : "Nuevo cliente"}</h1>
          <p style={subtitleStyle}>
            Cargá datos básicos, comerciales y fiscales del cliente.
          </p>
        </div>

        <Link to={esEdicion ? `/clientes/${clienteId}` : "/clientes"} style={secondaryLinkStyle}>
          Volver
        </Link>
      </header>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <form onSubmit={handleSubmit} style={formStyle}>
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Datos básicos</h2>

          <div style={gridStyle}>
            <Field label="Nombre">
              <input
                name="nombre_persona"
                value={form.nombre_persona}
                onChange={handleChange}
                style={inputStyle}
              />
            </Field>

            <Field label="Apellido">
              <input
                name="apellido"
                value={form.apellido}
                onChange={handleChange}
                style={inputStyle}
              />
            </Field>

            <Field label="Nombre visible actual *">
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                required={!form.nombre_persona.trim() && !form.apellido.trim()}
                style={inputStyle}
              />
              {esEdicion && !form.nombre_persona && !form.apellido ? (
                <small style={hintStyle}>
                  Cliente legacy: completá nombre y apellido cuando puedas. Mientras tanto se conserva este nombre visible.
                </small>
              ) : (
                <small style={hintStyle}>
                  Si cargás nombre/apellido, el sistema actualiza este valor compatible automáticamente.
                </small>
              )}
            </Field>

            <Field label="Teléfono *">
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </Field>

            <Field label="DNI">
              <input
                name="dni"
                value={form.dni}
                onChange={handleChange}
                style={inputStyle}
              />
            </Field>

            <Field label="Dirección">
              <input
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                style={inputStyle}
              />
            </Field>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Datos comerciales</h2>

          <div style={gridStyle}>
            <Field label="Tipo de cliente">
              <select
                name="tipo_cliente"
                value={form.tipo_cliente}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
              </select>
            </Field>

            <Field label="Condición IVA">
              <select
                name="condicion_iva"
                value={form.condicion_iva}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="consumidor_final">Consumidor final</option>
                <option value="monotributo">Monotributo</option>
                <option value="responsable_inscripto">Responsable inscripto</option>
                <option value="exento">Exento</option>
              </select>
            </Field>

            <Field label="CUIT">
              <input
                name="cuit"
                value={form.cuit}
                onChange={handleChange}
                placeholder="Ej: 20-12345678-9"
                style={inputStyle}
              />
            </Field>

            <Field label="Razón social">
              <input
                name="razon_social"
                value={form.razon_social}
                onChange={handleChange}
                style={inputStyle}
              />
            </Field>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Notas</h2>

          <textarea
            name="notas"
            value={form.notas}
            onChange={handleChange}
            placeholder="Notas internas del cliente"
            style={textareaStyle}
          />
        </section>

        <div style={actionsStyle}>
          <Link to={esEdicion ? `/clientes/${clienteId}` : "/clientes"} style={secondaryLinkStyle}>
            Cancelar
          </Link>

          <button type="submit" disabled={guardando} style={primaryBtnStyle}>
            {guardando ? "Guardando..." : "Guardar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      {children}
    </label>
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
  alignItems: "flex-start",
  marginBottom: "16px",
};

const titleStyle = {
  margin: 0,
  fontSize: "28px",
};

const subtitleStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const formStyle = {
  maxWidth: "960px",
  display: "grid",
  gap: "16px",
};

const sectionStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
};

const sectionTitleStyle = {
  margin: "0 0 14px",
  fontSize: "18px",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const fieldStyle = {
  display: "grid",
  gap: "6px",
  fontWeight: 700,
  color: "#344054",
};

const inputStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 11px",
  fontSize: "14px",
  background: "white",
};

const textareaStyle = {
  width: "100%",
  minHeight: "100px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 11px",
  fontSize: "14px",
  resize: "vertical",
  boxSizing: "border-box",
};

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const primaryBtnStyle = {
  border: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "10px",
  padding: "11px 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryLinkStyle = {
  textDecoration: "none",
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "14px",
};

const hintStyle = {
  color: "#667085",
  fontWeight: 600,
  fontSize: "12px",
  lineHeight: 1.35,
};

const UPPER_FIELDS = new Set(["nombre", "nombre_persona", "apellido", "razon_social"]);
