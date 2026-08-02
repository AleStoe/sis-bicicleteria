import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CreditCard,
  Landmark,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { anularCreditoAdministrativo, obtenerCredito, reintegrarCredito } from "../services/creditosService";
import { EstadoCreditoBadge } from "./CreditosListPage";
import { formatMoneyPrecise } from "../utils/formatters";
import { getCreditoContexto, getMovimientoCreditoLabel, getOrigenFinancieroLabel } from "../utils/financials";
import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";

const ID_SUCURSAL = 1;

const MEDIOS = [
  "efectivo",
  "transferencia",
];

export default function CreditoDetallePage() {
  const { creditoId } = useParams();
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1000px)");

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
        id_usuario: usuarioId,
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

  async function handleAnularAdministrativo() {
    const credito = data?.credito;
    if (!credito) return;

    const saldo = Number(credito.saldo_actual || 0);
    if (saldo <= 0) {
      setError("El crédito no tiene saldo disponible para anular");
      return;
    }

    const motivo = window.prompt(
      "Motivo de anulación administrativa del crédito:\nEj: Venta duplicada #74 reemplazada por Venta #75. No hubo reintegro de dinero."
    );
    if (!motivo || !motivo.trim()) return;

    const confirmado = window.confirm(
      "Esta acción cerrará el crédito sin generar egreso de caja.\n\nUsala sólo para correcciones administrativas.\n\n¿Confirmás anular este crédito?"
    );
    if (!confirmado) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await anularCreditoAdministrativo(creditoId, {
        motivo: motivo.trim(),
        id_usuario: usuarioId,
      });

      await cargarCredito();
      setMensaje("Crédito anulado administrativamente. No se generó movimiento de caja.");
    } catch (err) {
      setError(err.message || "No se pudo anular el crédito");
    } finally {
      setProcesando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando crédito...</p>;
  if (!data) return <p style={{ padding: "24px" }}>No se encontró el crédito.</p>;

  const credito = data.credito;
  const movimientos = data.movimientos || [];
  const contextoCredito = getCreditoContexto(credito);
  const origenVenta = data.origen_venta;
  const saldo = Number(credito.saldo_actual || 0);
  const puedeReintegrar = saldo > 0 && ["abierto", "aplicado_parcial"].includes(credito.estado);

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <header style={{ ...headerStyle, ...(isMobile ? headerMobileStyle : {}) }}>
        <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
          <div style={eyebrowStyle}>Saldo a favor del cliente</div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 28 : 34, lineHeight: 1.05 }}>Crédito #{credito.id}</h1>
          <p style={headerMetaStyle}>
            Cliente #{credito.id_cliente} · {getOrigenFinancieroLabel(credito.origen_tipo, credito.origen_id)}
          </p>
        </div>

        <div style={balanceHeroStyle}>
          <span style={{ fontSize: 12, fontWeight: 850, opacity: 0.76 }}>Disponible</span>
          <strong style={{ fontSize: isMobile ? 26 : 31, lineHeight: 1 }}>{formatMoneyPrecise(credito.saldo_actual)}</strong>
          <EstadoCreditoBadge estado={credito.estado} />
        </div>

        <div style={{ ...actionsStyle, ...(isMobile ? actionsMobileStyle : {}) }}>
          <button onClick={cargarCredito} style={headerButtonStyle}>
            <RefreshCw size={16} />
            Refrescar
          </button>
          <Link to="/creditos" style={headerButtonStyle}>
            <ArrowLeft size={16} />
            Volver
          </Link>
        </div>
      </header>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={operationGuideStyle}>
        <div style={cashRuleStyle}>
          <div style={ruleIconStyle}><Banknote size={20} /></div>
          <div>
            <strong>Efectivo y transferencia</strong>
            <span style={ruleTextStyle}>Podés usar el saldo en otra venta o reintegrarlo desde esta pantalla.</span>
          </div>
        </div>
        <div style={electronicRuleStyle}>
          <div style={ruleIconStyle}><CreditCard size={20} /></div>
          <div>
            <strong>Tarjeta y Mercado Pago</strong>
            <span style={ruleTextStyle}>Se cancelan en la terminal o plataforma correspondiente.</span>
          </div>
        </div>
      </section>

      <section style={contextNoteStyle}>
        <ReceiptText size={20} />
        <div style={{ display: "grid", gap: 3 }}>
          <strong>{contextoCredito.titulo}</strong>
          <span>{contextoCredito.descripcion}</span>
        </div>
      </section>

      {origenVenta ? (
        <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
                Origen del crédito
              </div>
              <h2 style={{ ...cardTitleStyle, marginTop: 4 }}>
                Venta #{origenVenta.venta.id}
              </h2>
              <div style={mutedStyle}>
                {new Date(origenVenta.venta.fecha).toLocaleString("es-AR")} · {origenVenta.venta.cliente_nombre}
              </div>
            </div>
            <Link to={`/ventas/${origenVenta.venta.id}`} style={linkBtnStyle}>
              Ver venta completa
            </Link>
          </div>

          <div style={{ ...infoGridStyle, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Info label="Precio de lista/base" value={formatMoneyPrecise(origenVenta.venta.subtotal_base)} />
            <Info label="Base que se alcanzó a cubrir" value={formatMoneyPrecise(origenVenta.total_base_pagada)} />
            <Info label="Beneficio aplicado" value={formatMoneyPrecise(origenVenta.total_descuento_aplicado)} />
            <Info label="Dinero realmente cobrado" value={formatMoneyPrecise(origenVenta.total_cobrado_real)} />
            <Info label="Crédito generado" value={formatMoneyPrecise(credito.saldo_actual)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <strong>Productos de la venta</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {origenVenta.items.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{item.descripcion_snapshot} × {Number(item.cantidad)}</span>
                    <strong style={{ whiteSpace: "nowrap" }}>{formatMoneyPrecise(item.subtotal)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <strong>Pagos que originaron el crédito</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {origenVenta.pagos.length === 0 ? (
                  <span style={mutedStyle}>La venta no tiene pagos registrados.</span>
                ) : origenVenta.pagos.map((pago) => (
                  <div key={pago.id} style={{ borderBottom: "1px solid #f2f4f7", paddingBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{pago.medio_pago}</strong>
                      <strong>{formatMoneyPrecise(pago.monto_total_cobrado)}</strong>
                    </div>
                    <div style={{ ...mutedStyle, margin: "3px 0 0" }}>
                      Cubre {formatMoneyPrecise(pago.monto_base_aplicado)}
                      {Number(pago.monto_descuento_aplicado || 0) > 0
                        ? ` · Beneficio ${formatMoneyPrecise(pago.monto_descuento_aplicado)}`
                        : ""}
                      {pago.estado !== "confirmado" ? ` · ${pago.estado}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, color: "#1e40af" }}>
            El saldo a favor conserva el dinero real recibido. Al usarlo en otra venta, el sistema lo trata como contado y calcula automáticamente qué base comercial cubre.
          </div>
        </section>
      ) : null}

      <div style={isNarrow ? gridMobileStyle : gridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeadingStyle}>
            <WalletCards size={20} color="#2563eb" />
            <div>
              <h2 style={{ ...cardTitleStyle, marginBottom: 2 }}>Datos del crédito</h2>
              <span style={sectionSubtitleStyle}>Información operativa y trazabilidad.</span>
            </div>
          </div>
          <div style={infoGridStyle}>
            <Info label="Cliente" value={`#${credito.id_cliente}`} />
            <Info label="Origen" value={getOrigenFinancieroLabel(credito.origen_tipo, credito.origen_id)} />
            <Info label="Observación" value={credito.observacion || "-"} full />
          </div>
        </section>

        <aside style={{ ...cardStyle, borderTop: "4px solid #f97316" }}>
          <div style={sectionHeadingStyle}>
            <Landmark size={20} color="#f97316" />
            <div>
              <h2 style={{ ...cardTitleStyle, marginBottom: 2 }}>Reintegrar saldo</h2>
              <span style={sectionSubtitleStyle}>Devuelve dinero y genera un egreso de caja.</span>
            </div>
          </div>

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
                  placeholder={`Máximo ${formatMoneyPrecise(saldo)}`}
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

              <button type="submit" disabled={procesando} style={primaryActionStyle}>
                <Banknote size={17} />
                {procesando ? "Reintegrando..." : "Confirmar reintegro"}
              </button>

              <div style={noteStyle}>
                El reintegro genera un egreso de caja. Los pagos con tarjeta o Mercado Pago se cancelan desde su terminal o plataforma, no desde Créditos.
              </div>
            </form>
          )}
        </aside>
      </div>

      {puedeReintegrar && (
        <section style={{ ...cardStyle, border: "1px solid #fed7aa", background: "#fff7ed" }}>
          <div style={sectionHeadingStyle}>
            <AlertTriangle size={20} color="#c2410c" />
            <div>
              <h2 style={{ ...cardTitleStyle, marginBottom: 2 }}>Corrección administrativa</h2>
              <span style={sectionSubtitleStyle}>
                Cierra un crédito mal generado sin devolver dinero ni mover caja.
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: "#9a3412", lineHeight: 1.4 }}>
              Usar sólo cuando el saldo a favor nació por una carga duplicada o un error operativo ya corregido por otra venta. Si realmente devolvés plata al cliente, usá Reintegrar saldo.
            </div>
            <button
              type="button"
              disabled={procesando}
              onClick={handleAnularAdministrativo}
              style={dangerOutlineButtonStyle}
            >
              <AlertTriangle size={17} />
              Anular crédito administrativo
            </button>
          </div>
        </section>
      )}

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <h2 style={{ margin: 0 }}>Movimientos</h2>
        </div>

        {movimientos.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay movimientos registrados.</div>
        ) : (
          <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
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
                    <td style={tdStyle}>{getMovimientoCreditoLabel(mov.tipo_movimiento, mov.origen_tipo)}</td>
                    <td style={tdStyle}>{formatMoneyPrecise(mov.monto)}</td>
                    <td style={tdStyle}>
                      {getOrigenFinancieroLabel(mov.origen_tipo, mov.origen_id)}
                    </td>
                    <td style={tdStyle}>{mov.nota || "-"}</td>
                    <td style={tdStyle}>{formatUsuario(mov)}</td>
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
    <div style={{ gridColumn: full ? "1 / -1" : "auto", background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: 8, padding: "12px" }}>
      <div style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const pageMobileStyle = { padding: "12px", overflowX: "hidden" };
const headerStyle = { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto auto", gap: 18, alignItems: "center", marginBottom: 16, background: "#111827", color: "#fff", borderRadius: 8, padding: "20px 22px", boxShadow: "0 12px 28px rgba(15,23,42,.14)" };
const headerMobileStyle = { gridTemplateColumns: "1fr", alignItems: "start", padding: 16 };
const eyebrowStyle = { color: "#fb923c", fontSize: 12, fontWeight: 900, textTransform: "uppercase" };
const headerMetaStyle = { margin: 0, color: "#cbd5e1" };
const balanceHeroStyle = { minWidth: 210, display: "grid", gap: 5, padding: "12px 16px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8 };
const actionsStyle = { display: "flex", gap: 8, flexWrap: "wrap" };
const actionsMobileStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%" };
const headerButtonStyle = { minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textDecoration: "none", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.28)", color: "#fff", background: "rgba(255,255,255,.08)", fontWeight: 800, cursor: "pointer" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px, 1.4fr) minmax(300px, 0.8fr)", gap: "16px", alignItems: "start" };
const gridMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: "12px", alignItems: "start" };
const operationGuideStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 };
const cashRuleStyle = { display: "grid", gridTemplateColumns: "38px 1fr", alignItems: "center", gap: 10, padding: 13, background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 8, color: "#065f46" };
const electronicRuleStyle = { display: "grid", gridTemplateColumns: "38px 1fr", alignItems: "center", gap: 10, padding: 13, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, color: "#1e40af" };
const ruleIconStyle = { width: 36, height: 36, borderRadius: 999, background: "#fff", display: "grid", placeItems: "center" };
const ruleTextStyle = { display: "block", marginTop: 3, color: "#475467", fontSize: 13, lineHeight: 1.35 };
const contextNoteStyle = {
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#9a3412",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: "16px",
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
};
const cardStyle = { background: "white", borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(15,23,42,.06)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const sectionHeadingStyle = { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 };
const sectionSubtitleStyle = { color: "#667085", fontSize: 13 };
const infoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: 8, border: "1px solid #d0d5dd", color: "#111827", background: "white", fontWeight: 800 };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "8px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = { width: "100%", minHeight: 42, padding: "10px 12px", borderRadius: 8, border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box", background: "#fff" };
const textareaStyle = { ...inputStyle, minHeight: "70px", resize: "vertical" };
const primaryActionStyle = { minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: 0, borderRadius: 8, background: "#f97316", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer" };
const dangerOutlineButtonStyle = { minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #fb923c", borderRadius: 8, background: "#fff", color: "#c2410c", fontWeight: 900, fontSize: 15, cursor: "pointer", width: "fit-content", padding: "0 14px" };
const tableHeaderStyle = { padding: "16px 18px", borderBottom: "1px solid #eee" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "850px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };

function formatUsuario(mov) {
  if (mov.usuario_nombre) {
    return mov.usuario_username
      ? `${mov.usuario_nombre} (@${mov.usuario_username})`
      : mov.usuario_nombre;
  }

  return mov.id_usuario ? `Usuario #${mov.id_usuario}` : "-";
}
