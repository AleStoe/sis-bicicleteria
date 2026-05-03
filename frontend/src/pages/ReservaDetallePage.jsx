import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelarReserva,
  convertirReservaEnVenta,
  obtenerReserva,
  vencerReserva,
} from "../services/reservasService";
import { EstadoReservaBadge, formatDate, formatMoney } from "./ReservasListPage";

const ID_USUARIO = 1;

export default function ReservaDetallePage() {
  const { reservaId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarReserva();
  }, [reservaId]);

  async function cargarReserva() {
    try {
      setLoading(true);
      setError("");

      const res = await obtenerReserva(reservaId);
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar la reserva");
    } finally {
      setLoading(false);
    }
  }

  async function handleVencer() {
    const detalle = window.prompt("Detalle de vencimiento:", "Reserva vencida manualmente");
    if (detalle === null) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await vencerReserva(reservaId, {
        detalle,
        id_usuario: ID_USUARIO,
      });

      await cargarReserva();
      setMensaje("Reserva marcada como vencida");
    } catch (err) {
      setError(err.message || "No se pudo vencer la reserva");
    } finally {
      setProcesando(false);
    }
  }

  async function handleCancelar() {
    const motivo = window.prompt("Motivo de cancelación:");
    if (!motivo || !motivo.trim()) return;

    const senaPerdida = window.confirm("¿La seña queda perdida?");

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await cancelarReserva(reservaId, {
        motivo: motivo.trim(),
        sena_perdida: senaPerdida,
        id_usuario: ID_USUARIO,
      });

      await cargarReserva();
      setMensaje("Reserva cancelada");
    } catch (err) {
      setError(err.message || "No se pudo cancelar la reserva");
    } finally {
      setProcesando(false);
    }
  }

  async function handleConvertir() {
    const observaciones = window.prompt("Observaciones para la venta:", `Venta generada desde reserva #${reservaId}`);
    if (observaciones === null) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const res = await convertirReservaEnVenta(reservaId, {
        id_usuario: ID_USUARIO,
        observaciones,
      });

      navigate(`/ventas/${res.venta_id}?pagar=1`);
    } catch (err) {
      setError(err.message || "No se pudo convertir la reserva en venta");
    } finally {
      setProcesando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando reserva...</p>;
  if (!data) return <p style={{ padding: "24px" }}>No se encontró la reserva.</p>;

  const reserva = data.reserva;
  const items = data.items || [];
  const eventos = data.eventos || [];
  const pagos = data.pagos || [];
  const puedeOperar = reserva.estado === "activa";

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Reserva #{reserva.id}</h1>
          <p style={mutedStyle}>
            {reserva.cliente_nombre} #{reserva.id_cliente} · {formatDate(reserva.fecha_reserva)}
          </p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarReserva}>Refrescar</button>
          <Link to="/reservas" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen</h2>
          <div style={infoGridStyle}>
            <Info label="Estado" value={<EstadoReservaBadge estado={reserva.estado} />} />
            <Info label="Cliente" value={`${reserva.cliente_nombre} #${reserva.id_cliente}`} />
            <Info label="Sucursal" value={`${reserva.sucursal_nombre} #${reserva.id_sucursal}`} />
            <Info label="Vencimiento" value={reserva.fecha_vencimiento ? formatDate(reserva.fecha_vencimiento) : "-"} />
            <Info label="Seña total" value={formatMoney(reserva.sena_total)} />
            <Info label="Saldo estimado" value={formatMoney(reserva.saldo_estimado)} />
            <Info label="Seña perdida" value={reserva.sena_perdida ? "Sí" : "No"} />
            <Info label="Nota" value={reserva.nota || "-"} full />
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Acciones</h2>

          {puedeOperar ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <button onClick={handleConvertir} disabled={procesando}>
                Convertir a venta
              </button>

              <button onClick={handleVencer} disabled={procesando}>
                Marcar vencida
              </button>

              <button onClick={handleCancelar} disabled={procesando}>
                Cancelar reserva
              </button>
            </div>
          ) : (
            <div style={noteStyle}>
              Esta reserva está en estado {reserva.estado}; no tiene acciones principales disponibles.
            </div>
          )}

          <div style={noteStyle}>
            Convertir a venta mueve stock reservado a pendiente de entrega. Si hay saldo, la venta queda pagada parcial.
          </div>
        </aside>
      </div>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <h2 style={{ margin: 0 }}>Items</h2>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay items registrados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>Cantidad</th>
                  <th style={thStyle}>Precio estimado</th>
                  <th style={thStyle}>Subtotal</th>
                  <th style={thStyle}>Serializada</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{item.id}</td>
                    <td style={tdStyle}>{item.descripcion_snapshot}</td>
                    <td style={tdStyle}>{Number(item.cantidad).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>{formatMoney(item.precio_estimado)}</td>
                    <td style={tdStyle}>{formatMoney(item.subtotal_estimado)}</td>
                    <td style={tdStyle}>{item.id_bicicleta_serializada ? `#${item.id_bicicleta_serializada}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={twoColStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Pagos / señas</h2>
          {pagos.length === 0 ? (
            <div>No hay pagos registrados.</div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {pagos.map((pago) => (
                <div key={pago.id} style={eventStyle}>
                  <strong>{pago.medio_pago} · {formatMoney(pago.monto_total_cobrado)}</strong>
                  <span style={mutedStyle}>{formatDate(pago.fecha)} · {pago.estado} · Usuario #{pago.id_usuario}</span>
                  {pago.nota && <div>{pago.nota}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Eventos</h2>
          {eventos.length === 0 ? (
            <div>No hay eventos registrados.</div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {eventos.map((evento) => (
                <div key={evento.id} style={eventStyle}>
                  <strong>{evento.tipo_evento}</strong>
                  <span style={mutedStyle}>{formatDate(evento.fecha)} · Usuario #{evento.id_usuario}</span>
                  {evento.detalle && <div>{evento.detalle}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Info({ label, value, full = false }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto", background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px" }}>
      <div style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "4px 0 0", fontSize: "13px" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px,1.4fr) minmax(300px,.8fr)", gap: "16px", alignItems: "start" };
const infoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "12px" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const twoColStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };
const eventStyle = { background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px", display: "grid", gap: "5px" };
