import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listarTurnosAgenda,
  listarTurnosAgendaParaManana,
  listarTurnosAgendaAtrasados,
  crearTurnoAgenda,
  editarTurnoAgenda,
  cambiarEstadoTurnoAgenda,
  convertirTurnoAOrden,
  marcarRecordatorioEnviado,
  marcarClienteAvisado,
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

const VISTAS = {
  GENERAL: "general",
  PARA_MANANA: "para_manana",
  ATRASADAS: "atrasadas",
};

const FORM_INICIAL = {
  id_cliente: null,
  id_bicicleta_cliente: null,
  cliente_nombre: "",
  cliente_telefono: "",
  fecha: "",
  fecha_prometida_entrega: "",
  franja: "mañana",
  hora_inicio: "09:00",
  hora_fin: "",
  tipo_servicio: "",
  descripcion: "",
  notas: "",
};

const FILTROS_INICIALES = {
  fecha_desde: "",
  fecha_hasta: "",
  estado: "",
  solo_pendientes: true,
  mostrar_convertidos: false,
};

export default function AgendaTallerPage() {
  const navigate = useNavigate();
  const { usuarioId, sucursalId } = useSession();

  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [vista, setVista] = useState(VISTAS.GENERAL);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  const [form, setForm] = useState(FORM_INICIAL);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [turnoEditandoId, setTurnoEditandoId] = useState(null);

  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientesEncontrados, setClientesEncontrados] = useState([]);
  const [bicicletasCliente, setBicicletasCliente] = useState([]);

  useEffect(() => {
    cargarTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId, vista]);

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

  async function cargarTurnos(overrides = {}) {
    try {
      setLoading(true);
      setError("");

      const baseParams = {
        id_sucursal: sucursalId,
        ...overrides,
      };

      let data;

      if (vista === VISTAS.PARA_MANANA) {
        data = await listarTurnosAgendaParaManana(baseParams);
      } else if (vista === VISTAS.ATRASADAS) {
        data = await listarTurnosAgendaAtrasados(baseParams);
      } else {
        data = await listarTurnosAgenda({
          ...baseParams,
          fecha_desde: filtros.fecha_desde,
          fecha_hasta: filtros.fecha_hasta,
          estado: filtros.estado,
          solo_pendientes: filtros.solo_pendientes,
          mostrar_convertidos: filtros.mostrar_convertidos,
        });
      }

      setTurnos(Array.isArray(data) ? data : []);
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

  function resetFormulario() {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setTurnoEditandoId(null);
    setBusquedaCliente("");
    setClientesEncontrados([]);
    setBicicletasCliente([]);
  }

  async function iniciarEdicion(turno) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      setModoEdicion(true);
      setTurnoEditandoId(turno.id);
      setBusquedaCliente(turno.cliente_nombre || "");

      setForm({
        id_cliente: turno.id_cliente || null,
        id_bicicleta_cliente: turno.id_bicicleta_cliente || null,
        cliente_nombre: turno.cliente_nombre || "",
        cliente_telefono: turno.cliente_telefono || "",
        fecha: turno.fecha || "",
        fecha_prometida_entrega: turno.fecha_prometida_entrega || "",
        franja: turno.franja || "mañana",
        hora_inicio: normalizarHora(turno.hora_inicio) || "09:00",
        hora_fin: normalizarHora(turno.hora_fin) || "",
        tipo_servicio: turno.tipo_servicio || "",
        descripcion: turno.descripcion || "",
        notas: turno.notas || "",
      });

      if (turno.id_cliente) {
        const bicis = await listarBicicletasCliente(turno.id_cliente);
        setBicicletasCliente(Array.isArray(bicis) ? bicis : []);
      } else {
        setBicicletasCliente([]);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "No se pudo preparar la edición del turno");
    } finally {
      setProcesando(false);
    }
  }

  function validarFormulario() {
    if (!form.id_cliente) return "Seleccioná un cliente existente.";
    if (!form.id_bicicleta_cliente) return "Seleccioná una bicicleta del cliente.";
    if (!form.fecha) return "La fecha del turno es obligatoria.";
    if (!form.hora_inicio) return "La hora de inicio es obligatoria.";
    if (!form.tipo_servicio.trim()) return "El tipo de servicio es obligatorio.";
    return "";
  }

  function buildPayload() {
    return {
      ...form,
      id_cliente: Number(form.id_cliente),
      id_bicicleta_cliente: Number(form.id_bicicleta_cliente),
      cliente_nombre: form.cliente_nombre.trim(),
      cliente_telefono: form.cliente_telefono?.trim() || null,
      hora_fin: form.hora_fin || null,
      fecha_prometida_entrega: form.fecha_prometida_entrega || null,
      tipo_servicio: form.tipo_servicio.trim(),
      descripcion: form.descripcion.trim() || null,
      notas: form.notas.trim() || null,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    const validacion = validarFormulario();
    if (validacion) {
      setError(validacion);
      return;
    }

    try {
      setProcesando(true);

      if (modoEdicion && turnoEditandoId) {
        await editarTurnoAgenda(turnoEditandoId, {
          ...buildPayload(),
          id_usuario: usuarioId,
        });
        setMensaje("Turno actualizado correctamente");
      } else {
        await crearTurnoAgenda({
          ...buildPayload(),
          id_sucursal: sucursalId,
          id_usuario_creador: usuarioId,
        });
        setMensaje("Turno creado correctamente");
      }

      resetFormulario();
      await cargarTurnos();
    } catch (err) {
      setError(err.message || "No se pudo guardar el turno");
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(turnoId, estado) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await cambiarEstadoTurnoAgenda(turnoId, {
        estado,
        id_usuario: usuarioId,
      });

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
    const mensajeTurno = buildMensajeConfirmacion(turno);
    await copiarTexto(mensajeTurno);
    setMensaje("Confirmación copiada al portapapeles.");
  }

  async function copiarRecordatorioTurno(turno) {
    const mensajeTurno = buildMensajeRecordatorio(turno);

    try {
      await copiarTexto(mensajeTurno);
      await marcarRecordatorioEnviado(turno.id);
      setMensaje("Recordatorio copiado y marcado como enviado.");
      await cargarTurnos();
    } catch (err) {
      console.error(err);
      alert(mensajeTurno);
    }
  }

  async function avisarCliente(turno) {
    const mensajeTurno = buildMensajeClienteAvisado(turno);

    try {
      await copiarTexto(mensajeTurno);
      await marcarClienteAvisado(turno.id, {
        id_usuario: usuarioId,
        observacion: "Aviso copiado desde agenda",
      });
      setMensaje("Aviso copiado. El turno quedó marcado como cliente avisado.");
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

  const resumen = useMemo(() => {
    return turnos.reduce(
      (acc, turno) => {
        acc.total += 1;
        if (turno.estado === "pendiente") acc.pendientes += 1;
        if (turno.estado === "confirmado") acc.confirmados += 1;
        if (turno.estado === "en_taller") acc.enTaller += 1;
        if (turno.estado === "convertido_orden") acc.convertidos += 1;
        if (turno.recordatorio_enviado) acc.recordados += 1;
        if (turno.cliente_avisado) acc.avisados += 1;
        return acc;
      },
      {
        total: 0,
        pendientes: 0,
        confirmados: 0,
        enTaller: 0,
        convertidos: 0,
        recordados: 0,
        avisados: 0,
      },
    );
  }, [turnos]);

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Agenda Taller</h1>
          <p style={styles.subtitle}>
            Turnos, ingresos previstos, promesas de entrega y avisos al cliente.
          </p>
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

      {error ? <div style={styles.alertError}>{error}</div> : null}
      {mensaje ? <div style={styles.alertSuccess}>{mensaje}</div> : null}

      <div style={styles.statsGrid}>
        <Stat label="Turnos" value={resumen.total} />
        <Stat label="Pendientes" value={resumen.pendientes} />
        <Stat label="Confirmados" value={resumen.confirmados} />
        <Stat label="En taller" value={resumen.enTaller} />
        <Stat label="Avisados" value={resumen.avisados} />
      </div>

      <div style={styles.viewTabs}>
        <button
          type="button"
          onClick={() => setVista(VISTAS.GENERAL)}
          style={vista === VISTAS.GENERAL ? styles.tabActive : styles.tab}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setVista(VISTAS.PARA_MANANA)}
          style={vista === VISTAS.PARA_MANANA ? styles.tabActive : styles.tab}
        >
          Para mañana
        </button>
        <button
          type="button"
          onClick={() => setVista(VISTAS.ATRASADAS)}
          style={vista === VISTAS.ATRASADAS ? styles.tabActive : styles.tab}
        >
          Atrasadas
        </button>
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.headerRow}>
            <h2 style={styles.cardTitle}>{modoEdicion ? "Editar turno" : "Nuevo turno"}</h2>
            {modoEdicion ? (
              <button
                type="button"
                onClick={resetFormulario}
                style={styles.secondaryButtonSmall}
                disabled={procesando}
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

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
              <div>
                <label style={styles.label}>Fecha turno</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Prometida entrega</label>
                <input
                  type="date"
                  value={form.fecha_prometida_entrega}
                  onChange={(e) =>
                    setForm({ ...form, fecha_prometida_entrega: e.target.value })
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.twoCols}>
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
                <option value="mañana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>

              <div style={styles.twoColsCompact}>
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                  style={styles.input}
                />
                <input
                  type="time"
                  value={form.hora_fin}
                  onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                  style={styles.input}
                  title="Hora fin opcional"
                />
              </div>
            </div>

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

            <textarea
              placeholder="Notas internas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              style={styles.textareaSmall}
            />

            <button type="submit" style={styles.primaryButton} disabled={procesando}>
              {modoEdicion ? "Guardar cambios" : "Crear turno"}
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <h2 style={styles.cardTitle}>{labelVista(vista)}</h2>
              <p style={styles.muted}>{turnos.length} turno(s) encontrados</p>
            </div>
          </div>

          {vista === VISTAS.GENERAL ? (
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
                <option value="">Todos los estados</option>
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {labelEstado(estado)}
                  </option>
                ))}
              </select>

              <label style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={filtros.solo_pendientes}
                  onChange={(e) =>
                    setFiltros({ ...filtros, solo_pendientes: e.target.checked })
                  }
                />
                Sólo pendientes
              </label>

              <label style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={filtros.mostrar_convertidos}
                  onChange={(e) =>
                    setFiltros({ ...filtros, mostrar_convertidos: e.target.checked })
                  }
                />
                Mostrar convertidos
              </label>

              <button type="button" onClick={cargarTurnos} style={styles.primaryButton}>
                Filtrar
              </button>
            </div>
          ) : null}

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
                          {turno.hora_inicio ? ` · ${normalizarHora(turno.hora_inicio)}` : ""} · {turno.cliente_nombre}
                        </strong>
                        <div style={styles.muted}>
                          {turno.cliente_telefono || "Sin teléfono"}
                        </div>
                      </div>

                      <span style={{ ...styles.estado, ...getEstadoStyle(turno.estado) }}>
                        {labelEstado(turno.estado)}
                      </span>
                    </div>

                    <div style={styles.service}>{turno.tipo_servicio}</div>

                    {turno.descripcion ? (
                      <div style={styles.descripcion}>{turno.descripcion}</div>
                    ) : null}

                    <div style={styles.metaBlock}>
                      {turno.bicicleta_descripcion ? (
                        <div style={styles.metaLine}>🚲 {turno.bicicleta_descripcion}</div>
                      ) : null}

                      {turno.fecha_prometida_entrega ? (
                        <div style={styles.metaLine}>
                          📅 Prometida entrega: {formatFecha(turno.fecha_prometida_entrega)}
                        </div>
                      ) : (
                        <div style={styles.metaLineWarning}>📅 Sin fecha prometida</div>
                      )}

                      {turno.id_orden_taller ? (
                        <div style={styles.metaLine}>🧾 Orden #{turno.id_orden_taller}</div>
                      ) : null}
                    </div>

                    <div style={styles.badgesRow}>
                      {turno.recordatorio_enviado ? (
                        <span style={styles.badgeOk}>📲 Recordatorio enviado</span>
                      ) : (
                        <span style={styles.badgeWarn}>⏳ Sin recordatorio</span>
                      )}

                      {turno.cliente_avisado ? (
                        <span style={styles.badgeOk}>✅ Cliente avisado</span>
                      ) : (
                        <span style={styles.badgeWarn}>⚠️ Cliente sin avisar</span>
                      )}
                    </div>

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

                          {turno.estado === "confirmado" ? (
                            <button
                              type="button"
                              onClick={() => cambiarEstado(turno.id, "en_taller")}
                              disabled={procesando}
                            >
                              Marcar en taller
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => iniciarEdicion(turno)}
                            disabled={procesando || turno.estado === "convertido_orden"}
                          >
                            Editar / reprogramar
                          </button>

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
                            onClick={() => avisarCliente(turno)}
                            disabled={procesando || !turno.cliente_telefono || turno.cliente_avisado}
                          >
                            Avisar cliente
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

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = texto;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function buildMensajeConfirmacion(turno) {
  const momento = turno.franja === "mañana" ? "por la mañana" : "por la tarde";

  return `Hola ${turno.cliente_nombre} 👋

Tu turno quedó agendado para el ${formatFecha(turno.fecha)} ${momento} en Emprendimiento Agus.

Trabajo solicitado:
${turno.tipo_servicio}

${turno.fecha_prometida_entrega ? `Fecha estimada/prometida de entrega: ${formatFecha(turno.fecha_prometida_entrega)}\n\n` : ""}¡Muchas gracias! 🚲`;
}

function buildMensajeRecordatorio(turno) {
  const momento = turno.franja === "mañana" ? "por la mañana" : "por la tarde";

  return `Hola ${turno.cliente_nombre} 👋

Te recordamos que el ${formatFecha(turno.fecha)} ${momento} te esperamos en Emprendimiento Agus para recibir tu bicicleta.

Trabajo solicitado:
${turno.tipo_servicio}

Si necesitás reprogramar, avisanos con anticipación.

¡Muchas gracias! 🚲`;
}

function buildMensajeClienteAvisado(turno) {
  return `Hola ${turno.cliente_nombre} 👋

Te avisamos desde Emprendimiento Agus por tu turno de taller del ${formatFecha(turno.fecha)}.

Trabajo solicitado:
${turno.tipo_servicio}

${turno.fecha_prometida_entrega ? `Fecha estimada/prometida de entrega: ${formatFecha(turno.fecha_prometida_entrega)}\n\n` : ""}Cualquier cambio te avisamos por este medio. 🚲`;
}

function formatFecha(fecha) {
  if (!fecha || fecha === "Sin fecha") return fecha || "-";
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR");
}

function normalizarHora(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

function labelVista(vista) {
  if (vista === VISTAS.PARA_MANANA) return "Turnos para mañana";
  if (vista === VISTAS.ATRASADAS) return "Turnos atrasados";
  return "Turnos";
}

function labelFranja(franja) {
  if (franja === "mañana") return "Mañana";
  if (franja === "tarde") return "Tarde";
  return "Sin franja";
}

function labelEstado(estado) {
  const labels = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    en_taller: "En taller",
    cancelado: "Cancelado",
    convertido_orden: "Convertido a orden",
  };

  return labels[estado] || estado;
}

function getEstadoStyle(estado) {
  if (estado === "pendiente") {
    return { background: "#fef3c7", color: "#92400e" };
  }

  if (estado === "confirmado") {
    return { background: "#dcfce7", color: "#166534" };
  }

  if (estado === "en_taller") {
    return { background: "#e0f2fe", color: "#075985" };
  }

  if (estado === "convertido_orden") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }

  if (estado === "cancelado") {
    return { background: "#fee2e2", color: "#991b1b" };
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
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { margin: 0, color: "#0f172a" },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 20 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  statValue: { fontSize: 24, fontWeight: 950, color: "#0f172a" },
  statLabel: { marginTop: 2, color: "#64748b", fontWeight: 800, fontSize: 13 },
  viewTabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: {
    padding: "10px 14px",
    cursor: "pointer",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    background: "white",
    color: "#334155",
    fontWeight: 900,
  },
  tabActive: {
    padding: "10px 14px",
    cursor: "pointer",
    border: "1px solid #ea580c",
    borderRadius: 999,
    background: "#ea580c",
    color: "white",
    fontWeight: 950,
  },
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
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    marginBottom: 10,
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    boxSizing: "border-box",
  },
  textareaSmall: {
    width: "100%",
    minHeight: 66,
    marginBottom: 10,
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    boxSizing: "border-box",
  },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  twoColsCompact: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
    alignItems: "center",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
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
  secondaryButtonSmall: {
    padding: "8px 10px",
    cursor: "pointer",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "white",
    fontWeight: 900,
    fontSize: 12,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsBox: { display: "grid", gap: 8, marginBottom: 12 },
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
    height: "fit-content",
    whiteSpace: "nowrap",
  },
  service: { marginTop: 10, fontWeight: 900, color: "#0f172a" },
  descripcion: { marginTop: 6, color: "#475569" },
  metaBlock: { display: "grid", gap: 4, marginTop: 8 },
  metaLine: { color: "#64748b", fontWeight: 800, fontSize: 13 },
  metaLineWarning: { color: "#9a3412", fontWeight: 900, fontSize: 13 },
  muted: { color: "#64748b", fontWeight: 700, fontSize: 13 },
  actions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  badgesRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  badgeOk: {
    color: "#166534",
    background: "#dcfce7",
    borderRadius: 999,
    padding: "5px 9px",
    fontWeight: 900,
    fontSize: 12,
    width: "fit-content",
  },
  badgeWarn: {
    color: "#92400e",
    background: "#fef3c7",
    borderRadius: 999,
    padding: "5px 9px",
    fontWeight: 900,
    fontSize: 12,
    width: "fit-content",
  },
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
  empty: { padding: 18, color: "#64748b", fontWeight: 800 },
};
