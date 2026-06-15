import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  cancelarReserva,
  convertirReservaEnVenta,
  obtenerReserva,
  vencerReserva,
} from "../services/reservasService";
import { formatDate, formatMoney } from "../utils/formatters";
import { EstadoReservaBadge } from "./ReservasListPage";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { PromptModal } from "../components/ui/PromptModal";
import useMediaQuery from "../hooks/useMediaQuery";


export default function ReservaDetallePage() {
  const { reservaId } = useParams();
  const navigate = useNavigate();
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1000px)");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [promptConfig, setPromptConfig] = useState(null);

  function pedirConfirmacion(config) {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        },
      });
    });
  }

  function pedirPrompt(config) {
    return new Promise((resolve) => {
      setPromptConfig({
        ...config,
        onConfirm: (value) => {
          setPromptConfig(null);
          resolve(value);
        },
        onCancel: () => {
          setPromptConfig(null);
          resolve(null);
        },
      });
    });
  }

  useEffect(() => {
    cargarReserva();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const detalle = await pedirPrompt({
      title: "Marcar reserva vencida",
      label: "Detalle de vencimiento",
      defaultValue: "Reserva vencida manualmente",
      required: true,
      minLength: 3,
      confirmText: "Marcar vencida",
    });

    if (detalle === null) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await vencerReserva(reservaId, {
        detalle,
        id_usuario: usuarioId,
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
    const motivo = await pedirPrompt({
      title: "Cancelar reserva",
      label: "Motivo de cancelación",
      required: true,
      minLength: 3,
      confirmText: "Continuar",
    });

    if (!motivo || !motivo.trim()) return;

    const senaPerdida = await pedirConfirmacion({
      title: "Seña de la reserva",
      message: "¿La seña queda perdida?",
      confirmText: "Sí, queda perdida",
      cancelText: "No, devolver seña",
      variant: "warning",
    });

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await cancelarReserva(reservaId, {
        motivo: motivo.trim(),
        sena_perdida: senaPerdida,
        id_usuario: usuarioId,
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
    const observaciones = await pedirPrompt({
      title: "Convertir reserva en venta",
      label: "Observaciones para la venta",
      defaultValue: `Venta generada desde reserva #${reservaId}`,
      confirmText: "Convertir a venta",
    });

    if (observaciones === null) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const res = await convertirReservaEnVenta(reservaId, {
        id_usuario: usuarioId,
        observaciones,
      });

      navigate(`/ventas/${res.venta_id}?pagar=1`);
    } catch (err) {
      setError(err.message || "No se pudo convertir la reserva en venta");
    } finally {
      setProcesando(false);
    }
  }

  const reserva = data?.reserva;
  const items = data?.items || [];
  const eventos = data?.eventos || [];
  const pagos = data?.pagos || [];

  const resumenPagos = useMemo(() => {
    return pagos.reduce(
      (acc, pago) => {
        acc.base += Number(pago.monto_base_aplicado ?? pago.monto_base ?? pago.monto_total_cobrado ?? 0);
        acc.descuento += Number(pago.monto_descuento_aplicado ?? pago.descuento_aplicado ?? 0);
        acc.recargo += Number(pago.monto_recargo_aplicado ?? pago.recargo_aplicado ?? pago.monto_recargo_financiero ?? 0);
        acc.cobrado += Number(pago.monto_total_cobrado ?? 0);
        return acc;
      },
      { base: 0, descuento: 0, recargo: 0, cobrado: 0 }
    );
  }, [pagos]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando reserva...</p>;
  if (!data || !reserva) return <p style={{ padding: "24px" }}>No se encontró la reserva.</p>;

  const puedeOperar = reserva.estado === "activa";

  const totalesItems = items.reduce((acc, item) => acc + Number(item.subtotal_estimado || 0), 0);

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <div style={{ ...headerStyle, ...(isMobile ? headerMobileStyle : {}) }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 32, lineHeight: 1.1 }}>Reserva #{reserva.id}</h1>
          <p style={mutedStyle}>
            {reserva.cliente_nombre} #{reserva.id_cliente} · {formatDate(reserva.fecha_reserva)}
          </p>
        </div>

        <div style={{ ...actionsStyle, ...(isMobile ? actionsMobileStyle : {}) }}>
          <button onClick={cargarReserva} style={secondaryBtnStyle}>Refrescar</button>
          <Link to="/reservas" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={{ ...summaryCardsStyle, ...(isMobile ? summaryCardsMobileStyle : {}) }}>
        <Metric label="Total estimado" value={formatMoney(totalesItems)} />
        <Metric label="Base señada" value={formatMoney(reserva.sena_total)} />
        <Metric label="Saldo base" value={formatMoney(reserva.saldo_estimado)} highlight />
        <Metric label="Cobrado real" value={formatMoney(resumenPagos.cobrado)} />
      </section>

      <div style={isNarrow ? gridMobileStyle : gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen</h2>
          <div style={infoGridStyle}>
            <Info label="Estado" value={<EstadoReservaBadge estado={reserva.estado} />} />
            <Info label="Cliente" value={`${reserva.cliente_nombre} #${reserva.id_cliente}`} />
            <Info label="Sucursal" value={`${reserva.sucursal_nombre} #${reserva.id_sucursal}`} />
            <Info label="Vencimiento" value={reserva.fecha_vencimiento ? formatDate(reserva.fecha_vencimiento) : "-"} />
            <Info label="Base señada" value={formatMoney(reserva.sena_total)} />
            <Info label="Saldo base estimado" value={formatMoney(reserva.saldo_estimado)} />
            <Info label="Seña perdida" value={reserva.sena_perdida ? "Sí" : "No"} />
            <Info label="Nota" value={reserva.nota || "-"} full />
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Acciones</h2>

          {puedeOperar ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <button onClick={handleConvertir} disabled={procesando} style={primaryBtnStyle}>
                Convertir a venta
              </button>

              <button onClick={handleVencer} disabled={procesando} style={secondaryBtnStyle}>
                Marcar vencida
              </button>

              <button onClick={handleCancelar} disabled={procesando} style={dangerBtnStyle}>
                Cancelar reserva
              </button>
            </div>
          ) : (
            <div style={noteStyle}>
              Esta reserva está en estado {reserva.estado}; no tiene acciones principales disponibles.
            </div>
          )}

          <div style={noteStyle}>
            Al convertir a venta, la base señada queda cubierta y el saldo base pendiente continúa en la venta.
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
          <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
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

      <div style={isNarrow ? twoColMobileStyle : twoColStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={cardTitleStyle}>Pagos / señas</h2>
              <p style={mutedStyle}>Base aplicada y cobrado real pueden diferir por descuentos o recargos.</p>
            </div>
          </div>

          {pagos.length === 0 ? (
            <div>No hay pagos registrados.</div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {pagos.map((pago) => (
                <PagoCard key={pago.id} pago={pago} />
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
                  <span style={mutedStyle}>{formatDate(evento.fecha)} · {formatUsuario(evento)}</span>
                  {evento.detalle && <div>{evento.detalle}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText}
        variant={confirmConfig?.variant}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={confirmConfig?.onCancel}
      />

      <PromptModal
        open={Boolean(promptConfig)}
        title={promptConfig?.title}
        message={promptConfig?.message}
        label={promptConfig?.label}
        defaultValue={promptConfig?.defaultValue}
        placeholder={promptConfig?.placeholder}
        inputType={promptConfig?.inputType}
        confirmText={promptConfig?.confirmText}
        cancelText={promptConfig?.cancelText}
        required={promptConfig?.required}
        minLength={promptConfig?.minLength}
        validate={promptConfig?.validate}
        onConfirm={promptConfig?.onConfirm}
        onCancel={promptConfig?.onCancel}
      />
    </div>
  );
}
function formatUsuario(item) {
  if (item.usuario_nombre) {
    return item.usuario_username
      ? `${item.usuario_nombre} (@${item.usuario_username})`
      : item.usuario_nombre;
  }

  return item.id_usuario ? `Usuario #${item.id_usuario}` : "-";
}

function PagoCard({ pago }) {
  const base = pago.monto_base_aplicado ?? pago.monto_base ?? pago.monto_total_cobrado;
  const descuento = pago.monto_descuento_aplicado ?? pago.descuento_aplicado ?? 0;
  const recargo = pago.monto_recargo_aplicado ?? pago.recargo_aplicado ?? pago.monto_recargo_financiero ?? 0;
  const cobrado = pago.monto_total_cobrado ?? 0;
  const tieneDetalleFinanciero =
    pago.monto_base_aplicado !== undefined ||
    pago.monto_descuento_aplicado !== undefined ||
    pago.monto_recargo_aplicado !== undefined ||
    pago.monto_base !== undefined ||
    pago.monto_recargo_financiero !== undefined;

  return (
    <div style={paymentCardStyle}>
      <div style={paymentTopStyle}>
        <div>
          <strong>{capitalizar(pago.medio_pago)} · {formatMoney(cobrado)}</strong>
          <div style={mutedStyle}>
            {formatDate(pago.fecha)} · {pago.estado} · {formatUsuario(pago)}
          </div>
        </div>
        <span style={paymentBadgeStyle}>Pago #{pago.id}</span>
      </div>

      {tieneDetalleFinanciero ? (
        <div style={paymentGridStyle}>
          <MiniMoney label="Base aplicada" value={base} />
          <MiniMoney label="Descuento" value={descuento} />
          <MiniMoney label="Recargo" value={recargo} />
          <MiniMoney label="Cobrado real" value={cobrado} strong />
        </div>
      ) : (
        <div style={noteStyle}>
          Este pago no trae detalle financiero desde el backend. Mostrando solo el total cobrado.
        </div>
      )}

      {(pago.cuotas || pago.entidad || pago.tarjeta_plan_nombre) && (
        <div style={cardMetaStyle}>
          {pago.tarjeta_plan_nombre ? `${pago.tarjeta_plan_nombre} · ` : ""}
          {pago.entidad ? `${pago.entidad} · ` : ""}
          {pago.cuotas ? `${pago.cuotas} cuota(s)` : ""}
        </div>
      )}

      {pago.nota && <div>{pago.nota}</div>}
    </div>
  );
}

function MiniMoney({ label, value, strong = false }) {
  return (
    <div style={miniMoneyStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong style={strong ? { fontSize: "17px" } : undefined}>{formatMoney(value)}</strong>
    </div>
  );
}

function Metric({ label, value, highlight = false }) {
  return (
    <div style={metricStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong style={highlight ? metricHighlightStyle : metricValueStyle}>{value}</strong>
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

function capitalizar(texto) {
  if (!texto) return "-";
  return String(texto).charAt(0).toUpperCase() + String(texto).slice(1);
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const pageMobileStyle = { padding: "12px", overflowX: "hidden" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const headerMobileStyle = { display: "grid", gridTemplateColumns: "1fr", alignItems: "start" };
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const actionsMobileStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%" };
const mutedStyle = { color: "#667085", margin: "4px 0 0", fontSize: "13px" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const summaryCardsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "16px", marginBottom: "16px" };
const summaryCardsMobileStyle = { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" };
const metricStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", display: "grid", gap: "6px" };
const metricValueStyle = { fontSize: "22px" };
const metricHighlightStyle = { fontSize: "22px", color: "#0b5bd3" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px,1.4fr) minmax(300px,.8fr)", gap: "16px", alignItems: "start" };
const gridMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: "12px", alignItems: "start" };
const infoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const primaryBtnStyle = { width: "100%", border: "none", background: "#0b5bd3", color: "white", borderRadius: "12px", padding: "12px", fontWeight: 900, cursor: "pointer" };
const secondaryBtnStyle = { padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", background: "white", color: "#111827", fontWeight: "bold", cursor: "pointer" };
const dangerBtnStyle = { width: "100%", border: "1px solid #f4c7c3", background: "#fff1f0", color: "#b42318", borderRadius: "12px", padding: "12px", fontWeight: 900, cursor: "pointer" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "12px" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", color: "#475467" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const twoColStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };
const twoColMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: "12px" };
const eventStyle = { background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px", display: "grid", gap: "5px" };
const sectionHeaderStyle = { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" };
const paymentCardStyle = { background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "14px", padding: "12px", display: "grid", gap: "10px" };
const paymentTopStyle = { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start" };
const paymentBadgeStyle = { background: "white", border: "1px solid #d0d5dd", borderRadius: "999px", padding: "4px 8px", fontSize: "12px", fontWeight: "bold", whiteSpace: "nowrap" };
const paymentGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "8px" };
const miniMoneyStyle = { background: "white", borderRadius: "10px", border: "1px solid #eaecf0", padding: "10px", display: "grid", gap: "4px" };
const cardMetaStyle = { background: "#eef4ff", color: "#175cd3", borderRadius: "10px", padding: "8px 10px", fontWeight: "bold", fontSize: "13px" };
