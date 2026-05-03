import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerCredito, reintegrarCredito } from "../services/creditosService";
import { EstadoCreditoBadge, formatMoney } from "./CreditosListPage";

const ID_USUARIO = 1;
const ID_SUCURSAL = 1;

const MEDIOS = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
];

export default function CreditoDetallePage() {
  const { creditoId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState({
    monto: "",
    medio_pago: "efectivo",
    motivo: "",
  });

  useEffect(() => {
    cargarCredito();
  }, [creditoId]);

  async function cargarCredito() {
    try {
      setLoading(true);
      setError("");

      const res = await obtenerCredito(creditoId);
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar el crédito");
    } finally {
      setLoading(false);
    }
  }

  async function handleReintegrar(e) {
    e.preventDefault();

    const credito = data?.credito;
    if (!credito) return;

    const monto = Number(form.monto);
    const saldo = Number(credito.saldo_actual || 0);

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }

    if (monto > saldo) {
      setError("El monto supera el saldo disponible del crédito");
      return;
    }

    if (!form.motivo.trim()) {
      setError("El motivo es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await reintegrarCredito(creditoId, {
        monto,
        medio_pago: form.medio_pago,
        motivo: form.motivo.trim(),
        id_sucursal: ID_SUCURSAL,
        id_usuario: ID_USUARIO,
      });

      setForm({ monto: "", medio_pago: "efectivo", motivo: "" });
      await cargarCredito();
      setMensaje("Crédito reintegrado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo reintegrar el crédito");
    } finally {
      setProcesando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando crédito...</p>;
  if (!data) return <p style={{ padding: "24px" }}>No se encontró el crédito.</p>;

  const credito = data.credito;
  const movimientos = data.movimientos || [];
  const saldo = Number(credito.saldo_actual || 0);
  const puedeReintegrar = saldo > 0 && ["abierto", "aplicado_parcial"].includes(credito.estado);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Crédito #{credito.id}</h1>
          <p style={mutedStyle}>
            Cliente #{credito.id_cliente} · Origen {credito.origen_tipo} #{credito.origen_id}
          </p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarCredito}>Refrescar</button>
          <Link to="/creditos" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen</h2>
          <div style={infoGridStyle}>
            <Info label="Estado" value={<EstadoCreditoBadge estado={credito.estado} />} />
            <Info label="Saldo actual" value={formatMoney(credito.saldo_actual)} />
            <Info label="Cliente" value={`#${credito.id_cliente}`} />
            <Info label="Origen" value={`${credito.origen_tipo} #${credito.origen_id}`} />
            <Info label="Observación" value={credito.observacion || "-"} full />
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Reintegrar crédito</h2>

          {!puedeReintegrar ? (
            <div style={noteStyle}>
              Este crédito no tiene saldo disponible para reintegrar.
            </div>
          ) : (
            <form onSubmit={handleReintegrar} style={{ display: "grid", gap: "10px" }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Monto</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.monto}
                  onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
                  style={inputStyle}
                  placeholder={`Máximo ${formatMoney(saldo)}`}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Medio de reintegro</span>
                <select
                  value={form.medio_pago}
                  onChange={(e) => setForm((p) => ({ ...p, medio_pago: e.target.value }))}
                  style={inputStyle}
                >
                  {MEDIOS.map((medio) => (
                    <option key={medio} value={medio}>
                      {medio}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Motivo</span>
                <textarea
                  value={form.motivo}
                  onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
                  style={textareaStyle}
                  placeholder="Ej: reintegro solicitado por el cliente"
                />
              </label>

              <button type="submit" disabled={procesando}>
                {procesando ? "Reintegrando..." : "Reintegrar"}
              </button>

              <div style={noteStyle}>
                Reintegrar crédito genera egreso de caja. Si no hay caja abierta, el backend lo va a rechazar.
              </div>
            </form>
          )}
        </aside>
      </div>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <h2 style={{ margin: 0 }}>Movimientos</h2>
        </div>

        {movimientos.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay movimientos registrados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
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
                    <td style={tdStyle}>{formatMoney(mov.monto)}</td>
                    <td style={tdStyle}>
                      {mov.origen_tipo ? `${mov.origen_tipo} #${mov.origen_id}` : "-"}
                    </td>
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
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px, 1.4fr) minmax(300px, 0.8fr)", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const infoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "8px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const textareaStyle = { ...inputStyle, minHeight: "70px", resize: "vertical" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
