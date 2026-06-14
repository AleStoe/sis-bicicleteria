import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listarTurnosAgenda,
  crearTurnoAgenda,
  cambiarEstadoTurnoAgenda,
  convertirTurnoAOrden,
  marcarRecordatorioEnviado,
} from "../services/agendaTallerService";
import {
  listarClientes,
  listarBicicletasCliente,
} from "../services/clientesService";
import { useSession } from "../context/SessionContext";

const ESTADOS = [
  "pendiente",
  "confirmado",
  "en_taller",
  "cancelado",
  "convertido_orden",
];

const FORM_INICIAL = {
  id_cliente: null,
  id_bicicleta_cliente: null,
  cliente_nombre: "",
  cliente_telefono: "",
  fecha: "",
  franja: "mañana",
  hora_inicio: "09:00",
  tipo_servicio: "",
  descripcion: "",
};

export default function AgendaTallerPage() {
  const navigate = useNavigate();
  const { usuarioId, sucursalId } = useSession();

  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState(FORM_INICIAL);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientesEncontrados, setClientesEncontrados] = useState([]);
  const [bicicletasCliente, setBicicletasCliente] = useState([]);

const [filtros, setFiltros] = useState({
  fecha_desde: "",
  fecha_hasta: "",
  estado: "",
});

  useEffect(() => {
    cargarTurnos();
  }, [sucursalId]);

  useEffect(() => {
  const texto = busquedaCliente.trim();

  if (texto.length < 2 || form.id_cliente) {
    setClientesEncontrados([]);
    return;
  }

  const timeout = setTimeout(async () => {
    try {
      const data = await listarClientes({
        q: texto,
        solo_activos: true,
      });

      setClientesEncontrados(Array.isArray(data) ? data : []);
    } catch {
      setClientesEncontrados([]);
    }
  }, 300);

  return () => clearTimeout(timeout);
}, [busquedaCliente, form.id_cliente]);

  async function cargarTurnos() {
    try {
      setLoading(true);
      setError("");

      const data = await listarTurnosAgenda({
        id_sucursal: sucursalId,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        estado: filtros.estado,
      });

      setTurnos(data ?? []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la agenda");
    } finally {
      setLoading(false);
    }
  }

  

  async function seleccionarCliente(cliente) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      setForm((current) => ({
        ...current,
        id_cliente: cliente.id,
        id_bicicleta_cliente: null,
        cliente_nombre: cliente.nombre || "",
        cliente_telefono: cliente.telefono || "",
      }));

      setBusquedaCliente(cliente.nombre || "");
      setClientesEncontrados([]);

      const bicis = await listarBicicletasCliente(cliente.id);
      const lista = Array.isArray(bicis) ? bicis : [];

      setBicicletasCliente(lista);

      if (lista.length === 1) {
        setForm((current) => ({
          ...current,
          id_bicicleta_cliente: lista[0].id,
        }));
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas del cliente");
    } finally {
      setProcesando(false);
    }
  }

  function seleccionarBicicleta(bicicletaId) {
    setForm((current) => ({
      ...current,
      id_bicicleta_cliente: bicicletaId ? Number(bicicletaId) : null,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (!form.id_cliente) {
      setError("Seleccioná un cliente existente.");
      return;
    }

    if (!form.id_bicicleta_cliente) {
      setError("Seleccioná una bicicleta del cliente.");
      return;
    }

    if (!form.fecha) {
      setError("La fecha es obligatoria.");
      return;
    }

    if (!form.tipo_servicio.trim()) {
      setError("El tipo de servicio es obligatorio.");
      return;
    }

    try {
      setProcesando(true);

      await crearTurnoAgenda({
        ...form,
        cliente_nombre: form.cliente_nombre.trim(),
        cliente_telefono: form.cliente_telefono?.trim() || null,
        tipo_servicio: form.tipo_servicio.trim(),
        descripcion: form.descripcion.trim() || null,
        id_sucursal: sucursalId,
        id_usuario_creador: usuarioId,
      });

      setForm(FORM_INICIAL);
      setBusquedaCliente("");
      setClientesEncontrados([]);
      setBicicletasCliente([]);
      setMensaje("Turno creado correctamente");

      await cargarTurnos();
    } catch (err) {
      setError(err.message || "No se pudo crear el turno");
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(turnoId, estado) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await cambiarEstadoTurnoAgenda(turnoId, { estado });

      setMensaje("Estado actualizado");
      await cargarTurnos();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado");
    } finally {
      setProcesando(false);
    }
  }

  async function crearOrdenDesdeTurno(turno) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      if (!turno.id_cliente || !turno.id_bicicleta_cliente) {
        setError("Para crear la orden, el turno debe tener cliente y bicicleta asociados.");
        return;
      }

      const resp = await convertirTurnoAOrden(turno.id, {
        id_usuario: usuarioId,
      });

      setMensaje(`Orden #${resp.orden_id} creada desde agenda`);
      await cargarTurnos();
    } catch (err) {
      setError(err.message || "No se pudo crear la orden desde el turno");
    } finally {
      setProcesando(false);
    }
  }
  async function copiarConfirmacionTurno(turno) {
    const momento =
      turno.franja === "mañana"
        ? "por la mañana"
        : "por la tarde";

    const mensajeTurno = `Hola ${turno.cliente_nombre} 👋

    Tu turno quedó agendado para el ${formatFecha(turno.fecha)} ${momento} en Emprendimiento Agus.

    Trabajo solicitado:
    ${turno.tipo_servicio}

    ¡Muchas gracias! 🚲`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(mensajeTurno);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = mensajeTurno;

        document.body.appendChild(textarea);
        textarea.select();

        document.execCommand("copy");

        document.body.removeChild(textarea);
      }

      setMensaje("Mensaje copiado al portapapeles.");
    } catch (err) {
      console.error(err);

      alert(mensajeTurno);
    }
  }

