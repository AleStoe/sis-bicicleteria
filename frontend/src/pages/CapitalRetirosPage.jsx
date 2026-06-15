import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  anularMovimientoCapital,
  cambiarEstadoParticipanteCapital,
  crearMovimientoCapital,
  crearParticipanteCapital,
  editarParticipanteCapital,
  getMovimientoCapitalDetalle,
  getMovimientosCapital,
  getParticipantesCapital,
  getPerfilParticipanteCapital,
  getResumenCapital,
} from "../services/capitalRetirosService";
import { formatMoney } from "../utils/formatters";
import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";

const SUCURSAL_ID = 1;

const tiposMovimiento = [
  { value: "aporte_capital", label: "Aporte de capital", signo: "+" },
  { value: "prestamo_socio", label: "Préstamo al negocio", signo: "+" },
  { value: "devolucion_prestamo", label: "Devolución de préstamo", signo: "-" },
  { value: "retiro_personal", label: "Retiro personal", signo: "-" },
  { value: "distribucion_ganancia", label: "Distribución de ganancia", signo: "-" },
];

const mediosPago = ["efectivo", "transferencia", "mercadopago", "tarjeta"];

function tipoLabel(value) {
  return tiposMovimiento.find((t) => t.value === value)?.label || value;
}

function money(value) {
  return formatMoney ? formatMoney(value || 0) : `$${Number(value || 0).toLocaleString("es-AR")}`;
}

const card = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

const input = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const label = {
  display: "grid",
  gap: 6,
  color: "#344054",
  fontSize: 13,
  fontWeight: 700,
};

const primaryButton = {
  border: "none",
  borderRadius: 12,
  padding: "11px 14px",
  background: "#f97316",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
};

