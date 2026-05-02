import { useEffect, useMemo, useState } from "react";
import { crearPago, listarPagosDeVenta, revertirPago } from "../../services/pagosService";

const MEDIOS_PAGO = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
];

const ID_USUARIO = 1;

export default function PagoVentaPanel({ ventaId, saldoPendiente = 0, estadoVenta = "" }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [form, setForm] = useState({ medio_pago: "efectivo", monto: "", nota: "" });

  const saldo = Number(saldoPendiente || 0);
  const ventaCerradaParaPago = ["entregada", "anulada"].includes(estadoVenta);
  const puedePagar = !ventaCerradaParaPago && saldo > 0;

  useEffect(() => {
    if (ventaId) cargarPagos();
  }, [ventaId]);

  const totalConfirmado = useMemo(() => {
    return pagos
      .filter((p) => p.estado === "confirmado")
      .reduce((acc, p) => acc + Number(p.monto_total_cobrado || 0), 0);
  }, [pagos]);

  async function cargarPagos() {
    try {
      setLoading(true);
      setError("");
      const data = await listarPagosDeVenta(ventaId);
      setPagos(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pagos de la venta");
    } finally {
      setLoading(false);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();

    const monto = Number(form.monto);

    if (!puedePagar) {
      setError("Esta venta no puede recibir pagos en este estado o no tiene saldo pendiente");
      return;
    }

    if (!monto || monto <= 0) {
      setError("El monto del pago debe ser mayor a cero");
      return;
    }

    if (monto > saldo) {
      setError("El monto no puede superar el saldo pendiente de la venta");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await crearPago({
        origen_tipo: "venta",
        origen_id: Number(ventaId),
        medio_pago: form.medio_pago,
        monto,
        id_usuario: ID_USUARIO,
        nota: form.nota?.trim() || null,
      });

      setForm({ medio_pago: "efectivo", monto: "", nota: "" });
      await cargarPagos();
      setMensaje("Pago registrado correctamente. Refrescá la venta para ver el saldo actualizado.");
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago. Verificá que la caja esté abierta.");
    } finally {
      setGuardando(false);
    }
  }

  async function handleRevertirPago(pago) {
    const motivo = window.prompt("Motivo de reversión del pago:");
    if (!motivo || !motivo.trim()) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await revertirPago(pago.id, {
        motivo: motivo.trim(),
        id_usuario: ID_USUARIO,
      });

      await cargarPagos();
      setMensaje("Pago revertido correctamente. Refrescá la venta para ver el saldo actualizado.");
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Pagos de la venta</h2>
          <p style={mutedStyle}>Total confirmado: {formatMoney(totalConfirmado)} · Saldo actual: {formatMoney(saldo)}</p>
        </div>
        <button onClick={cargarPagos} disabled={loading || guardando}>Refrescar pagos</button>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      {!puedePagar && (
        <div style={noteStyle}>
          {ventaCerradaParaPago
            ? "Esta venta no puede recibir pagos directos. Si fue entregada con deuda, el pago debe registrarse en el módulo Deudas."
            : "Esta venta no tiene saldo pendiente para cobrar."}
        </div>
      )}

      <form onSubmit={registrarPago} style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Medio de pago</span>
          <select
            value={form.medio_pago}
            onChange={(e) => setForm((p) => ({ ...p, medio_pago: e.target.value }))}
            style={inputStyle}
            disabled={!puedePagar || guardando}
          >
            {MEDIOS_PAGO.map((medio) => (
              <option key={medio} value={medio}>{medio}</option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Monto</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={saldo || undefined}
            value={form.monto}
            onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
            style={inputStyle}
            disabled={!puedePagar || guardando}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Nota</span>
          <input
            value={form.nota}
            onChange={(e) => setForm((p) => ({ ...p, nota: e.target.value }))}
            placeholder="Opcional"
            style={inputStyle}
            disabled={!puedePagar || guardando}
          />
        </label>

        <button type="submit" disabled={!puedePagar || guardando} style={{ alignSelf: "end" }}>
          Registrar pago
        </button>
      </form>

      <div style={{ marginTop: "16px", overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Medio</th>
              <th style={thStyle}>Monto</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Nota</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 ? (
              <tr><td colSpan="7" style={tdStyle}>No hay pagos registrados para esta venta.</td></tr>
            ) : (
              pagos.map((pago) => (
                <tr key={pago.id}>
                  <td style={tdStyle}>#{pago.id}</td>
                  <td style={tdStyle}>{formatDate(pago.fecha)}</td>
                  <td style={tdStyle}>{pago.medio_pago}</td>
                  <td style={tdStyle}>{formatMoney(pago.monto_total_cobrado)}</td>
                  <td style={tdStyle}>{pago.estado}</td>
                  <td style={tdStyle}>{pago.nota || "-"}</td>
                  <td style={tdStyle}>
                    {pago.estado === "confirmado" ? (
                      <button disabled={guardando} onClick={() => handleRevertirPago(pago)}>
                        Revertir
                      </button>
                    ) : (
                      <span style={mutedStyle}>Sin acciones</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" };
const titleStyle = { margin: 0, fontSize: "20px" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end", marginTop: "12px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "12px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "12px" };
const noteStyle = { background: "#fff8e6", border: "1px solid #ffe3a3", padding: "12px", borderRadius: "10px", color: "#7a4b00", marginBottom: "12px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", borderTop: "1px solid #eee", verticalAlign: "top" };
