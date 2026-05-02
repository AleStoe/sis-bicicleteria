import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarClientes, listarBicicletasCliente, crearBicicletaCliente } from "../services/clientesService";
import { crearOrdenTaller } from "../services/tallerService";

export default function TallerNuevaOrdenPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [bicicletas, setBicicletas] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [bicicletaId, setBicicletaId] = useState("");
  const [problema, setProblema] = useState("");
  const [loading, setLoading] = useState(true);
  const [cargandoBicis, setCargandoBicis] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarNuevaBici, setMostrarNuevaBici] = useState(false);
  const [nuevaBici, setNuevaBici] = useState({
    marca: "",
    modelo: "",
    rodado: "",
    color: "",
    numero_cuadro: "",
    notas: "",
  });

  useEffect(() => {
    cargarClientes();
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setBicicletas([]);
      setBicicletaId("");
      return;
    }

    cargarBicicletas(clienteId);
  }, [clienteId]);

  async function cargarClientes() {
    try {
      setLoading(true);
      setError("");
      const data = await listarClientes({ solo_activos: true });
      setClientes(data || []);

      const primerClienteReal = (data || []).find((cliente) => cliente.id !== 1) || data?.[0];
      if (primerClienteReal) setClienteId(String(primerClienteReal.id));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  async function cargarBicicletas(id) {
    try {
      setCargandoBicis(true);
      setError("");
      const data = await listarBicicletasCliente(id);
      setBicicletas(data || []);
      setBicicletaId(data?.[0]?.id ? String(data[0].id) : "");
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas del cliente");
      setBicicletas([]);
      setBicicletaId("");
    } finally {
      setCargandoBicis(false);
    }
  }

  function cambiarNuevaBici(campo, valor) {
    setNuevaBici((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardarBicicleta(e) {
    e.preventDefault();

    if (!clienteId) {
      setError("Seleccioná un cliente antes de cargar la bicicleta");
      return;
    }

    if (!nuevaBici.marca.trim() || !nuevaBici.modelo.trim()) {
      setError("Marca y modelo son obligatorios para crear la bicicleta");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      const biciCreada = await crearBicicletaCliente(clienteId, limpiarObjeto(nuevaBici));
      await cargarBicicletas(clienteId);
      setBicicletaId(String(biciCreada.id));
      setMostrarNuevaBici(false);
      setNuevaBici({ marca: "", modelo: "", rodado: "", color: "", numero_cuadro: "", notas: "" });
    } catch (err) {
      setError(err.message || "No se pudo crear la bicicleta");
    } finally {
      setGuardando(false);
    }
  }

  async function crearOrden(e) {
    e.preventDefault();

    if (!clienteId) {
      setError("Seleccioná un cliente");
      return;
    }

    if (Number(clienteId) === 1) {
      setError("No uses Consumidor final para taller. Taller necesita cliente real y trazabilidad.");
      return;
    }

    if (!bicicletaId) {
      setError("Seleccioná o cargá una bicicleta del cliente");
      return;
    }

    if (!problema.trim()) {
      setError("Describí el problema reportado");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      const orden = await crearOrdenTaller({
        id_sucursal: 1,
        id_cliente: Number(clienteId),
        id_bicicleta_cliente: Number(bicicletaId),
        problema_reportado: problema.trim(),
        id_usuario: 1,
      });

      navigate(`/taller/${orden.id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear la orden de taller");
    } finally {
      setGuardando(false);
    }
  }

  const clienteSeleccionado = useMemo(
    () => clientes.find((cliente) => String(cliente.id) === String(clienteId)),
    [clientes, clienteId]
  );

  if (loading) return <p style={{ padding: "24px" }}>Cargando nueva orden...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Nueva orden de taller</h1>
          <p style={mutedStyle}>Ingreso de bicicleta, problema reportado y cliente responsable</p>
        </div>
        <Link to="/taller" style={linkBtnStyle}>Volver</Link>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Datos de ingreso</h2>

          <form onSubmit={crearOrden} style={{ display: "grid", gap: "14px" }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Cliente</span>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    #{cliente.id} - {cliente.nombre}{cliente.telefono ? ` (${cliente.telefono})` : ""}
                  </option>
                ))}
              </select>
            </label>

            {Number(clienteId) === 1 && (
              <div style={warningStyle}>
                Taller no debería trabajar con Consumidor final. Cargá el cliente real antes de crear la orden.
              </div>
            )}

            <div style={fieldStyle}>
              <span style={labelStyle}>Bicicleta</span>
              {cargandoBicis ? (
                <div>Cargando bicicletas...</div>
              ) : bicicletas.length === 0 ? (
                <div style={warningStyle}>Este cliente todavía no tiene bicicletas cargadas.</div>
              ) : (
                <select value={bicicletaId} onChange={(e) => setBicicletaId(e.target.value)} style={inputStyle}>
                  {bicicletas.map((bici) => (
                    <option key={bici.id} value={bici.id}>
                      #{bici.id} - {describirBicicleta(bici)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button type="button" onClick={() => setMostrarNuevaBici((v) => !v)} style={{ width: "fit-content" }}>
              {mostrarNuevaBici ? "Ocultar carga de bicicleta" : "+ Cargar bicicleta"}
            </button>

            <label style={fieldStyle}>
              <span style={labelStyle}>Problema reportado</span>
              <textarea
                value={problema}
                onChange={(e) => setProblema(e.target.value)}
                placeholder="Ej: cambio de cable y funda, freno trasero no responde, revisar transmisión..."
                rows={6}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            <button type="submit" disabled={guardando} style={primaryButtonStyle}>
              {guardando ? "Guardando..." : "Crear orden"}
            </button>
          </form>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Contexto</h2>
          <Info label="Cliente seleccionado" value={clienteSeleccionado ? clienteSeleccionado.nombre : "-"} />
          <Info label="Teléfono" value={clienteSeleccionado?.telefono || "-"} />
          <Info label="Bicicletas cargadas" value={bicicletas.length} />
          <div style={noteStyle}>
            No conviene crear órdenes sin cliente real: después perdés historial de reparaciones, deuda, garantía y seguimiento.
          </div>
        </aside>
      </div>

      {mostrarNuevaBici && (
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Cargar bicicleta del cliente</h2>
          <form onSubmit={guardarBicicleta} style={bikeFormGridStyle}>
            <Input label="Marca" value={nuevaBici.marca} onChange={(v) => cambiarNuevaBici("marca", v)} required />
            <Input label="Modelo" value={nuevaBici.modelo} onChange={(v) => cambiarNuevaBici("modelo", v)} required />
            <Input label="Rodado" value={nuevaBici.rodado} onChange={(v) => cambiarNuevaBici("rodado", v)} />
            <Input label="Color" value={nuevaBici.color} onChange={(v) => cambiarNuevaBici("color", v)} />
            <Input label="Número de cuadro" value={nuevaBici.numero_cuadro} onChange={(v) => cambiarNuevaBici("numero_cuadro", v)} />
            <Input label="Notas" value={nuevaBici.notas} onChange={(v) => cambiarNuevaBici("notas", v)} />
            <button type="submit" disabled={guardando} style={{ ...primaryButtonStyle, gridColumn: "1 / -1", width: "fit-content" }}>
              Guardar bicicleta
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function Input({ label, value, onChange, required = false }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}{required ? " *" : ""}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px", marginBottom: "10px" }}>
      <div style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function describirBicicleta(bici) {
  return [bici.marca, bici.modelo, bici.rodado ? `Rod. ${bici.rodado}` : null, bici.color, bici.numero_cuadro ? `Cuadro ${bici.numero_cuadro}` : null]
    .filter(Boolean)
    .join(" - ");
}

function limpiarObjeto(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]));
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px, 1.4fr) minmax(280px, 0.8fr)", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const primaryButtonStyle = { padding: "11px 14px", borderRadius: "10px", border: "1px solid #111827", background: "#111827", color: "white", fontWeight: "bold", cursor: "pointer" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const warningStyle = { background: "#fff7e6", color: "#8a4b00", padding: "10px", borderRadius: "10px", border: "1px solid #ffd591" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054" };
const bikeFormGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