export default function CapitalRetirosPage() {
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1000px)");
  const navigate = useNavigate();
  const [participantes, setParticipantes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [filtros, setFiltros] = useState({
    id_participante: "",
    tipo_movimiento: "",
    estado: "activo",
    fecha_desde: "",
    fecha_hasta: "",
    q: "",
  });

  const [movForm, setMovForm] = useState({
    id_participante: "",
    tipo_movimiento: "prestamo_socio",
    descripcion: "",
    monto: "",
    medio_pago: "efectivo",
    impacta_caja: true,
    fecha: "",
  });

  const [participanteForm, setParticipanteForm] = useState({
    id: null,
    nombre: "",
    tipo: "persona",
    activo: true,
    observaciones: "",
  });

  const query = useMemo(() => {
    return {
      ...filtros,
      limit: 200,
      offset: 0,
    };
  }, [filtros]);

  async function cargarTodo() {
    setLoading(true);
    setError("");
    try {
      const [parts, movs, res] = await Promise.all([
        getParticipantesCapital({ incluir_inactivos: true }),
        getMovimientosCapital(query),
        getResumenCapital({
          id_participante: filtros.id_participante,
          fecha_desde: filtros.fecha_desde,
          fecha_hasta: filtros.fecha_hasta,
        }),
      ]);
      setParticipantes(parts || []);
      setMovimientos(movs || []);
      setResumen(res || null);
    } catch (err) {
      setError(err.message || "Error cargando Capital y Retiros");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function verPerfil(participanteId) {
    setError("");
    try {
      const data = await getPerfilParticipanteCapital(participanteId);
      setPerfil(data);
      setDetalle(null);
    } catch (err) {
      setError(err.message || "No se pudo obtener el perfil");
    }
  }


  async function verDetalle(movimientoId) {
    setError("");
    try {
      const data = await getMovimientoCapitalDetalle(movimientoId);
      setDetalle(data);
      setPerfil(null);
    } catch (err) {
      setError(err.message || "No se pudo obtener el detalle");
    }
  }

  async function guardarMovimiento(e) {
    e.preventDefault();
    setError("");
    setOk("");

    try {
      await crearMovimientoCapital({
        id_participante: Number(movForm.id_participante),
        id_sucursal: SUCURSAL_ID,
        tipo_movimiento: movForm.tipo_movimiento,
        descripcion: movForm.descripcion,
        monto: Number(movForm.monto),
        medio_pago: movForm.medio_pago || null,
        impacta_caja: Boolean(movForm.impacta_caja),
        fecha: movForm.fecha || null,
        id_usuario: usuarioId,
      });

      setMovForm({
        id_participante: "",
        tipo_movimiento: "prestamo_socio",
        descripcion: "",
        monto: "",
        medio_pago: "efectivo",
        impacta_caja: true,
        fecha: "",
      });
      setOk("Movimiento registrado correctamente");
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo registrar el movimiento");
    }
  }

  async function guardarParticipante(e) {
    e.preventDefault();
    setError("");
    setOk("");

    try {
      const payload = {
        nombre: participanteForm.nombre,
        tipo: participanteForm.tipo,
        activo: participanteForm.activo,
        observaciones: participanteForm.observaciones || null,
      };

      if (participanteForm.id) {
        await editarParticipanteCapital(participanteForm.id, payload);
      } else {
        await crearParticipanteCapital({
          nombre: payload.nombre,
          tipo: payload.tipo,
          observaciones: payload.observaciones,
        });
      }

      setParticipanteForm({ id: null, nombre: "", tipo: "persona", activo: true, observaciones: "" });
      setOk("Participante guardado correctamente");
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo guardar el participante");
    }
  }

  async function toggleParticipante(p) {
    setError("");
    setOk("");
    try {
      await cambiarEstadoParticipanteCapital(p.id, !p.activo);
      setOk(p.activo ? "Participante desactivado" : "Participante activado");
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    }
  }

  async function anularMovimiento(mov) {
    const motivo = window.prompt("Motivo de anulación");
    if (!motivo) return;

    setError("");
    setOk("");
    try {
      await anularMovimientoCapital(mov.id, { motivo, id_usuario: usuarioId });
      setOk("Movimiento anulado correctamente");
      setDetalle(null);
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo anular el movimiento");
    }
  }

  return (
    <div style={{ padding: isMobile ? 12 : 24, display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
      <header style={{ display: "grid", gap: 6, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, color: "#101828", fontSize: isMobile ? 26 : 32, lineHeight: 1.1 }}>Capital y Retiros</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Aportes, préstamos al negocio, devoluciones y retiros familiares sin contaminar Gastos.
          </p>
        </div>
      </header>

      {error && <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}
      {ok && <div style={{ ...card, padding: 14, borderColor: "#bbf7d0", color: "#166534", background: "#f0fdf4" }}>{ok}</div>}

      <section style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(150px, 1fr))", gap: isMobile ? 8 : 12, minWidth: 0 }}>
        <Metric title="Aportes" value={money(resumen?.total_aportes)} />
        <Metric title="Préstamos" value={money(resumen?.total_prestamos)} />
        <Metric title="Saldo préstamos" value={money(resumen?.saldo_prestamos)} strong />
        <Metric title="Retiros" value={money(resumen?.total_retiros)} />
        <Metric title="Distribuciones" value={money(resumen?.total_distribuciones)} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.45fr) minmax(360px, .75fr)", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <div style={{ display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
          <div style={{ ...card, padding: isMobile ? 12 : 16, minWidth: 0 }}>
            <h2 style={{ margin: "0 0 12px" }}>Nuevo movimiento</h2>
            <form onSubmit={guardarMovimiento} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, minWidth: 0 }}>
              <label style={label}>
                Participante
                <select style={input} value={movForm.id_participante} onChange={(e) => setMovForm((s) => ({ ...s, id_participante: e.target.value }))} required>
                  <option value="">Seleccionar</option>
                  {participantes.filter((p) => p.activo).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </label>

              <label style={label}>
                Tipo
                <select style={input} value={movForm.tipo_movimiento} onChange={(e) => setMovForm((s) => ({ ...s, tipo_movimiento: e.target.value }))}>
                  {tiposMovimiento.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>

              <label style={label}>
                Monto
                <input style={input} type="number" min="1" value={movForm.monto} onChange={(e) => setMovForm((s) => ({ ...s, monto: e.target.value }))} required />
              </label>

              <label style={{ ...label, gridColumn: isMobile ? "auto" : "span 2" }}>
                Descripción
                <input style={input} value={movForm.descripcion} onChange={(e) => setMovForm((s) => ({ ...s, descripcion: e.target.value }))} placeholder="Ej: Ángel presta plata para compra por volumen" required />
              </label>

              <label style={label}>
                Medio
                <select style={input} value={movForm.medio_pago} onChange={(e) => setMovForm((s) => ({ ...s, medio_pago: e.target.value }))}>
                  {mediosPago.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>

              <label style={label}>
                Fecha
                <input style={input} type="date" value={movForm.fecha} onChange={(e) => setMovForm((s) => ({ ...s, fecha: e.target.value }))} />
              </label>

              <label style={{ ...label, alignSelf: "end" }}>
                <span>Impacto en caja</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <input type="checkbox" checked={movForm.impacta_caja} onChange={(e) => setMovForm((s) => ({ ...s, impacta_caja: e.target.checked }))} />
                  Registrar en caja abierta
                </label>
              </label>

              <div style={{ alignSelf: "end" }}>
                <button style={primaryButton} type="submit">Registrar movimiento</button>
              </div>
            </form>
          </div>

          <div style={{ ...card, padding: isMobile ? 12 : 16, minWidth: 0 }}>
            <h2 style={{ margin: "0 0 12px" }}>Movimientos</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12, minWidth: 0 }}>
              <select style={input} value={filtros.id_participante} onChange={(e) => setFiltros((s) => ({ ...s, id_participante: e.target.value }))}>
                <option value="">Todos</option>
                {participantes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <select style={input} value={filtros.tipo_movimiento} onChange={(e) => setFiltros((s) => ({ ...s, tipo_movimiento: e.target.value }))}>
                <option value="">Todos los tipos</option>
                {tiposMovimiento.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select style={input} value={filtros.estado} onChange={(e) => setFiltros((s) => ({ ...s, estado: e.target.value }))}>
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="anulado">Anulado</option>
              </select>
              <input style={input} placeholder="Buscar" value={filtros.q} onChange={(e) => setFiltros((s) => ({ ...s, q: e.target.value }))} />
            </div>

            <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                    <th style={{ padding: 10 }}>Fecha</th>
                    <th style={{ padding: 10 }}>Participante</th>
                    <th style={{ padding: 10 }}>Tipo</th>
                    <th style={{ padding: 10 }}>Monto</th>
                    <th style={{ padding: 10 }}>Estado</th>
                    <th style={{ padding: 10 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ padding: 18 }}>Cargando...</td></tr>
                  ) : movimientos.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: 18, color: "#667085" }}>Sin movimientos</td></tr>
                  ) : movimientos.map((m) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #f2f4f7" }}>
                      <td style={{ padding: 10 }}>{m.fecha}</td>
                      <td style={{ padding: 10, fontWeight: 800 }}>{m.participante_nombre}</td>
                      <td style={{ padding: 10 }}>{tipoLabel(m.tipo_movimiento)}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{money(m.monto)}</td>
                      <td style={{ padding: 10 }}>{m.estado}</td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        <button style={secondaryButton} onClick={() => verDetalle(m.id)}>Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside style={{ display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
          <div style={{ ...card, padding: isMobile ? 12 : 16, minWidth: 0 }}>
            <h2 style={{ margin: "0 0 12px" }}>Participantes</h2>
            <form onSubmit={guardarParticipante} style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              <input style={input} placeholder="Nombre" value={participanteForm.nombre} onChange={(e) => setParticipanteForm((s) => ({ ...s, nombre: e.target.value }))} required />
              <select style={input} value={participanteForm.tipo} onChange={(e) => setParticipanteForm((s) => ({ ...s, tipo: e.target.value }))}>
                <option value="persona">Persona</option>
                <option value="fondo">Fondo</option>
              </select>
              <textarea style={{ ...input, minHeight: 70 }} placeholder="Observaciones" value={participanteForm.observaciones} onChange={(e) => setParticipanteForm((s) => ({ ...s, observaciones: e.target.value }))} />
              <button style={primaryButton} type="submit">{participanteForm.id ? "Guardar cambios" : "Crear participante"}</button>
            </form>

            <div style={{ display: "grid", gap: 8 }}>
              {participantes.map((p) => (
                <div key={p.id} style={{ border: "1px solid #eaecf0", borderRadius: 14, padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <strong>{p.nombre}</strong>
                      <div style={{ color: "#667085", fontSize: 13 }}>{p.tipo} · {p.activo ? "activo" : "inactivo"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={secondaryButton}
                      onClick={() => navigate(`/capital-retiros/participantes/${p.id}`)}
                    >
                      Ver perfil
                    </button>
                    <button style={secondaryButton} onClick={() => setParticipanteForm({ id: p.id, nombre: p.nombre, tipo: p.tipo, activo: p.activo, observaciones: p.observaciones || "" })}>Editar</button>
                    <button style={secondaryButton} onClick={() => toggleParticipante(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Perfil participante</h2>
            {!perfil ? (
              <p style={{ color: "#667085", margin: 0 }}>Elegí “Ver perfil” en un participante para chequear cuánto puso, retiró y cuánto se le debe.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 18 }}>{perfil.participante.nombre}</strong>
                  <div style={{ color: "#667085", fontSize: 13 }}>
                    {perfil.participante.tipo} · {perfil.participante.activo ? "activo" : "inactivo"}
                  </div>
                  {perfil.participante.observaciones ? (
                    <div style={{ color: "#475467", fontSize: 13, marginTop: 6 }}>{perfil.participante.observaciones}</div>
                  ) : null}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <MiniMetric title="Aportó" value={money(perfil.resumen.total_aportes)} />
                  <MiniMetric title="Prestó" value={money(perfil.resumen.total_prestamos)} />
                  <MiniMetric title="Devuelto" value={money(perfil.resumen.total_devoluciones_prestamo)} />
                  <MiniMetric title="Saldo préstamo" value={money(perfil.resumen.saldo_prestamo)} strong />
                  <MiniMetric title="Retiró" value={money(perfil.resumen.total_retiros)} />
                  <MiniMetric title="Distribuciones" value={money(perfil.resumen.total_distribuciones)} />
                </div>

                <div style={{ borderTop: "1px solid #eaecf0", paddingTop: 10 }}>
                  <strong>Historial activo</strong>
                  <div style={{ display: "grid", gap: 8, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                    {perfil.movimientos.length === 0 ? (
                      <div style={{ color: "#667085", fontSize: 13 }}>Sin movimientos activos.</div>
                    ) : perfil.movimientos.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => verDetalle(m.id)}
                        style={{
                          textAlign: "left",
                          border: "1px solid #eaecf0",
                          background: "#fff",
                          borderRadius: 12,
                          padding: 10,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontWeight: 800 }}>{tipoLabel(m.tipo_movimiento)}</span>
                          <span style={{ fontWeight: 900 }}>{money(m.monto)}</span>
                        </div>
                        <div style={{ color: "#667085", fontSize: 12 }}>{m.fecha} · {m.descripcion}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Detalle</h2>
            {!detalle ? (
              <p style={{ color: "#667085", margin: 0 }}>Seleccioná un movimiento para ver su historial.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <strong>{detalle.movimiento.participante_nombre}</strong>
                  <div style={{ color: "#667085" }}>{tipoLabel(detalle.movimiento.tipo_movimiento)}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 950 }}>{money(detalle.movimiento.monto)}</div>
                <div style={{ color: "#475467" }}>{detalle.movimiento.descripcion}</div>
                <div style={{ color: "#667085", fontSize: 13 }}>Caja: {detalle.movimiento.impacta_caja ? `sí (#${detalle.movimiento.id_caja_movimiento})` : "no"}</div>
                {detalle.movimiento.estado === "activo" && (
                  <button style={{ ...secondaryButton, borderColor: "#fecaca", color: "#b91c1c" }} onClick={() => anularMovimiento(detalle.movimiento)}>
                    Anular movimiento
                  </button>
                )}
                <div style={{ borderTop: "1px solid #eaecf0", paddingTop: 10 }}>
                  <strong>Historial</strong>
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {detalle.historial.map((h) => (
                      <div key={h.id} style={{ fontSize: 13, color: "#475467" }}>
                        {h.created_at} · {h.tipo_evento} · {money(h.monto)}
                        {h.detalle ? <div>{h.detalle}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ title, value, strong = false }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ color: strong ? "#f97316" : "#101828", fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
    </div>
  );
}


function MiniMetric({ title, value, strong = false }) {
  return (
    <div style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: 10, background: strong ? "#fff7ed" : "#fff" }}>
      <div style={{ color: "#667085", fontSize: 12, fontWeight: 800 }}>{title}</div>
      <div style={{ color: strong ? "#f97316" : "#101828", fontSize: 15, fontWeight: 950, marginTop: 4 }}>{value}</div>
    </div>
  );
}
