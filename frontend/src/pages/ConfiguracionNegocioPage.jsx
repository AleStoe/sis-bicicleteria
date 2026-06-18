import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { DEFAULT_CONFIGURACION_NEGOCIO } from "../config/defaultConfiguracionNegocio";
import {
  actualizarConfiguracionNegocio,
  obtenerConfiguracionNegocio,
} from "../services/configuracionNegocioService";

const CAMPOS_TEXTO_LARGO = [
  ["horarios_retiro", "Horarios de retiro"],
  ["whatsapp_cierre", "Cierre general WhatsApp"],
  ["texto_beneficio_pago", "Texto beneficio efectivo / transferencia"],
  ["plantilla_turno_confirmacion", "WhatsApp turno confirmado"],
  ["plantilla_turno_recordatorio", "WhatsApp recordatorio turno"],
  ["plantilla_turno_aviso", "WhatsApp aviso agenda"],
  ["plantilla_retiro_taller", "WhatsApp bici lista para retirar"],
  ["plantilla_cotizacion_whatsapp", "WhatsApp cotización"],
  ["condiciones_presupuesto_taller", "Condiciones presupuesto taller"],
  ["condiciones_cotizacion", "Condiciones cotización"],
];

const VARIABLES = [
  "{cliente_nombre}",
  "{nombre_negocio}",
  "{fecha_turno}",
  "{momento_turno}",
  "{tipo_servicio}",
  "{fecha_prometida_bloque}",
  "{bicicleta}",
  "{trabajos_bloque}",
  "{total_bloque}",
  "{horarios_retiro}",
  "{whatsapp_cierre}",
  "{numero_cotizacion}",
  "{tipo_cotizacion}",
  "{consulta_bloque}",
  "{detalle_bloque}",
  "{total}",
  "{validez_bloque}",
  "{texto_beneficio_pago}",
];

export default function ConfiguracionNegocioPage() {
  const [form, setForm] = useState(DEFAULT_CONFIGURACION_NEGOCIO);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      const data = await obtenerConfiguracionNegocio();
      setForm({ ...DEFAULT_CONFIGURACION_NEGOCIO, ...(data || {}) });
    } catch (err) {
      setError(err.message || "No se pudo cargar la configuración");
      setForm(DEFAULT_CONFIGURACION_NEGOCIO);
    } finally {
      setLoading(false);
    }
  }

  function cambiar(campo, value) {
    setForm((prev) => ({ ...prev, [campo]: value }));
  }

  async function guardar(e) {
    e.preventDefault();
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const data = await actualizarConfiguracionNegocio(form);
      setForm({ ...DEFAULT_CONFIGURACION_NEGOCIO, ...(data || {}) });
      setMensaje("Configuración guardada correctamente");
    } catch (err) {
      setError(err.message || "No se pudo guardar la configuración");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <div style={styles.state}>Cargando configuración...</div>;

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <p style={styles.kicker}>Sistema</p>
          <h1 style={styles.title}>Configuración del negocio</h1>
          <p style={styles.subtitle}>Textos y plantillas usados en WhatsApp y documentos.</p>
        </div>
        <button type="button" onClick={cargar} style={styles.heroButton}>
          <RefreshCw size={17} /> Refrescar
        </button>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <main style={styles.layout}>
        <form onSubmit={guardar} style={styles.panel}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Datos generales</h2>
            <div style={styles.grid}>
              <Field label="Nombre negocio">
                <input value={form.nombre_negocio || ""} onChange={(e) => cambiar("nombre_negocio", e.target.value)} style={styles.input} />
              </Field>
              <Field label="Teléfono">
                <input value={form.telefono || ""} onChange={(e) => cambiar("telefono", e.target.value)} style={styles.input} />
              </Field>
              <Field label="Dirección">
                <input value={form.direccion || ""} onChange={(e) => cambiar("direccion", e.target.value)} style={styles.input} />
              </Field>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Opciones WhatsApp retiro</h2>
            <label style={styles.check}>
              <input type="checkbox" checked={Boolean(form.whatsapp_retiro_mostrar_total)} onChange={(e) => cambiar("whatsapp_retiro_mostrar_total", e.target.checked)} />
              Mostrar total en WhatsApp de retiro
            </label>
            <label style={styles.check}>
              <input type="checkbox" checked={Boolean(form.whatsapp_retiro_mostrar_trabajos)} onChange={(e) => cambiar("whatsapp_retiro_mostrar_trabajos", e.target.checked)} />
              Mostrar trabajos realizados en WhatsApp de retiro
            </label>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Textos y plantillas</h2>
            <div style={styles.textAreas}>
              {CAMPOS_TEXTO_LARGO.map(([campo, label]) => (
                <Field key={campo} label={label}>
                  <textarea value={form[campo] || ""} onChange={(e) => cambiar(campo, e.target.value)} style={styles.textarea} />
                </Field>
              ))}
            </div>
          </section>

          <button type="submit" disabled={guardando} style={styles.primaryButton}>
            <Save size={17} /> {guardando ? "Guardando..." : "Guardar configuración"}
          </button>
        </form>

        <aside style={styles.help}>
          <h2 style={styles.sectionTitle}>Variables disponibles</h2>
          <p style={styles.helpText}>Usalas entre llaves dentro de las plantillas. Si una variable no aplica, sale vacía.</p>
          <div style={styles.variables}>
            {VARIABLES.map((variable) => (
              <code key={variable} style={styles.variable}>{variable}</code>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 18, background: "#0f172a", color: "white", marginBottom: 16 },
  kicker: { margin: 0, color: "#38bdf8", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  title: { margin: "4px 0 0", fontSize: 32, fontWeight: 1000 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroButton: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 12, padding: "11px 14px", fontWeight: 1000, cursor: "pointer" },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, alignItems: "start" },
  panel: { display: "grid", gap: 14, background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16 },
  section: { display: "grid", gap: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 14 },
  sectionTitle: { margin: 0, fontSize: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  field: { display: "grid", gap: 6, color: "#334155", fontWeight: 900 },
  input: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px", fontWeight: 750 },
  textAreas: { display: "grid", gap: 12 },
  textarea: { minHeight: 125, border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, fontWeight: 700, resize: "vertical", fontFamily: "inherit" },
  check: { display: "flex", alignItems: "center", gap: 8, fontWeight: 850 },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: "#0f766e", color: "white", borderRadius: 12, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  help: { display: "grid", gap: 10, background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, position: "sticky", top: 16 },
  helpText: { margin: 0, color: "#64748b", fontWeight: 700 },
  variables: { display: "flex", flexWrap: "wrap", gap: 7 },
  variable: { background: "#ecfeff", color: "#155e75", border: "1px solid #a5f3fc", borderRadius: 999, padding: "5px 8px", fontWeight: 900 },
  success: { background: "#ecfdf3", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 12, padding: 12, marginBottom: 12, fontWeight: 900 },
  error: { background: "#fff1f0", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 12, padding: 12, marginBottom: 12, fontWeight: 900 },
  state: { padding: 24, fontWeight: 900 },
};
