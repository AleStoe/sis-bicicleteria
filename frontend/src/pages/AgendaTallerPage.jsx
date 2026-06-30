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
  crearBicicletaCliente,
} from "../services/clientesService";
import { useSession } from "../context/SessionContext";
import { normalizeTextUpper } from "../utils/textNormalization";
import { DEFAULT_CONFIGURACION_NEGOCIO } from "../config/defaultConfiguracionNegocio";
import { obtenerConfiguracionNegocio } from "../services/configuracionNegocioService";
import { renderMessageTemplate } from "../utils/messageTemplate";

const ESTADOS = [
  "pendiente",
  "confirmado",
  "en_taller",
  "cancelado",
  "convertido_orden",
];

const VISTAS = {
  HOY: "hoy",
  GENERAL: "general",
  PARA_MANANA: "para_manana",
  ATRASADAS: "atrasadas",
};

const TIPOS_TURNO = [
  { value: "reparacion_comun", label: "Reparación común" },
  { value: "service_postventa_30_dias", label: "Service postventa 30 días" },
  { value: "garantia", label: "Garantía" },
  { value: "consulta_revision", label: "Consulta / revisión" },
];

const FORM_INICIAL = {
  id_cliente: null,
  id_bicicleta_cliente: null,
  id_venta_origen: null,
  cliente_nombre: "",
  cliente_telefono: "",
  fecha: "",
  fecha_prometida_entrega: "",
  franja: "mañana",
  hora_inicio: "09:00",
  hora_fin: "",
  tipo_turno: "reparacion_comun",
  tipo_servicio: "REPARACIÓN COMÚN",
  descripcion: "",
  notas: "",
};

