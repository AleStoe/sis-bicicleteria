import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarClientes, listarBicicletasCliente, crearBicicletaCliente } from "../services/clientesService";
import { crearOrdenTaller } from "../services/tallerService";
import { Card, EmptyState, PageHeader, useBreakpoint } from "../components/ui";
import { ArrowLeft, Bike } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { normalizeTextUpper } from "../utils/textNormalization";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";

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

  if (loading) {
    return <EmptyState icon={Bike} title="Cargando nueva orden..." description="Preparando clientes y bicicletas." />;
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title="Nueva orden de taller"
        subtitle="Cliente real, bicicleta identificada y problema claro antes de presupuestar."
        actions={(
          <Link to="/taller" style={styles.secondaryLink}>
            <ArrowLeft size={17} aria-hidden="true" />
            Volver
          </Link>
        )}
      />

      {error && <div style={styles.error}>Error: {error}</div>}

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <Card style={isMobile ? styles.cardMobile : undefined}>
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
        </Card>

        <aside style={{ ...styles.sidePanel, ...(isMobile ? styles.sidePanelMobile : {}) }}>
          <Card title="Resumen de ingreso" style={isMobile ? styles.sideCardMobile : undefined}>
            <Info label="Cliente" value={clienteSeleccionado?.nombre || "-"} />
            <Info label="Teléfono" value={clienteSeleccionado?.telefono || "-"} />
            <Info label="Bicicleta" value={bicicletaSeleccionada ? describirBicicleta(bicicletaSeleccionada) : "-"} />
            <Info label="Bicis cargadas" value={bicicletas.length} />
            <Info label="Fecha prometida" value={fechaPrometida || "Sin fecha"} />
            <Info label="Prioridad" value={prioridad === "urgente" ? "Urgente" : "Normal"} />
            <div style={styles.note}>Si no registrás cliente y bicicleta real, después perdés historial, deuda, garantía y seguimiento.</div>
          </Card>
        </aside>
      </main>

      {mostrarNuevaBici && (
        <Card style={isMobile ? styles.cardMobile : undefined}>
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
        </Card>
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
  page: { minHeight: "100vh", display: "grid", gap: spacing.xl, color: colors.text, fontFamily: typography.fontFamily },
  secondaryLink: { minHeight: controls.minHeight, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: spacing.sm, textDecoration: "none", border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, borderRadius: radius.md, padding: controls.padding, fontWeight: typography.button.fontWeight },
  error: { background: colors.dangerSoft, color: colors.dangerDark, border: `1px solid ${colors.danger}`, borderRadius: radius.md, padding: spacing.md, fontWeight: typography.label.fontWeight },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: spacing.lg, alignItems: "start" },
  sectionHeader: { marginBottom: 14 },
  eyebrow: { margin: 0, color: colors.primary, fontSize: typography.small.fontSize, fontWeight: typography.label.fontWeight, textTransform: "uppercase" },
  cardTitle: { margin: "3px 0 0", fontSize: typography.sectionTitle.fontSize, fontWeight: typography.sectionTitle.fontWeight },
  muted: { color: colors.textMuted, margin: "4px 0 0", lineHeight: typography.body.lineHeight },
  form: { display: "grid", gap: spacing.lg },
  field: { display: "grid", gap: spacing.sm, fontSize: typography.label.fontSize, fontWeight: typography.label.fontWeight },
  label: { color: colors.text },
  input: { width: "100%", minHeight: controls.minHeight, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: controls.padding, fontSize: typography.body.fontSize, color: colors.text, boxSizing: "border-box", background: colors.surface },
  primaryButton: { minHeight: controls.minHeight, border: "none", background: colors.primary, color: colors.surface, borderRadius: radius.md, padding: controls.padding, fontWeight: typography.button.fontWeight, cursor: "pointer", boxShadow: shadows.sm },
  secondaryButton: { minHeight: controls.minHeight, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, borderRadius: radius.md, padding: controls.padding, fontWeight: typography.button.fontWeight, cursor: "pointer", width: "fit-content" },
  warning: { background: colors.warningSoft, color: colors.warningDark, padding: spacing.md, borderRadius: radius.md, border: `1px solid ${colors.warning}`, fontWeight: typography.label.fontWeight },
  emptyInline: { color: colors.textMuted, padding: spacing.md, background: colors.surfaceMuted, borderRadius: radius.md },
  sidePanel: { position: "sticky", top: 16 },
  infoBox: { background: colors.surfaceMuted, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: spacing.md, display: "grid", gap: 5, color: colors.textMuted },
  note: { marginTop: spacing.sm, background: colors.primarySoft, border: `1px solid ${colors.primaryBorder}`, color: colors.secondary, borderRadius: radius.md, padding: spacing.md, fontWeight: typography.label.fontWeight },
  bikeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  state: { padding: 24, fontWeight: 900 },
  pageMobile: { overflowX: "hidden" },
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
