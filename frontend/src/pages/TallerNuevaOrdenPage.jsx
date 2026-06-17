import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarClientes, listarBicicletasCliente, crearBicicletaCliente } from "../services/clientesService";
import { crearOrdenTaller } from "../services/tallerService";
import { useBreakpoint } from "../components/ui";
import { useSession } from "../context/SessionContext";
import { normalizeTextUpper } from "../utils/textNormalization";

export default function TallerNuevaOrdenPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [bicicletas, setBicicletas] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [bicicletaId, setBicicletaId] = useState("");
  const [problema, setProblema] = useState("");
  const [fechaPrometida, setFechaPrometida] = useState("");
  const [prioridad, setPrioridad] = useState("normal");
  const [loading, setLoading] = useState(true);
  const [cargandoBicis, setCargandoBicis] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarNuevaBici, setMostrarNuevaBici] = useState(false);
  const [nuevaBici, setNuevaBici] = useState({ marca: "", modelo: "", rodado: "", color: "", numero_cuadro: "", notas: "" });
  const isMobile = useBreakpoint();
  const { usuarioId, sucursalId } = useSession();

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
    const upper = ["marca", "modelo", "color", "numero_cuadro"].includes(campo);
    setNuevaBici((prev) => ({
      ...prev,
      [campo]: upper ? normalizeTextUpper(valor) : valor,
    }));
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
        id_sucursal: sucursalId,
        id_cliente: Number(clienteId),
        id_bicicleta_cliente: Number(bicicletaId),
        problema_reportado: problema.trim(),
        fecha_prometida: fechaPrometida ? new Date(fechaPrometida).toISOString() : null,
        prioridad,
        id_usuario: usuarioId,
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

  const bicicletaSeleccionada = useMemo(
    () => bicicletas.find((bici) => String(bici.id) === String(bicicletaId)),
    [bicicletas, bicicletaId]
  );

  if (loading) return <div style={styles.state}>Cargando nueva orden...</div>;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Taller / ingreso</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Nueva orden de taller</h1>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>Cliente real, bicicleta identificada y problema claro antes de presupuestar.</p>
        </div>

        <Link to="/taller" style={{ ...styles.secondaryHeroButton, ...(isMobile ? styles.heroButtonMobile : {}) }}>← Volver</Link>
      </header>

      {error && <div style={styles.error}>Error: {error}</div>}

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Paso 1</p>
              <h2 style={styles.cardTitle}>Ingreso de bicicleta</h2>
              <p style={styles.muted}>Seleccioná cliente, bicicleta y describí exactamente qué dejó el cliente.</p>
            </div>
          </div>

          <form onSubmit={crearOrden} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Cliente *</span>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={styles.input}>
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    #{cliente.id} - {cliente.nombre}{cliente.telefono ? ` (${cliente.telefono})` : ""}
                  </option>
                ))}
              </select>
            </label>

            {Number(clienteId) === 1 && (
              <div style={styles.warning}>Taller no debería trabajar con Consumidor final. Cargá el cliente real antes de crear la orden.</div>
            )}

            <div style={styles.field}>
              <span style={styles.label}>Bicicleta *</span>
              {cargandoBicis ? (
                <div style={styles.emptyInline}>Cargando bicicletas...</div>
              ) : bicicletas.length === 0 ? (
                <div style={styles.warning}>Este cliente todavía no tiene bicicletas cargadas.</div>
              ) : (
                <select value={bicicletaId} onChange={(e) => setBicicletaId(e.target.value)} style={styles.input}>
                  {bicicletas.map((bici) => (
                    <option key={bici.id} value={bici.id}>#{bici.id} - {describirBicicleta(bici)}</option>
                  ))}
                </select>
              )}
            </div>

            <button type="button" onClick={() => setMostrarNuevaBici((v) => !v)} style={{ ...styles.secondaryButton, ...(isMobile ? styles.buttonMobile : {}) }}>
              {mostrarNuevaBici ? "Ocultar carga de bicicleta" : "＋ Cargar bicicleta del cliente"}
            </button>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 220px", gap: 12 }}>
              <label style={styles.field}>
                <span style={styles.label}>Fecha prometida</span>
                <input
                  type="datetime-local"
                  value={fechaPrometida}
                  onChange={(e) => setFechaPrometida(e.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Prioridad</span>
                <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} style={styles.input}>
                  <option value="normal">Normal</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Problema reportado *</span>
              <textarea
                value={problema}
                onChange={(e) => setProblema(normalizeTextUpper(e.target.value))}
                placeholder="Ej: freno trasero no responde, cambio salta en piñón 3, revisar transmisión completa..."
                rows={7}
                style={{ ...styles.input, resize: "vertical" }}
              />
            </label>

            <button type="submit" disabled={guardando} style={{ ...styles.primaryButton, ...(isMobile ? styles.buttonMobile : {}) }}>
              {guardando ? "Creando..." : "Crear orden de taller"}
            </button>
          </form>
        </section>

        <aside style={{ ...styles.sidePanel, ...(isMobile ? styles.sidePanelMobile : {}) }}>
          <section style={{ ...styles.sideCard, ...(isMobile ? styles.sideCardMobile : {}) }}>
            <h2 style={styles.sideTitle}>Resumen de ingreso</h2>
            <Info label="Cliente" value={clienteSeleccionado?.nombre || "-"} />
            <Info label="Teléfono" value={clienteSeleccionado?.telefono || "-"} />
            <Info label="Bicicleta" value={bicicletaSeleccionada ? describirBicicleta(bicicletaSeleccionada) : "-"} />
            <Info label="Bicis cargadas" value={bicicletas.length} />
            <Info label="Fecha prometida" value={fechaPrometida || "Sin fecha"} />
            <Info label="Prioridad" value={prioridad === "urgente" ? "Urgente" : "Normal"} />
            <div style={styles.note}>Si no registrás cliente y bicicleta real, después perdés historial, deuda, garantía y seguimiento.</div>
          </section>
        </aside>
      </main>

      {mostrarNuevaBici && (
        <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Paso auxiliar</p>
              <h2 style={styles.cardTitle}>Cargar bicicleta del cliente</h2>
              <p style={styles.muted}>Solo lo necesario para identificarla cuando vuelva al taller.</p>
            </div>
          </div>

          <form onSubmit={guardarBicicleta} style={{ ...styles.bikeGrid, ...(isMobile ? styles.bikeGridMobile : {}) }}>
            <Input label="Marca" value={nuevaBici.marca} onChange={(v) => cambiarNuevaBici("marca", v)} required />
            <Input label="Modelo" value={nuevaBici.modelo} onChange={(v) => cambiarNuevaBici("modelo", v)} required />
            <Input label="Rodado" value={nuevaBici.rodado} onChange={(v) => cambiarNuevaBici("rodado", v)} />
            <Input label="Color" value={nuevaBici.color} onChange={(v) => cambiarNuevaBici("color", v)} />
            <Input label="Número de cuadro" value={nuevaBici.numero_cuadro} onChange={(v) => cambiarNuevaBici("numero_cuadro", v)} />
            <Input label="Notas" value={nuevaBici.notas} onChange={(v) => cambiarNuevaBici("notas", v)} />
            <button type="submit" disabled={guardando} style={{ ...styles.primaryButton, gridColumn: "1 / -1", width: isMobile ? "100%" : "fit-content" }}>
              {guardando ? "Guardando..." : "Guardar bicicleta"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function Input({ label, value, onChange, required = false }) {
  const isMobile = useBreakpoint();
  return (
    <label style={{ ...styles.field, ...(isMobile ? styles.fieldMobile : {}) }}>
      <span style={styles.label}>{label}{required ? " *" : ""}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
    </label>
  );
}

function Info({ label, value }) {
  const isMobile = useBreakpoint();
  return (
    <div style={{ ...styles.infoBox, ...(isMobile ? styles.infoBoxMobile : {}) }}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
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

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  secondaryHeroButton: { textDecoration: "none", border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16, alignItems: "start" },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)", marginBottom: 16 },
  sectionHeader: { marginBottom: 14 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  cardTitle: { margin: "3px 0 0", fontSize: 22, letterSpacing: "-.02em" },
  muted: { color: "#64748b", margin: "4px 0 0", fontWeight: 700 },
  form: { display: "grid", gap: 14 },
  field: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  label: { color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  primaryButton: { border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 20px rgba(249,115,22,.22)" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "11px 14px", fontWeight: 1000, cursor: "pointer", width: "fit-content" },
  warning: { background: "#fffbeb", color: "#92400e", padding: 12, borderRadius: 14, border: "1px solid #fde68a", fontWeight: 800 },
  emptyInline: { color: "#64748b", fontWeight: 800, padding: 12, background: "#f8fafc", borderRadius: 12 },
  sidePanel: { position: "sticky", top: 16 },
  sideCard: { background: "#0f172a", color: "white", borderRadius: 22, padding: 18, boxShadow: "0 18px 40px rgba(15,23,42,.22)", display: "grid", gap: 10 },
  sideTitle: { margin: 0, fontSize: 22 },
  infoBox: { background: "#1e293b", borderRadius: 14, padding: 12, display: "grid", gap: 5, color: "#cbd5e1" },
  note: { marginTop: 4, background: "rgba(249,115,22,.14)", border: "1px solid rgba(251,146,60,.32)", color: "#fed7aa", borderRadius: 16, padding: 14, fontWeight: 800 },
  bikeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  state: { padding: 24, fontWeight: 900 },
  pageMobile: { padding: 10, overflowX: "hidden" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 14, padding: 18, borderRadius: 22, marginBottom: 12 },
  titleMobile: { fontSize: 27, lineHeight: 1.08 },
  subtitleMobile: { fontSize: 14, lineHeight: 1.35 },
  heroButtonMobile: { display: "block", width: "100%", textAlign: "center", boxSizing: "border-box" },
  layoutMobile: { gridTemplateColumns: "1fr", gap: 12 },
  cardMobile: { padding: 14, borderRadius: 18, marginBottom: 12 },
  buttonMobile: { width: "100%", textAlign: "center" },
  sidePanelMobile: { position: "static" },
  sideCardMobile: { borderRadius: 18, padding: 14 },
  bikeGridMobile: { gridTemplateColumns: "1fr", gap: 10 },
  fieldMobile: { minWidth: 0 },
  infoBoxMobile: { padding: 10, borderRadius: 12 },
};