const BICICLETA_FORM_INICIAL = {
  marca: "",
  modelo: "",
  rodado: "",
  color: "",
  numero_cuadro: "",
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
  const isCompact = useAgendaCompactLayout();

  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [configNegocio, setConfigNegocio] = useState(DEFAULT_CONFIGURACION_NEGOCIO);

  const [vista, setVista] = useState(VISTAS.GENERAL);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  const [form, setForm] = useState(FORM_INICIAL);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [turnoEditandoId, setTurnoEditandoId] = useState(null);

  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientesEncontrados, setClientesEncontrados] = useState([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [errorBusquedaCliente, setErrorBusquedaCliente] = useState("");
  const [bicicletasCliente, setBicicletasCliente] = useState([]);
  const [mostrarAltaBicicleta, setMostrarAltaBicicleta] = useState(false);
  const [biciForm, setBiciForm] = useState(BICICLETA_FORM_INICIAL);
  const esTurnoPostventa = form.tipo_turno === "service_postventa_30_dias";
  const bicicletasElegibles = useMemo(
    () =>
      esTurnoPostventa
        ? bicicletasCliente.filter(esBicicletaElegiblePostventa)
        : bicicletasCliente,
    [bicicletasCliente, esTurnoPostventa],
  );
  const bicicletaSeleccionada = bicicletasCliente.find(
    (bici) => Number(bici.id) === Number(form.id_bicicleta_cliente),
  );

  useEffect(() => {
    cargarTurnos();
    cargarConfiguracionMensajes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId, vista]);

  async function cargarConfiguracionMensajes() {
    try {
      const data = await obtenerConfiguracionNegocio();
      setConfigNegocio({ ...DEFAULT_CONFIGURACION_NEGOCIO, ...(data || {}) });
    } catch {
      setConfigNegocio(DEFAULT_CONFIGURACION_NEGOCIO);
    }
  }

  useEffect(() => {
    const texto = busquedaCliente.trim();

    if (texto.length < 2 || form.id_cliente) {
      setClientesEncontrados([]);
      setBuscandoClientes(false);
      setErrorBusquedaCliente("");
      return;
    }

    let busquedaActiva = true;

    const timeout = setTimeout(async () => {
      try {
        setBuscandoClientes(true);
        setErrorBusquedaCliente("");
        const data = await listarClientes({
          q: texto,
          solo_activos: true,
        });

        if (!busquedaActiva) return;

        const clientes = Array.isArray(data) ? data : [];
        setClientesEncontrados(clientes.filter((cliente) => Number(cliente.id) !== 1));
      } catch (err) {
        if (!busquedaActiva) return;

        setClientesEncontrados([]);
        setErrorBusquedaCliente(err.message || "No se pudieron buscar clientes");
      } finally {
        if (busquedaActiva) {
          setBuscandoClientes(false);
        }
      }
    }, 300);

    return () => {
      busquedaActiva = false;
      clearTimeout(timeout);
    };
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

      if (vista === VISTAS.HOY) {
        const hoy = getFechaISO();
        data = await listarTurnosAgenda({
          ...baseParams,
          fecha_desde: hoy,
          fecha_hasta: hoy,
          solo_pendientes: true,
          mostrar_convertidos: false,
        });
      } else if (vista === VISTAS.PARA_MANANA) {
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
        id_venta_origen: null,
        cliente_nombre: cliente.nombre || "",
        cliente_telefono: cliente.telefono || "",
      }));

      setBusquedaCliente(cliente.nombre || "");
      setClientesEncontrados([]);
      setMostrarAltaBicicleta(false);
      setBiciForm(BICICLETA_FORM_INICIAL);

      const bicis = await listarBicicletasCliente(cliente.id);
      const lista = Array.isArray(bicis) ? bicis : [];

      setBicicletasCliente(lista);

      const elegibles =
        form.tipo_turno === "service_postventa_30_dias"
          ? lista.filter(esBicicletaElegiblePostventa)
          : lista;

      if (elegibles.length === 1) {
        setForm((current) => ({
          ...current,
          id_bicicleta_cliente: elegibles[0].id,
          id_venta_origen: elegibles[0].id_venta_origen || null,
        }));
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas del cliente");
    } finally {
      setProcesando(false);
    }
  }

  function seleccionarBicicleta(bicicletaId) {
    const bicicleta = bicicletasCliente.find(
      (item) => Number(item.id) === Number(bicicletaId),
    );
    setForm((current) => ({
      ...current,
      id_bicicleta_cliente: bicicletaId ? Number(bicicletaId) : null,
      id_venta_origen: bicicleta?.id_venta_origen || null,
    }));
  }

  function cambiarTipoTurno(tipoTurno) {
    const esPostventa = tipoTurno === "service_postventa_30_dias";
    const bicicletaActual = bicicletasCliente.find(
      (item) => Number(item.id) === Number(form.id_bicicleta_cliente),
    );
    const bicicletaValida =
      !esPostventa ||
      esBicicletaElegiblePostventa(bicicletaActual);

    setForm((current) => ({
      ...current,
      tipo_turno: tipoTurno,
      tipo_servicio: labelTipoTurno(tipoTurno).toUpperCase(),
      id_bicicleta_cliente: bicicletaValida ? current.id_bicicleta_cliente : null,
      id_venta_origen: bicicletaValida ? current.id_venta_origen : null,
    }));
  }

  function resetFormulario() {
    setForm(FORM_INICIAL);
    setModoEdicion(false);
    setTurnoEditandoId(null);
    setBusquedaCliente("");
    setClientesEncontrados([]);
    setBuscandoClientes(false);
    setErrorBusquedaCliente("");
    setBicicletasCliente([]);
    setMostrarAltaBicicleta(false);
    setBiciForm(BICICLETA_FORM_INICIAL);
  }

  function limpiarClienteSeleccionado() {
    setForm((current) => ({
      ...current,
      id_cliente: null,
      id_bicicleta_cliente: null,
      id_venta_origen: null,
      cliente_nombre: "",
      cliente_telefono: "",
    }));
    setBicicletasCliente([]);
    setMostrarAltaBicicleta(false);
    setBiciForm(BICICLETA_FORM_INICIAL);
  }

  function actualizarBiciForm(campo, valor) {
    const camposUpper = ["marca", "modelo", "color", "numero_cuadro"];

    setBiciForm((current) => ({
      ...current,
      [campo]: camposUpper.includes(campo) ? normalizeTextUpper(valor) : valor,
    }));
  }

  async function crearBicicletaRapida() {
    if (!form.id_cliente) {
      setError("Primero seleccioná un cliente.");
      return;
    }

    if (!biciForm.marca.trim()) {
      setError("La marca de la bicicleta es obligatoria. El resto se puede completar después.");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const resp = await crearBicicletaCliente(form.id_cliente, {
        marca: biciForm.marca.trim(),
        modelo: biciForm.modelo.trim() || null,
        rodado: biciForm.rodado.trim() || null,
        color: biciForm.color.trim() || null,
        numero_cuadro: biciForm.numero_cuadro.trim() || null,
        notas: biciForm.notas.trim() || null,
      });

      const bicis = await listarBicicletasCliente(form.id_cliente);
      const lista = Array.isArray(bicis) ? bicis : [];
      const bicicletaId = resp?.id || lista[0]?.id || null;

      setBicicletasCliente(lista);
      setForm((current) => ({
        ...current,
        id_bicicleta_cliente: bicicletaId,
      }));
      setBiciForm(BICICLETA_FORM_INICIAL);
      setMostrarAltaBicicleta(false);
      setMensaje("Bicicleta agregada al cliente y seleccionada para el turno.");
    } catch (err) {
      setError(err.message || "No se pudo agregar la bicicleta al cliente");
    } finally {
      setProcesando(false);
    }
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
        id_venta_origen: turno.id_venta_origen || null,
        cliente_nombre: turno.cliente_nombre || "",
        cliente_telefono: turno.cliente_telefono || "",
        fecha: turno.fecha || "",
        fecha_prometida_entrega: turno.fecha_prometida_entrega || "",
        franja: turno.franja || "mañana",
        hora_inicio: normalizarHora(turno.hora_inicio) || "09:00",
        hora_fin: normalizarHora(turno.hora_fin) || "",
        tipo_turno: turno.tipo_turno || "reparacion_comun",
        tipo_servicio: turno.tipo_servicio || "REPARACIÓN COMÚN",
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
    if (esTurnoPostventa && !form.id_bicicleta_cliente) {
      return "Seleccioná una bicicleta serializada vendida para el service postventa.";
    }
    if (!form.fecha) return "La fecha del turno es obligatoria.";
    if (!form.hora_inicio) return "La hora de inicio es obligatoria.";
    if (!form.tipo_servicio.trim()) return "El tipo de servicio es obligatorio.";
    return "";
  }

  function buildPayload() {
    return {
      ...form,
      id_cliente: form.id_cliente ? Number(form.id_cliente) : null,
      id_bicicleta_cliente: form.id_bicicleta_cliente
        ? Number(form.id_bicicleta_cliente)
        : null,
      id_venta_origen: form.id_venta_origen
        ? Number(form.id_venta_origen)
        : null,
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
      navigate(`/taller/${resp.orden_id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear la orden desde el turno");
    } finally {
      setProcesando(false);
    }
  }

  async function copiarConfirmacionTurno(turno) {
    const mensajeTurno = buildMensajeConfirmacion(turno, configNegocio);
    await enviarWhatsappTurno(turno, mensajeTurno);
    setMensaje("WhatsApp de confirmación abierto y mensaje copiado.");
  }

  async function copiarRecordatorioTurno(turno) {
    const mensajeTurno = buildMensajeRecordatorio(turno, configNegocio);

    try {
      await enviarWhatsappTurno(turno, mensajeTurno);
      await marcarRecordatorioEnviado(turno.id);
      setMensaje("WhatsApp de recordatorio abierto y marcado como enviado.");
      await cargarTurnos();
    } catch (err) {
      console.error(err);
      alert(mensajeTurno);
    }
  }

  async function avisarCliente(turno) {
    const mensajeTurno = buildMensajeClienteAvisado(turno, configNegocio);

    try {
      await enviarWhatsappTurno(turno, mensajeTurno);
      await marcarClienteAvisado(turno.id, {
        id_usuario: usuarioId,
        observacion: "Aviso copiado desde agenda",
      });
      setMensaje("WhatsApp abierto. El turno quedó marcado como cliente avisado.");
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
      <div style={isCompact ? styles.pageHeaderCompact : styles.pageHeader}>
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

      <div style={isCompact ? styles.statsGridCompact : styles.statsGrid}>
        <Stat label="Turnos" value={resumen.total} />
        <Stat label="Pendientes" value={resumen.pendientes} />
        <Stat label="Confirmados" value={resumen.confirmados} />
        <Stat label="En taller" value={resumen.enTaller} />
        <Stat label="Avisados" value={resumen.avisados} />
      </div>

      <div style={styles.viewTabs}>
        <button
          type="button"
          onClick={() => setVista(VISTAS.HOY)}
          style={vista === VISTAS.HOY ? styles.tabActive : styles.tab}
        >
          Hoy
        </button>
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

      <div style={isCompact ? styles.gridCompact : styles.grid}>
        <section style={styles.card}>
          <div style={isCompact ? styles.headerRowCompact : styles.headerRow}>
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
            <label style={styles.label}>Tipo de turno</label>
            <select
              value={form.tipo_turno}
              onChange={(e) => cambiarTipoTurno(e.target.value)}
              style={styles.input}
            >
              {TIPOS_TURNO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>

            {esTurnoPostventa ? (
              <div style={styles.postventaNotice}>
                <strong>Service gratuito de los 30 días</strong>
                <span>
                  Elegí la bicicleta vendida. La agenda conservará la serializada y
                  la venta de origen para crear la OT sin volver a cargar datos.
                </span>
              </div>
            ) : null}

            <label style={styles.label}>Buscar cliente</label>

            <input
              placeholder="Escribí nombre, teléfono, DNI o CUIT"
              value={busquedaCliente}
              onChange={(e) => {
                setBusquedaCliente(e.target.value);

                if (form.id_cliente) {
                  limpiarClienteSeleccionado();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && clientesEncontrados.length > 0) {
                  e.preventDefault();
                  seleccionarCliente(clientesEncontrados[0]);
                }
              }}
              autoComplete="off"
              style={styles.input}
            />

            {buscandoClientes ? (
              <div style={styles.searchHint}>Buscando clientes...</div>
            ) : null}

            {errorBusquedaCliente ? (
              <div style={styles.warningText}>{errorBusquedaCliente}</div>
            ) : null}

            {!buscandoClientes &&
            !errorBusquedaCliente &&
            busquedaCliente.trim().length >= 2 &&
            !form.id_cliente &&
            clientesEncontrados.length === 0 ? (
              <div style={styles.searchHint}>
                No encontre clientes activos con esa busqueda.
              </div>
            ) : null}

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
                <span>Cliente vinculado: al crear OT desde agenda no se vuelve a cargar.</span>
              </div>
            ) : null}

            <label style={styles.label}>Bicicleta</label>

            <select
              value={form.id_bicicleta_cliente || ""}
              onChange={(e) => seleccionarBicicleta(e.target.value)}
              style={styles.input}
              disabled={!form.id_cliente || bicicletasElegibles.length === 0}
            >
              <option value="">
                {form.id_cliente
                  ? "Seleccionar bicicleta"
                  : "Primero seleccioná un cliente"}
              </option>

              {bicicletasElegibles.map((bici) => (
                <option key={bici.id} value={bici.id}>
                  {formatBicicletaAgenda(bici, esTurnoPostventa)}
                </option>
              ))}
            </select>

            {bicicletaSeleccionada && esTurnoPostventa ? (
              <div style={styles.linkedSaleBox}>
                <strong>{formatBicicleta(bicicletaSeleccionada)}</strong>
                <span>
                  Venta #{bicicletaSeleccionada.id_venta_origen} ·{" "}
                  {formatFecha(bicicletaSeleccionada.fecha_compra)}
                </span>
                <span>
                  Serializada #{bicicletaSeleccionada.id_bicicleta_serializada}
                  {bicicletaSeleccionada.numero_cuadro
                    ? ` · Cuadro ${bicicletaSeleccionada.numero_cuadro}`
                    : ""}
                </span>
              </div>
            ) : null}

            {form.id_cliente && !esTurnoPostventa ? (
              <div style={styles.inlineActions}>
                <button
                  type="button"
                  onClick={() => setMostrarAltaBicicleta((value) => !value)}
                  style={styles.secondaryButtonSmall}
                  disabled={procesando}
                >
                  {mostrarAltaBicicleta ? "Ocultar alta bici" : "Agregar bicicleta"}
                </button>
              </div>
            ) : null}

            {form.id_cliente &&
            bicicletasCliente.length === 0 &&
            !mostrarAltaBicicleta &&
            !esTurnoPostventa ? (
              <div style={styles.warningText}>
                Este cliente no tiene bicicletas cargadas. Podés agregarla acá sin salir de la agenda.
              </div>
            ) : null}

            {form.id_cliente && esTurnoPostventa && bicicletasElegibles.length === 0 ? (
              <div style={styles.warningText}>
                Este cliente no tiene bicicletas serializadas vendidas disponibles para
                vincular al service postventa.
              </div>
            ) : null}

            {form.id_cliente && mostrarAltaBicicleta && !esTurnoPostventa ? (
              <div style={styles.quickBikeBox}>
                <div style={styles.quickBikeHeader}>
                  <strong>Alta rápida de bicicleta</strong>
                  <span>Con marca alcanza. Modelo, color y cuadro se pueden completar después.</span>
                </div>

                <div style={isCompact ? styles.singleCol : styles.twoCols}>
                  <input
                    placeholder="Marca obligatoria"
                    value={biciForm.marca}
                    onChange={(e) => actualizarBiciForm("marca", e.target.value)}
                    style={styles.input}
                  />
                  <input
                    placeholder="Modelo opcional"
                    value={biciForm.modelo}
                    onChange={(e) => actualizarBiciForm("modelo", e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={isCompact ? styles.singleCol : styles.twoCols}>
                  <input
                    placeholder="Rodado"
                    value={biciForm.rodado}
                    onChange={(e) => actualizarBiciForm("rodado", e.target.value)}
                    style={styles.input}
                  />
                  <input
                    placeholder="Color"
                    value={biciForm.color}
                    onChange={(e) => actualizarBiciForm("color", e.target.value)}
                    style={styles.input}
                  />
                </div>

                <input
                  placeholder="Número de cuadro"
                  value={biciForm.numero_cuadro}
                  onChange={(e) => actualizarBiciForm("numero_cuadro", e.target.value)}
                  style={styles.input}
                />

                <textarea
                  placeholder="Notas de la bicicleta"
                  value={biciForm.notas}
                  onChange={(e) => actualizarBiciForm("notas", e.target.value)}
                  style={styles.textareaSmall}
                />

                <div style={styles.inlineActions}>
                  <button
                    type="button"
                    onClick={crearBicicletaRapida}
                    style={styles.primaryButton}
                    disabled={procesando}
                  >
                    Guardar bicicleta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBiciForm(BICICLETA_FORM_INICIAL);
                      setMostrarAltaBicicleta(false);
                    }}
                    style={styles.secondaryButtonSmall}
                    disabled={procesando}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div style={isCompact ? styles.singleCol : styles.twoCols}>
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

            <div style={isCompact ? styles.singleCol : styles.twoCols}>
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
              placeholder="Trabajo o consulta inicial"
              value={form.tipo_servicio}
              onChange={(e) => setForm({ ...form, tipo_servicio: e.target.value })}
              style={styles.input}
              readOnly={esTurnoPostventa}
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
          <div style={isCompact ? styles.headerRowCompact : styles.headerRow}>
            <div>
              <h2 style={styles.cardTitle}>{labelVista(vista)}</h2>
              <p style={styles.muted}>{turnos.length} turno(s) encontrados</p>
            </div>
          </div>

          {vista === VISTAS.GENERAL ? (
            <div style={isCompact ? styles.filtersCompact : styles.filters}>
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
                    <div style={isCompact ? styles.turnoTopCompact : styles.turnoTop}>
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

                    <div style={styles.turnoTypeRow}>
                      <span
                        style={
                          turno.tipo_turno === "service_postventa_30_dias"
                            ? styles.postventaBadge
                            : styles.turnoTypeBadge
                        }
                      >
                        {labelTipoTurno(turno.tipo_turno)}
                      </span>
                      {turno.id_venta_origen ? (
                        <span style={styles.saleOriginBadge}>
                          Venta #{turno.id_venta_origen}
                        </span>
                      ) : null}
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

                    <TurnoAccionPrincipal
                      turno={turno}
                      procesando={procesando}
                      onConfirmar={() => cambiarEstado(turno.id, "confirmado")}
                      onMarcarEnTaller={() => cambiarEstado(turno.id, "en_taller")}
                      onCrearOrden={() => crearOrdenDesdeTurno(turno)}
                      onAbrirOrden={() => navigate(`/taller/${turno.id_orden_taller}`)}
                    />

                    <div style={styles.actions}>
                      {turno.id_orden_taller ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/taller/${turno.id_orden_taller}`)}
                          disabled={procesando}
                          style={getActionButtonStyle("abrir", procesando)}
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
                              style={getActionButtonStyle("confirmar", procesando)}
                            >
                              Confirmar
                            </button>
                          ) : null}

                          {turno.estado === "confirmado" ? (
                            <button
                              type="button"
                              onClick={() => cambiarEstado(turno.id, "en_taller")}
                              disabled={procesando}
                              style={getActionButtonStyle("ingreso", procesando)}
                            >
                              Marcar en taller
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => iniciarEdicion(turno)}
                            disabled={procesando || turno.estado === "convertido_orden"}
                            style={getActionButtonStyle(
                              "editar",
                              procesando || turno.estado === "convertido_orden",
                            )}
                          >
                            Editar / reprogramar
                          </button>

                          {turno.estado !== "cancelado" ? (
                            <button
                              type="button"
                              onClick={() => cambiarEstado(turno.id, "cancelado")}
                              disabled={procesando}
                              style={getActionButtonStyle("cancelar", procesando)}
                            >
                              Cancelar
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => copiarConfirmacionTurno(turno)}
                            disabled={procesando || !turno.cliente_telefono}
                            style={getActionButtonStyle(
                              "whatsapp",
                              procesando || !turno.cliente_telefono,
                            )}
                          >
                            WhatsApp confirmacion
                          </button>

                          <button
                            type="button"
                            onClick={() => copiarRecordatorioTurno(turno)}
                            disabled={procesando || !turno.cliente_telefono || turno.recordatorio_enviado}
                            style={getActionButtonStyle(
                              "whatsapp",
                              procesando || !turno.cliente_telefono || turno.recordatorio_enviado,
                            )}
                          >
                            WhatsApp recordatorio
                          </button>

                          <button
                            type="button"
                            onClick={() => avisarCliente(turno)}
                            disabled={procesando || !turno.cliente_telefono || turno.cliente_avisado}
                            style={getActionButtonStyle(
                              "whatsapp",
                              procesando || !turno.cliente_telefono || turno.cliente_avisado,
                            )}
                          >
                            WhatsApp aviso
                          </button>

                          <button
                            type="button"
                            onClick={() => crearOrdenDesdeTurno(turno)}
                            disabled={procesando || turno.estado === "cancelado"}
                            style={getActionButtonStyle(
                              "crear",
                              procesando || turno.estado === "cancelado",
                            )}
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

function useAgendaCompactLayout() {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1100px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const query = window.matchMedia("(max-width: 1100px)");
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isCompact;
}

function TurnoAccionPrincipal({
  turno,
  procesando,
  onConfirmar,
  onMarcarEnTaller,
  onCrearOrden,
  onAbrirOrden,
}) {
  const accion = getAccionPrincipalTurno(turno);

  if (!accion) return null;

  const handlers = {
    confirmar: onConfirmar,
    en_taller: onMarcarEnTaller,
    crear_orden: onCrearOrden,
    abrir_orden: onAbrirOrden,
  };

  return (
    <div style={styles.mainActionBox}>
      <div>
        <span style={styles.mainActionLabel}>Accion principal</span>
        <strong>{accion.title}</strong>
        <p style={styles.mainActionText}>{accion.description}</p>
      </div>

      <button
        type="button"
        onClick={handlers[accion.kind]}
        disabled={procesando || accion.disabled}
        style={{
          ...styles.mainActionButton,
          opacity: procesando || accion.disabled ? 0.55 : 1,
          cursor: procesando || accion.disabled ? "not-allowed" : "pointer",
        }}
      >
        {accion.label}
      </button>
    </div>
  );
}

function getAccionPrincipalTurno(turno) {
  if (turno.id_orden_taller) {
    return {
      kind: "abrir_orden",
      title: `Orden #${turno.id_orden_taller} creada`,
      description: "El turno ya entro al circuito de taller.",
      label: "Abrir OT",
    };
  }

  if (turno.estado === "cancelado") {
    return {
      kind: "crear_orden",
      title: "Turno cancelado",
      description: "No se puede crear OT desde un turno cancelado.",
      label: "Crear OT",
      disabled: true,
    };
  }

  if (turno.estado === "pendiente") {
    return {
      kind: "confirmar",
      title: "Confirmar turno",
      description: "Primero confirmalo con el cliente para ordenar el ingreso.",
      label: "Confirmar",
    };
  }

  if (turno.estado === "confirmado") {
    return {
      kind: "en_taller",
      title: "Marcar ingreso",
      description: "La bicicleta llego al local. Marcala en taller antes de crear OT.",
      label: "Marcar en taller",
    };
  }

  if (turno.estado === "en_taller") {
    return {
      kind: "crear_orden",
      title: "Crear OT",
      description: "Cliente y bicicleta ya estan vinculados. Crea la orden sin volver a cargarlos.",
      label: "Crear OT",
      disabled: !turno.id_cliente || !turno.id_bicicleta_cliente,
    };
  }

  return null;
}

function getActionButtonStyle(kind, disabled = false) {
  const tones = {
    abrir: styles.actionOpenButton,
    confirmar: styles.actionConfirmButton,
    ingreso: styles.actionProgressButton,
    editar: styles.actionEditButton,
    cancelar: styles.actionDangerButton,
    whatsapp: styles.actionWhatsAppButton,
    crear: styles.actionCreateButton,
  };

  return {
    ...styles.actionButton,
    ...(tones[kind] || styles.actionNeutralButton),
    ...(disabled ? styles.actionButtonDisabled : {}),
  };
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

async function enviarWhatsappTurno(turno, mensaje) {
  const telefono = normalizarTelefonoWhatsapp(turno.cliente_telefono);

  if (telefono) {
    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  await copiarTexto(mensaje);
}

function normalizarTelefonoWhatsapp(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  while (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("15") && digits.length >= 10) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("549")) {
    return digits;
  }

  if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) {
      digits = digits.slice(1);
    }
  }

  if (digits.startsWith("15")) {
    digits = digits.slice(2);
  } else {
    for (let idx = 2; idx < Math.min(5, digits.length - 1); idx += 1) {
      if (digits.slice(idx, idx + 2) === "15" && digits.length > 10) {
        digits = `${digits.slice(0, idx)}${digits.slice(idx + 2)}`;
        break;
      }
    }
  }

  return `549${digits}`;
}

function buildMensajeConfirmacion(turno, config) {
  return renderMessageTemplate(config.plantilla_turno_confirmacion, variablesTurno(turno, config));
}

function buildMensajeRecordatorio(turno, config) {
  return renderMessageTemplate(config.plantilla_turno_recordatorio, variablesTurno(turno, config));
}

function buildMensajeClienteAvisado(turno, config) {
  return renderMessageTemplate(config.plantilla_turno_aviso, variablesTurno(turno, config));
}

function variablesTurno(turno, config) {
  const momento = turno.franja === "mañana" ? "por la mañana" : "por la tarde";
  const fechaPrometidaBloque = turno.fecha_prometida_entrega
    ? `Fecha estimada/prometida de entrega: ${formatFecha(turno.fecha_prometida_entrega)}\n\n`
    : "";

  return {
    ...config,
    cliente_nombre: resolverNombreVisibleCliente(turno),
    fecha_turno: formatFecha(turno.fecha),
    momento_turno: momento,
    tipo_servicio: turno.tipo_servicio || "-",
    fecha_prometida_bloque: fechaPrometidaBloque,
  };
}

function resolverNombreVisibleCliente(data = {}) {
  const nombre =
    data.cliente_nombre ||
    data.nombre ||
    [data.nombre_persona, data.apellido].filter(Boolean).join(" ");

  return String(nombre || "").trim() || "cliente";
}

function formatFecha(fecha) {
  if (!fecha || fecha === "Sin fecha") return fecha || "-";
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR");
}

function getFechaISO(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizarHora(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

function labelVista(vista) {
  if (vista === VISTAS.HOY) return "Turnos de hoy";
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

function labelTipoTurno(tipoTurno) {
  return (
    TIPOS_TURNO.find((tipo) => tipo.value === tipoTurno)?.label ||
    "Reparación común"
  );
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

function formatBicicletaAgenda(bici, incluirVenta = false) {
  const bicicleta = formatBicicleta(bici);
  if (!incluirVenta) return bicicleta;

  const venta = bici.id_venta_origen ? `Venta #${bici.id_venta_origen}` : "Sin venta";
  const fecha = bici.fecha_compra ? formatFecha(bici.fecha_compra) : "Sin fecha";
  return `${bicicleta} · ${venta} · ${fecha}`;
}

function esBicicletaElegiblePostventa(bici) {
  return Boolean(
    bici?.id_bicicleta_serializada &&
      bici?.id_venta_origen &&
      bici?.plan_postventa === "service_30_dias" &&
      !bici?.service_gratis_usado,
  );
}

const styles = {
  page: { display: "grid", gap: 20, minWidth: 0 },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pageHeaderCompact: {
    display: "grid",
    gap: 12,
  },
  title: { margin: 0, color: "#0f172a" },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 420px) minmax(0, 1fr)",
    gap: 20,
    alignItems: "start",
    minWidth: 0,
  },
  gridCompact: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 16,
    minWidth: 0,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
  },
  statsGridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
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
    minWidth: 0,
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
  singleCol: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
    alignItems: "center",
  },
  filtersCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  headerRowCompact: {
    display: "grid",
    gap: 10,
  },
  inlineActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },
  resultsBox: { display: "grid", gap: 8, marginBottom: 12 },
  searchHint: {
    marginTop: -4,
    marginBottom: 10,
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
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
  postventaNotice: {
    display: "grid",
    gap: 3,
    marginBottom: 12,
    border: "1px solid #86efac",
    background: "#f0fdf4",
    borderRadius: 10,
    padding: 11,
    color: "#166534",
  },
  linkedSaleBox: {
    display: "grid",
    gap: 3,
    margin: "-2px 0 12px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: 10,
    padding: 11,
    color: "#1e3a8a",
    fontSize: 13,
  },
  quickBikeBox: {
    display: "grid",
    gap: 2,
    marginBottom: 14,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: 12,
    padding: 12,
  },
  quickBikeHeader: {
    display: "grid",
    gap: 2,
    marginBottom: 6,
    color: "#1e3a8a",
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
    minWidth: 0,
  },
  turnoTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  turnoTopCompact: {
    display: "grid",
    gap: 8,
  },
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
  turnoTypeRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    marginTop: 10,
  },
  turnoTypeBadge: {
    borderRadius: 999,
    padding: "4px 8px",
    background: "#f1f5f9",
    color: "#475569",
    fontWeight: 900,
    fontSize: 11,
  },
  postventaBadge: {
    borderRadius: 999,
    padding: "4px 8px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 950,
    fontSize: 11,
  },
  saleOriginBadge: {
    borderRadius: 999,
    padding: "4px 8px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 11,
  },
  descripcion: { marginTop: 6, color: "#475569" },
  metaBlock: { display: "grid", gap: 4, marginTop: 8 },
  metaLine: { color: "#64748b", fontWeight: 800, fontSize: 13 },
  metaLineWarning: { color: "#9a3412", fontWeight: 900, fontSize: 13 },
  muted: { color: "#64748b", fontWeight: 700, fontSize: 13 },
  mainActionBox: {
    marginTop: 12,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "center",
  },
  mainActionLabel: {
    display: "block",
    marginBottom: 4,
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  mainActionText: {
    margin: "4px 0 0",
    color: "#7c2d12",
    fontWeight: 750,
    fontSize: 13,
  },
  mainActionButton: {
    border: 0,
    background: "#ea580c",
    color: "white",
    borderRadius: 12,
    padding: "11px 14px",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionButton: {
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "9px 11px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
    minHeight: 38,
    flex: "1 1 150px",
    whiteSpace: "normal",
    lineHeight: 1.15,
    transition: "transform .12s ease, box-shadow .12s ease, opacity .12s ease",
  },
  actionOpenButton: {
    background: "#eef2ff",
    borderColor: "#c7d2fe",
    color: "#3730a3",
  },
  actionConfirmButton: {
    background: "#fff7ed",
    borderColor: "#fed7aa",
    color: "#c2410c",
  },
  actionProgressButton: {
    background: "#ecfeff",
    borderColor: "#a5f3fc",
    color: "#0e7490",
  },
  actionEditButton: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1d4ed8",
  },
  actionDangerButton: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
  },
  actionWhatsAppButton: {
    background: "#ecfdf5",
    borderColor: "#bbf7d0",
    color: "#047857",
  },
  actionCreateButton: {
    background: "#ea580c",
    borderColor: "#ea580c",
    color: "white",
    boxShadow: "0 8px 18px rgba(234, 88, 12, .18)",
  },
  actionNeutralButton: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#334155",
  },
  actionButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    boxShadow: "none",
  },
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
