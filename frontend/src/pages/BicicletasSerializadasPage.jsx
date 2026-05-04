import { useEffect, useMemo, useState } from "react";
import {
  crearSerializada,
  listarSerializadas,
} from "../services/serializadasService";
import { CURRENT_SUCURSAL_ID, CURRENT_USER_ID } from "../config/appConfig";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "disponible", label: "Disponible" },
  { value: "reservada", label: "Reservada" },
  { value: "vendida_pendiente_entrega", label: "Vendida pendiente" },
  { value: "entregada", label: "Entregada" },
];

export default function BicicletasSerializadasPage() {
  const [bicis, setBicis] = useState([]);
  const [estado, setEstado] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState({
    id_variante: "",
    id_sucursal_actual: CURRENT_SUCURSAL_ID,
    numero_cuadro: "",
    observaciones: "",
  });

  useEffect(() => {
    cargarSerializadas();
  }, [estado]);

  async function cargarSerializadas() {
    try {
      setLoading(true);
      setError("");

      const data = await listarSerializadas({
        estado: estado || undefined,
      });

      setBicis(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas serializadas");
    } finally {
      setLoading(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();

    if (!form.id_variante) {
      setError("Variante es obligatoria");
      return;
    }

    if (!form.numero_cuadro.trim()) {
      setError("Número de cuadro es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const res = await crearSerializada({
        id_variante: Number(form.id_variante),
        id_sucursal_actual: Number(form.id_sucursal_actual),
        numero_cuadro: form.numero_cuadro.trim(),
        observaciones: form.observaciones.trim() || null,
        id_usuario: CURRENT_USER_ID,
      });

      setMensaje(`Bicicleta serializada creada. ID #${res.bicicleta_id}`);

      setForm((p) => ({
        ...p,
        numero_cuadro: "",
        observaciones: "",
      }));

      await cargarSerializadas();
    } catch (err) {
      setError(err.message || "No se pudo crear la bicicleta serializada");
    } finally {
      setProcesando(false);
    }
  }

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return bicis;

    return bicis.filter((bici) => {
      const texto = [
        bici.id,
        bici.producto_nombre,
        bici.nombre_variante,
        bici.sucursal_nombre,
        bici.numero_cuadro,
        bici.estado,
        bici.observaciones,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [bicis, query]);

  const resumen = useMemo(() => {
    return bicis.reduce(
      (acc, bici) => {
        acc.total += 1;
        acc[bici.estado] = (acc[bici.estado] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        disponible: 0,
        reservada: 0,
        vendida_pendiente_entrega: 0,
        entregada: 0,
      }
    );
  }, [bicis]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando bicicletas serializadas...</p>;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Bicicletas serializadas</h1>
          <p style={mutedStyle}>
            Gestión por número de cuadro. Estas unidades no son stock genérico.
          </p>
        </div>

        <button onClick={cargarSerializadas} disabled={procesando}>
          Refrescar
        </button>
      </header>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={metricGridStyle}>
        <Metric label="Total" value={resumen.total} />
        <Metric label="Disponibles" value={resumen.disponible} />
        <Metric label="Reservadas" value={resumen.reservada} />
        <Metric label="Vendidas pendientes" value={resumen.vendida_pendiente_entrega} />
        <Metric label="Entregadas" value={resumen.entregada} />
      </section>

      <div style={gridStyle}>
        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={toolbarStyle}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cuadro, producto, variante o estado"
              style={inputStyle}
            />

            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              style={inputStyle}
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {filtradas.length === 0 ? (
            <div style={{ padding: "18px" }}>No hay bicicletas para mostrar.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Bicicleta</th>
                    <th style={thStyle}>Cuadro</th>
                    <th style={thStyle}>Sucursal</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filtradas.map((bici) => (
                    <tr key={bici.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={tdStyle}>#{bici.id}</td>
                      <td style={tdStyle}>
                        <strong>{bici.producto_nombre}</strong>
                        <div style={mutedSmallStyle}>
                          {bici.nombre_variante} · Variante #{bici.id_variante}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <strong>{bici.numero_cuadro}</strong>
                      </td>
                      <td style={tdStyle}>{bici.sucursal_nombre}</td>
                      <td style={tdStyle}>
                        <EstadoBadge estado={bici.estado} />
                      </td>
                      <td style={tdStyle}>{bici.observaciones || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside style={sideStyle}>
          <section style={cardStyle}>
            <h2 style={cardTitleStyle}>Armar serializada</h2>

            <form onSubmit={handleCrear} style={formStyle}>
              <TextInput
                label="Variante ID"
                value={form.id_variante}
                onChange={(v) => setForm((p) => ({ ...p, id_variante: v }))}
              />

              <TextInput
                label="Sucursal ID"
                value={form.id_sucursal_actual}
                onChange={(v) => setForm((p) => ({ ...p, id_sucursal_actual: v }))}
              />

              <TextInput
                label="Número de cuadro"
                value={form.numero_cuadro}
                onChange={(v) => setForm((p) => ({ ...p, numero_cuadro: v }))}
                type="text"
              />

              <label style={fieldStyle}>
                <span style={labelStyle}>Observaciones</span>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
                  style={textareaStyle}
                  placeholder="Ej: armada para salón, color, detalle..."
                />
              </label>

              <button type="submit" disabled={procesando} style={primaryButtonStyle}>
                {procesando ? "Guardando..." : "Crear serializada"}
              </button>
            </form>

            <div style={noteStyle}>
              Al crear una serializada, el backend descuenta 1 unidad del stock físico y crea una unidad única por número de cuadro.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={metricStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong style={metricValueStyle}>{value}</strong>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "number" }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function EstadoBadge({ estado }) {
  const style =
    estado === "disponible"
      ? okPillStyle
      : estado === "entregada"
        ? mutedPillStyle
        : warningPillStyle;

  return <span style={style}>{estado}</span>;
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const mutedSmallStyle = { color: "#667085", fontSize: "13px", marginTop: "4px" };

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "16px",
};

const successStyle = {
  background: "#e8fff0",
  color: "#146c2e",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b7ebc6",
  marginBottom: "16px",
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const metricStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "14px",
  display: "grid",
  gap: "6px",
};

const metricValueStyle = { fontSize: "22px" };

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(620px,1fr) 360px",
  gap: "16px",
  alignItems: "start",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "16px",
  marginBottom: "16px",
};

const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 220px",
  gap: "12px",
  padding: "16px",
  borderBottom: "1px solid #eee",
  alignItems: "center",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  fontSize: "15px",
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "900px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
  verticalAlign: "top",
};

const sideStyle = { display: "grid", gap: "0" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const formStyle = { display: "grid", gap: "10px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const textareaStyle = { ...inputStyle, minHeight: "68px", resize: "vertical" };

const noteStyle = {
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "10px",
  borderRadius: "8px",
  color: "#344054",
  marginTop: "12px",
};

const okPillStyle = {
  background: "#ecfdf3",
  color: "#067647",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};

const warningPillStyle = {
  background: "#fffaeb",
  color: "#b54708",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};

const mutedPillStyle = {
  background: "#f2f4f7",
  color: "#475467",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};

const primaryButtonStyle = {
  border: "none",
  background: "#12a15f",
  color: "white",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};
