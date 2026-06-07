import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getParticipantesCapital } from "../../services/capitalRetirosService";
import {
  cambiarEstadoReglaRentabilidad,
  crearReglaRentabilidad,
  getReglasRentabilidad,
} from "../../services/rentabilidadService";
import { styles, formatPercent } from "./configuracionComercialStyles";

const reglaInicial = {
  nombre: "Regla familiar 3 partes",
  descripcion: "Reinversión, Ángel y Ale",
  items: [
    { id_participante: "", porcentaje: "33.34" },
    { id_participante: "", porcentaje: "33.33" },
    { id_participante: "", porcentaje: "33.33" },
  ],
};

function normalizarItems(items) {
  return items.map((item) => ({
    id_participante: item.id_participante ? Number(item.id_participante) : "",
    porcentaje: item.porcentaje === undefined || item.porcentaje === null ? "0" : String(item.porcentaje),
  }));
}

export default function DistribucionResultadosPanel() {
  const [reglas, setReglas] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [form, setForm] = useState(reglaInicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const reglaActiva = useMemo(() => {
    return reglas.find((regla) => regla.activa) || null;
  }, [reglas]);

  const totalPorcentaje = useMemo(() => {
    return form.items.reduce((acc, item) => acc + Number(item.porcentaje || 0), 0);
  }, [form.items]);

  async function cargarDatos() {
    setLoading(true);
    setError("");

    try {
      const [reglasData, participantesData] = await Promise.all([
        getReglasRentabilidad({ incluir_inactivas: true }),
        getParticipantesCapital({ incluir_inactivos: true }),
      ]);

      setReglas(reglasData || []);
      setParticipantes(participantesData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la distribución de resultados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function cargarDesdeRegla(regla) {
    setForm({
      nombre: `${regla.nombre} copia`,
      descripcion: regla.descripcion || "",
      items: normalizarItems(regla.items || []),
    });
    setMostrarFormulario(true);
  }

  function actualizarItem(index, campo, valor) {
    setForm((actual) => ({
      ...actual,
      items: actual.items.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)),
    }));
  }

  function agregarDestino() {
    setForm((actual) => ({
      ...actual,
      items: [...actual.items, { id_participante: "", porcentaje: "0" }],
    }));
  }

  function quitarDestino(index) {
    setForm((actual) => ({
      ...actual,
      items: actual.items.filter((_, i) => i !== index),
    }));
  }

  async function guardarRegla(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      setError("La distribución debe sumar 100%.");
      return;
    }

    const ids = form.items.map((item) => Number(item.id_participante)).filter(Boolean);
    const idsUnicos = new Set(ids);

    if (ids.length !== form.items.length) {
      setError("Todos los destinos deben tener un participante.");
      return;
    }

    if (idsUnicos.size !== ids.length) {
      setError("No repitas participantes en la misma regla.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || null,
        items: form.items.map((item) => ({
          id_participante: Number(item.id_participante),
          porcentaje: Number(item.porcentaje),
        })),
      };

      await crearReglaRentabilidad(payload);
      setOk("Regla de distribución creada correctamente.");
      setMostrarFormulario(false);
      setForm(reglaInicial);
      await cargarDatos();
    } catch (err) {
      setError(err.message || "No se pudo guardar la regla de distribución");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(regla, activa) {
    setError("");
    setOk("");

    try {
      await cambiarEstadoReglaRentabilidad(regla.id, activa);
      setOk(activa ? "Regla activada correctamente." : "Regla desactivada correctamente.");
      await cargarDatos();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado de la regla");
    }
  }

  const participantesActivos = participantes.filter((p) => p.activo);

  return (
    <section style={styles.section}>
      <div
        style={{
          ...styles.sectionTitle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div>Distribución de resultados</div>
          <div style={{ marginTop: 4, color: "#667085", fontSize: 13, fontWeight: 500 }}>
            Define cómo se reparte el resultado mensual entre reinversión y participantes.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/rentabilidad" style={{ ...styles.cancelBtn, textDecoration: "none" }}>
            Ver rentabilidad
          </Link>
          <button
            type="button"
            style={styles.saveBtn}
            onClick={() => {
              setMostrarFormulario((valor) => !valor);
              setError("");
              setOk("");
            }}
          >
            {mostrarFormulario ? "Ocultar" : "Nueva regla"}
          </button>
        </div>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {ok ? (
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              borderRadius: 10,
              padding: 10,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {ok}
          </div>
        ) : null}

        {loading ? (
          <div style={styles.loading}>Cargando distribución...</div>
        ) : (
          <>
            <div
              style={{
                border: "1px solid #eaecf0",
                borderRadius: 14,
                background: "#f9fafb",
                padding: 14,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>Regla vigente</div>
                  <div style={{ color: "#101828", fontSize: 18, fontWeight: 950 }}>
                    {reglaActiva ? reglaActiva.nombre : "Sin regla activa"}
                  </div>
                </div>

                {reglaActiva ? (
                  <button type="button" style={styles.editBtn} onClick={() => cargarDesdeRegla(reglaActiva)}>
                    Usar como base
                  </button>
                ) : null}
              </div>

              {!reglaActiva ? (
                <div style={{ color: "#b45309", fontSize: 14 }}>
                  Configurá una regla antes de cerrar rentabilidad mensual.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                  {(reglaActiva.items || []).map((item) => (
                    <div key={item.id_participante} style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: 10, background: "white" }}>
                      <div style={{ color: "#101828", fontWeight: 900 }}>{item.participante_nombre}</div>
                      <div style={{ color: "#f97316", fontSize: 20, fontWeight: 950 }}>{formatPercent(item.porcentaje)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {mostrarFormulario ? (
              <form onSubmit={guardarRegla} style={{ border: "1px solid #eaecf0", borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6, color: "#344054", fontSize: 13, fontWeight: 800 }}>
                    Nombre
                    <input
                      style={styles.input}
                      value={form.nombre}
                      onChange={(e) => setForm((actual) => ({ ...actual, nombre: e.target.value }))}
                      required
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6, color: "#344054", fontSize: 13, fontWeight: 800 }}>
                    Descripción
                    <input
                      style={styles.input}
                      value={form.descripcion}
                      onChange={(e) => setForm((actual) => ({ ...actual, descripcion: e.target.value }))}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {form.items.map((item, index) => (
                    <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px auto", gap: 8, alignItems: "center" }}>
                      <select
                        style={styles.input}
                        value={item.id_participante}
                        onChange={(e) => actualizarItem(index, "id_participante", e.target.value)}
                        required
                      >
                        <option value="">Participante</option>
                        {participantesActivos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>

                      <input
                        style={styles.input}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.porcentaje}
                        onChange={(e) => actualizarItem(index, "porcentaje", e.target.value)}
                        required
                      />

                      <button
                        type="button"
                        style={styles.cancelBtn}
                        disabled={form.items.length <= 1}
                        onClick={() => quitarDestino(index)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ color: Math.abs(totalPorcentaje - 100) < 0.01 ? "#166534" : "#b91c1c", fontWeight: 900 }}>
                    Total: {totalPorcentaje.toFixed(2)}%
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={styles.cancelBtn} onClick={agregarDestino}>
                      Agregar destino
                    </button>
                    <button type="submit" style={styles.saveBtn} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar nueva regla"}
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            <div style={styles.table}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                  gap: 12,
                  padding: 14,
                  background: "#f9fafb",
                  fontWeight: 700,
                  color: "#667085",
                  fontSize: 13,
                }}
              >
                <div>Regla</div>
                <div>Distribución</div>
                <div>Estado</div>
                <div>Acciones</div>
              </div>

              {reglas.length === 0 ? (
                <div style={{ padding: 14, color: "#667085", borderTop: "1px solid #f2f4f7" }}>
                  Todavía no hay reglas de distribución.
                </div>
              ) : (
                reglas.map((regla) => (
                  <div
                    key={regla.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                      gap: 12,
                      padding: 14,
                      borderTop: "1px solid #f2f4f7",
                      alignItems: "center",
                      fontSize: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: "#101828" }}>{regla.nombre}</div>
                      <div style={{ color: "#667085", fontSize: 12 }}>{regla.descripcion || "Sin descripción"}</div>
                    </div>
                    <div style={{ color: "#475467", fontSize: 13 }}>
                      {(regla.items || []).map((item) => `${item.participante_nombre}: ${formatPercent(item.porcentaje)}`).join(" · ")}
                    </div>
                    <div>
                      <span
                        style={{
                          ...styles.badge,
                          background: regla.activa ? "#ecfdf3" : "#f2f4f7",
                          color: regla.activa ? "#027a48" : "#667085",
                        }}
                      >
                        {regla.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <div style={styles.actionsCell}>
                      <button type="button" style={styles.editBtn} onClick={() => cargarDesdeRegla(regla)}>
                        Copiar
                      </button>
                      {regla.activa ? (
                        <button type="button" style={styles.cancelBtn} onClick={() => cambiarEstado(regla, false)}>
                          Desactivar
                        </button>
                      ) : (
                        <button type="button" style={styles.saveBtn} onClick={() => cambiarEstado(regla, true)}>
                          Activar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