async function copiarRecordatorioTurno(turno) {
  const momento =
    turno.franja === "mañana"
      ? "por la mañana"
      : "por la tarde";

  const mensajeTurno = `Hola ${turno.cliente_nombre} 👋

Te recordamos que el ${formatFecha(turno.fecha)} ${momento} te esperamos en Emprendimiento Agus para recibir tu bicicleta.

Trabajo solicitado:
${turno.tipo_servicio}

Si necesitás reprogramar, avisanos con anticipación.

¡Muchas gracias! 🚲`;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(mensajeTurno);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = mensajeTurno;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    await marcarRecordatorioEnviado(turno.id);
    setMensaje(
                "Recordatorio copiado. El cliente quedó marcado como avisado."
              );
    await cargarTurnos();
  } catch (err) {
    console.error(err);
    alert(mensajeTurno);
  }
}

  const turnosPorDia = useMemo(() => {
    return turnos.reduce((acc, turno) => {
      const fecha = turno.fecha || "Sin fecha";
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(turno);
      return acc;
    }, {});
  }, [turnos]);

  return (
    <div style={styles.page}>
      <div>
        <h1 style={styles.title}>Agenda Taller</h1>
        <p style={styles.subtitle}>
          Turnos, ingresos previstos y organización diaria del taller.
        </p>
      </div>

      {error ? <div style={styles.alertError}>{error}</div> : null}
      {mensaje ? <div style={styles.alertSuccess}>{mensaje}</div> : null}

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Nuevo turno</h2>

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Buscar cliente</label>

            <input
              placeholder="Escribí nombre, teléfono, DNI o CUIT"
              value={busquedaCliente}
              onChange={(e) => {
                setBusquedaCliente(e.target.value);

                if (form.id_cliente) {
                  setForm((current) => ({
                    ...current,
                    id_cliente: null,
                    id_bicicleta_cliente: null,
                    cliente_nombre: "",
                    cliente_telefono: "",
                  }));
                  setBicicletasCliente([]);
                }
              }}
              style={styles.input}
            />

            {clientesEncontrados.length > 0 ? (
              <div style={styles.resultsBox}>
                {clientesEncontrados.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => seleccionarCliente(cliente)}
                    style={styles.resultButton}
                  >
                    <strong>{cliente.nombre}</strong>
                    <span>{cliente.telefono || "Sin teléfono"}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {form.id_cliente ? (
              <div style={styles.selectedBox}>
                <strong>{form.cliente_nombre}</strong>
                <span>{form.cliente_telefono || "Sin teléfono"}</span>
              </div>
            ) : null}

            <label style={styles.label}>Bicicleta</label>

            <select
              value={form.id_bicicleta_cliente || ""}
              onChange={(e) => seleccionarBicicleta(e.target.value)}
              style={styles.input}
              disabled={!form.id_cliente || bicicletasCliente.length === 0}
            >
              <option value="">
                {form.id_cliente
                  ? "Seleccionar bicicleta"
                  : "Primero seleccioná un cliente"}
              </option>

              {bicicletasCliente.map((bici) => (
                <option key={bici.id} value={bici.id}>
                  {formatBicicleta(bici)}
                </option>
              ))}
            </select>

            {form.id_cliente && bicicletasCliente.length === 0 ? (
              <div style={styles.warningText}>
                Este cliente no tiene bicicletas cargadas. Cargala desde la ficha del cliente antes de agendar.
              </div>
            ) : null}

            <div style={styles.twoCols}>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                style={styles.input}
              />

              <select
                value={form.franja}
                onChange={(e) => {
                  const franja = e.target.value;

                  setForm({
                    ...form,
                    franja,
                    hora_inicio: franja === "mañana" ? "09:00" : "16:30",
                  });
                }}
                style={styles.input}
              >
                <option value="mañana">Mañana (09:00 a 12:00)</option>
                <option value="tarde">Tarde (16:30 a 19:00)</option>
              </select>
            </div>

            <input
              type="time"
              value={form.hora_inicio}
              onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder="Tipo de servicio"
              value={form.tipo_servicio}
              onChange={(e) => setForm({ ...form, tipo_servicio: e.target.value })}
              style={styles.input}
            />

            <textarea
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              style={styles.textarea}
            />

            <button type="submit" style={styles.primaryButton} disabled={procesando}>
              Crear turno
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <h2 style={styles.cardTitle}>Turnos</h2>
              <p style={styles.muted}>{turnos.length} turno(s) encontrados</p>
            </div>

            <button
              type="button"
              onClick={cargarTurnos}
              style={styles.secondaryButton}
              disabled={loading}
            >
              Refrescar
            </button>
          </div>

          <div style={styles.filters}>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) =>
                setFiltros({ ...filtros, fecha_desde: e.target.value })
              }
              style={styles.input}
            />

            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) =>
                setFiltros({ ...filtros, fecha_hasta: e.target.value })
              }
              style={styles.input}
            />

            <select
              value={filtros.estado}
              onChange={(e) =>
                setFiltros({ ...filtros, estado: e.target.value })
              }
              style={styles.input}
            >
              <option value="">Todos</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>

            <button type="button" onClick={cargarTurnos} style={styles.primaryButton}>
              Filtrar
            </button>
          </div>

          {loading ? (
            <div style={styles.empty}>Cargando...</div>
          ) : Object.keys(turnosPorDia).length === 0 ? (
            <div style={styles.empty}>No hay turnos para mostrar.</div>
          ) : (
            Object.entries(turnosPorDia).map(([fecha, items]) => (
              <div key={fecha} style={styles.dayGroup}>
                <h3 style={styles.dayTitle}>{formatFecha(fecha)}</h3>

                {items.map((turno) => (
                  <article key={turno.id} style={styles.turno}>
                    <div style={styles.turnoTop}>
                      <div>
                        <strong>
                          {labelFranja(turno.franja)}
                          {turno.hora_inicio ? ` · ${turno.hora_inicio.slice(0, 5)}` : ""} · {turno.cliente_nombre}
                        </strong>
                        <div style={styles.muted}>
                          {turno.cliente_telefono || "Sin teléfono"}
                        </div>
                      </div>

                      <span style={{ ...styles.estado, ...getEstadoStyle(turno.estado) }}>
                        {turno.estado}
                      </span>
                    </div>

                    <div style={styles.service}>{turno.tipo_servicio}</div>

                    {turno.descripcion ? (
                      <div style={styles.descripcion}>{turno.descripcion}</div>
                    ) : null}

                   {turno.bicicleta_descripcion ? (
                      <div style={styles.metaLine}>
                        🚲 {turno.bicicleta_descripcion}
                      </div>
                    ) : null}

                    {turno.recordatorio_enviado ? (
                      <div style={styles.recordadoOk}>📲 Cliente avisado</div>
                    ) : (
                      <div style={styles.recordadoPendiente}>⏳ Falta avisar</div>
                    )}

                    <div style={styles.actions}>
                      {turno.id_orden_taller ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/taller/${turno.id_orden_taller}`)}
                          disabled={procesando}
                        >
                          Abrir orden #{turno.id_orden_taller}
                        </button>
                      ) : (
                        <>
                          {turno.estado === "pendiente" ? (
                            <button
                              type="button"
                              onClick={() => cambiarEstado(turno.id, "confirmado")}
                              disabled={procesando}
                            >
                              Confirmar
                            </button>
                          ) : null}

                          {turno.estado !== "cancelado" ? (
                            <button
                              type="button"
                              onClick={() => cambiarEstado(turno.id, "cancelado")}
                              disabled={procesando}
                            >
                              Cancelar
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => copiarConfirmacionTurno(turno)}
                            disabled={procesando || !turno.cliente_telefono}
                          >
                            Copiar confirmación
                          </button>

                          <button
                            type="button"
                            onClick={() => copiarRecordatorioTurno(turno)}
                            disabled={procesando || !turno.cliente_telefono || turno.recordatorio_enviado}
                          >
                            Copiar recordatorio
                          </button>
                          <button
                            type="button"
                            onClick={() => crearOrdenDesdeTurno(turno)}
                            disabled={procesando || turno.estado === "cancelado"}
                          >
                            Crear orden
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function formatFecha(fecha) {
  if (!fecha || fecha === "Sin fecha") return fecha || "-";

  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR");
}

function labelFranja(franja) {
  if (franja === "mañana") return "Mañana";
  if (franja === "tarde") return "Tarde";
  return "Sin franja";
}

function getEstadoStyle(estado) {
  if (estado === "pendiente") {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (estado === "confirmado") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (estado === "convertido_orden") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (estado === "cancelado") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {};
}
function formatBicicleta(bici) {
  const texto = [
    bici.marca,
    bici.modelo,
    bici.rodado ? `R${bici.rodado}` : null,
    bici.color,
    bici.numero_cuadro ? `Cuadro ${bici.numero_cuadro}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return texto || `Bicicleta #${bici.id}`;
}

const styles = {
  page: { display: "grid", gap: 20 },
  title: { margin: 0, color: "#0f172a" },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 20 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: { margin: 0, color: "#0f172a" },
  label: {
    display: "block",
    margin: "12px 0 6px",
    color: "#334155",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    marginBottom: 10,
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
  },
  textarea: {
    width: "100%",
    minHeight: 100,
    marginBottom: 10,
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
  },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  searchRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10 },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    padding: "10px 14px",
    cursor: "pointer",
    border: 0,
    borderRadius: 10,
    background: "#ea580c",
    color: "white",
    fontWeight: 900,
  },
  secondaryButton: {
    padding: "10px 14px",
    cursor: "pointer",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "white",
    fontWeight: 900,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsBox: {
    display: "grid",
    gap: 8,
    marginBottom: 12,
  },
  resultButton: {
    display: "grid",
    gap: 2,
    textAlign: "left",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    cursor: "pointer",
  },
  selectedBox: {
    display: "grid",
    gap: 2,
    marginBottom: 12,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    borderRadius: 10,
    padding: 10,
    color: "#166534",
  },
  warningText: {
    marginTop: -4,
    marginBottom: 10,
    color: "#9a3412",
    fontWeight: 800,
    fontSize: 13,
  },
  dayGroup: { marginTop: 18 },
  dayTitle: { margin: "0 0 10px", color: "#334155" },
  turno: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  turnoTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  estado: {
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 999,
    padding: "5px 9px",
    fontWeight: 900,
    fontSize: 12,
  },
  service: { marginTop: 10, fontWeight: 900, color: "#0f172a" },
  descripcion: { marginTop: 6, color: "#475569" },
  metaLine: {
    marginTop: 8,
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
  },
  muted: { color: "#64748b", fontWeight: 700, fontSize: 13 },
  actions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  alertError: {
    padding: 12,
    borderRadius: 12,
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 800,
  },
  alertSuccess: {
    padding: 12,
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 800,
  },
  recordadoOk: {
  marginTop: 8,
  color: "#166534",
  background: "#dcfce7",
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: 12,
  width: "fit-content",
},
recordadoPendiente: {
  marginTop: 8,
  color: "#92400e",
  background: "#fef3c7",
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: 12,
  width: "fit-content",
},
  empty: { padding: 18, color: "#64748b", fontWeight: 800 },
};