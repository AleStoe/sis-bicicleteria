import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerDeuda, registrarPagoDeuda } from "../services/deudasService";
import { EstadoDeudaBadge, formatDate, formatMoney } from "./DeudasListPage";

const MEDIOS_PAGO = ["efectivo", "transferencia", "mercadopago", "tarjeta"];

export default function DeudaDetallePage() {
  const { deudaId } = useParams();
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [pagoForm, setPagoForm] = useState({ monto: "", medio_pago: "efectivo", nota: "" });

  useEffect(() => {
    cargarDetalle();
  }, [deudaId]);

  async function cargarDetalle() {
    try {
      setLoading(true);
      setError("");
      const data = await obtenerDeuda(deudaId);
      setDetalle(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la deuda");
    } finally {
      setLoading(false);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();

    const monto = Number(pagoForm.monto);
    const saldo = Number(detalle?.deuda?.saldo_actual || 0);

    if (!monto || monto <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }

    if (monto > saldo) {
      setError("El pago no puede superar el saldo actual");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await registrarPagoDeuda(deudaId, {
        monto,
        medio_pago: pagoForm.medio_pago,
        nota: pagoForm.nota.trim() || null,
        id_usuario: 1,
      });

      setPagoForm({ monto: "", medio_pago: "efectivo", nota: "" });
      await cargarDetalle();
      setMensaje("Pago registrado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando deuda...</p>;
  if (!detalle) return <p style={{ padding: "24px" }}>No se encontró la deuda.</p>;

  const deuda = detalle.deuda;
  const movimientos = detalle.movimientos || [];
  const deudaAbierta = deuda.estado === "abierta";

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Deuda #{deuda.id}</h1>
          <p style={mutedStyle}>Cliente #{deuda.id_cliente} · Origen {deuda.origen_tipo} #{deuda.origen_id}</p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarDetalle}>Refrescar</button>
          <Link to="/deudas" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen</h2>
          <div style={infoGridStyle}>
            <Info label="Estado" value={<EstadoDeudaBadge estado={deuda.estado} />} />
            <Info label="Saldo actual" value={formatMoney(deuda.saldo_actual)} />
            <Info label="Cliente" value={`#${deuda.id_cliente}`} />
            <Info label="Origen" value={`${deuda.origen_tipo} #${deuda.origen_id}`} />
            <Info label="Genera recargo" value={deuda.genera_recargo ? "Sí" : "No"} />
            <Info label="Tasa recargo" value={deuda.tasa_recargo || "-"} />
            <Info label="Próximo vencimiento" value={deuda.proximo_vencimiento || "-"} />
            <Info label="Observación" value={deuda.observacion || "-"} full />
          </div>
        </div>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Registrar pago</h2>

          {!deudaAbierta ? (
            <div style={noteStyle}>La deuda no está abierta. No se pueden registrar pagos.</div>
          ) : (
            <form onSubmit={registrarPago} style={{ display: "grid", gap: "12px" }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Monto</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={pagoForm.monto}
                  onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <button
                type="button"
                disabled={guardando}
                onClick={() => setPagoForm((p) => ({ ...p, monto: String(deuda.saldo_actual) }))}
              >
                Usar saldo total
              </button>

              <label style={fieldStyle}>
                <span style={labelStyle}>Medio de pago</span>
                <select
                  value={pagoForm.medio_pago}
                  onChange={(e) => setPagoForm((p) => ({ ...p, medio_pago: e.target.value }))}
                  style={inputStyle}
                >
                  {MEDIOS_PAGO.map((medio) => <option key={medio} value={medio}>{medio}</option>)}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Nota</span>
                <textarea
                  value={pagoForm.nota}
                  onChange={(e) => setPagoForm((p) => ({ ...p, nota: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Opcional"
                />
              </label>

              <button type="submit" disabled={guardando}>Registrar pago</button>

              <div style={noteStyle}>
                Si no hay caja abierta, el backend va a rechazar el pago. No lo tapes desde frontend.
              </div>
            </form>
          )}
        </aside>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Movimientos</h2>
        </div>

        {movimientos.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay movimientos registrados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Monto</th>
                  <th style={thStyle}>Origen</th>
                  <th style={thStyle}>Nota</th>
                  <th style={thStyle}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{mov.id}</td>
                    <td style={tdStyle}>{mov.tipo_movimiento}</td>
                    <td style={tdStyle}><strong>{formatMoney(mov.monto)}</strong></td>
                    <td style={tdStyle}>{mov.origen_tipo ? `${mov.origen_tipo} #${mov.origen_id}` : "-"}</td>
                    <td style={tdStyle}>{mov.nota || "-"}</td>
                    <td style={tdStyle}>#{mov.id_usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px, 1.4fr) minmax(280px, 0.8fr)", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const infoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "4px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
