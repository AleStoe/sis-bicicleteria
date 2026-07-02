import { formatMoney } from "../../../utils/formatters";

const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo", icon: "💵", helper: "Contado" },
  { value: "transferencia", label: "Transferencia", icon: "🏦", helper: "Banco" },
  { value: "tarjeta", label: "Tarjeta", icon: "💳", helper: "Plan" },
  { value: "mercadopago", label: "MercadoPago", icon: "📱", helper: "QR" },
];

export default function CheckoutAgregarPago({
  medioPago,
  setMedioPago,
  monto,
  setMonto,
  agregarPago,
  sugerirMontoParaSaldar,
  previewSaldar,
  previewMontoActual,
  pendienteActual,
  errorLocal,
  simulando,
  planesTarjeta,
  planTarjetaId,
  setPlanTarjetaId,
  creditoCubreSaldo = false,
}) {
  const esTarjeta = medioPago === "tarjeta";
  const medioActivo = MEDIOS_PAGO.find((medio) => medio.value === medioPago);

  const normalizarMontoPago = (valor) => {
    const numero = Number(valor || 0);
    if (!Number.isFinite(numero)) return 0;
    return Math.round(numero);
  };

  const formatearMontoInput = (valor) => {
    const numero = normalizarMontoPago(valor);
    if (numero <= 0 && !String(valor || "").trim()) return "";
    return numero.toLocaleString("es-AR", {
      maximumFractionDigits: 0,
    });
  };

  const montoManual = normalizarMontoPago(monto);
  const hayMontoManual = Number.isFinite(montoManual) && montoManual > 0;

  const tramoMontoActual = previewMontoActual?.tramos_pago?.at?.(-1);
  const tramoSaldar = previewSaldar?.tramos_pago?.at?.(-1);
  const tramoPreview = tramoMontoActual || tramoSaldar;

  const montoBaseSugerido =
    Number(
      tramoPreview?.monto_base_aplicado ??
        tramoPreview?.monto_base ??
        previewSaldar?.monto_base_sugerido_para_saldar ??
        montoManual ??
        0
    );
  const montoSugeridoCobrado =
    normalizarMontoPago(tramoPreview?.monto_total_cobrado ?? previewSaldar?.monto_sugerido_para_saldar ?? montoManual ?? 0);

  const descuentoPreview = Number(tramoPreview?.descuento_aplicado || 0);
  const recargoPreview = Number(tramoPreview?.recargo_aplicado || 0);
  const creditoAplicadoPreview = Number(previewMontoActual?.credito_aplicado ?? previewSaldar?.credito_aplicado ?? 0);
  const saldoPendienteLuego = Number(previewMontoActual?.total_a_cobrar ?? pendienteActual ?? 0);
  const hayDescuento = descuentoPreview > 0;
  const hayRecargo = recargoPreview > 0;
  const mostrarPreview = Boolean(tramoPreview) && hayMontoManual;
  const mostrarInstruccion = hayMontoManual;
  const montoACobrarAhora = mostrarPreview ? montoSugeridoCobrado : montoManual;

  return (
    <div style={styles.payBox}>
      <div style={styles.header}>
        <div>
          <div style={styles.payTitle}>¿Cómo paga el cliente?</div>
          <div style={styles.subtitle}>Elegí cómo paga el cliente.</div>
        </div>
      </div>

      <div style={styles.paymentGrid}>
        {MEDIOS_PAGO.map((medio) => {
          const active = medioPago === medio.value;

          return (
            <button
              key={medio.value}
              type="button"
              onClick={() => setMedioPago(medio.value)}
              style={{
                ...styles.methodCard,
                ...(active ? styles.methodCardActive : {}),
              }}
            >
              <span style={styles.methodIcon}>{medio.icon}</span>
              <span style={styles.methodText}>{medio.label}</span>
              <small style={active ? styles.methodHelperActive : styles.methodHelper}>
                {medio.helper}
              </small>
            </button>
          );
        })}
      </div>

      {esTarjeta && (
        <label style={styles.planBox}>
          <span style={styles.planLabel}>Plan de tarjeta</span>
          <select
            value={planTarjetaId || ""}
            onChange={(e) => setPlanTarjetaId(e.target.value)}
            style={styles.planSelect}
          >
            <option value="">Seleccionar plan...</option>
            {(planesTarjeta || []).map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nombre || `Plan #${plan.id}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {mostrarInstruccion && (
        <div style={styles.operatorHint}>
          <span style={styles.operatorHintLabel}>
            {esTarjeta ? "Total en tarjeta" : "Total a cobrar ahora"}
          </span>
          <strong>{formatMoney(montoACobrarAhora)}</strong>
          {mostrarPreview ? (
            <small>
              Con este pago en {medioActivo?.label || "este medio"} se cubren{" "}
              {formatMoney(montoBaseSugerido)} de la venta.
              {hayDescuento && (
                <>
                  <br />
                  Descuento aplicado: {formatMoney(descuentoPreview)}.
                </>
              )}
              {hayRecargo && (
                <>
                  <br />
                  Financiacion incluida: {formatMoney(recargoPreview)}.
                </>
              )}
              {Number.isFinite(saldoPendienteLuego) && (
                <>
                  <br />
                  Saldo pendiente: {formatMoney(saldoPendienteLuego)}.
                </>
              )}
            </small>
          ) : simulando ? (
            <small>Calculando simulación del pago...</small>
          ) : (
            <small>Pago parcial cargado manualmente.</small>
          )}
        </div>
      )}

      {mostrarPreview && (
        <div
          style={
            hayRecargo
              ? styles.previewBoxWarning
              : hayDescuento
                ? styles.previewBoxSuccess
                : styles.previewBoxNeutral
          }
        >
          <div style={styles.previewTitle}>
            {hayRecargo
              ? "Detalle de financiacion"
              : hayDescuento
                ? "Beneficio aplicado"
                : "Resumen del cobro"}
          </div>

          <div style={styles.previewRow}>
            <span>Cubre de la venta</span>
            <strong>{formatMoney(montoBaseSugerido)}</strong>
          </div>

          {hayDescuento && (
            <div style={styles.previewRow}>
              <span>Descuento</span>
              <strong style={styles.successText}>- {formatMoney(descuentoPreview)}</strong>
            </div>
          )}

          {hayRecargo && (
            <div style={styles.previewRow}>
              <span>Financiacion</span>
              <strong style={styles.warningText}>+ {formatMoney(recargoPreview)}</strong>
            </div>
          )}

          {creditoAplicadoPreview > 0 && (
            <div style={styles.previewRow}>
              <span>Crédito aplicado</span>
              <strong style={styles.successText}>- {formatMoney(creditoAplicadoPreview)}</strong>
            </div>
          )}

          <div style={styles.previewRow}>
            <span>Saldo pendiente</span>
            <strong>{formatMoney(saldoPendienteLuego)}</strong>
          </div>

          <div style={styles.previewTotalRow}>
            <span>{esTarjeta ? "Total en tarjeta" : "Total a cobrar ahora"}</span>
            <strong>{formatMoney(montoSugeridoCobrado)}</strong>
          </div>
        </div>
      )}

      <div style={styles.amountHeader}>
        <div style={styles.amountLabel}>
          {esTarjeta ? "Monto final en tarjeta" : "Cliente paga"}
        </div>

        <button
          type="button"
          onClick={sugerirMontoParaSaldar}
          disabled={simulando}
          style={{
            ...styles.saldarBtn,
            ...(creditoCubreSaldo ? styles.saldarBtnCredit : {}),
          }}
        >
          {simulando
            ? "Calculando..."
            : creditoCubreSaldo
              ? "Aplicar crédito y completar saldo"
              : "Completar saldo"}
        </button>
      </div>

      <div style={styles.amountRow}>
        <input
          type="text"
          inputMode="numeric"
          value={formatearMontoInput(monto)}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9]/g, "");
            setMonto(value);
          }}
          placeholder="$ 0"
          style={styles.amountInput}
        />
      </div>

      <button type="button" onClick={agregarPago} style={styles.addBtn}>
        Agregar pago {medioActivo?.label || ""}
      </button>

      {errorLocal && <div style={styles.localError}>{errorLocal}</div>}
    </div>
  );
}

const styles = {
  payBox: {
    background: "white",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  payTitle: {
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  subtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },
  paymentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
  },
  methodCard: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 14,
    padding: "10px 8px",
    display: "grid",
    gap: 3,
    justifyItems: "center",
    cursor: "pointer",
    color: "#334155",
  },
  methodCardActive: {
    borderColor: "#f97316",
    background: "#fff7ed",
    boxShadow: "0 0 0 2px rgba(249, 115, 22, 0.16)",
    color: "#9a3412",
  },
  methodIcon: {
    fontSize: 22,
  },
  methodText: {
    fontWeight: 950,
    fontSize: 13,
  },
  methodHelper: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11,
  },
  methodHelperActive: {
    color: "#c2410c",
    fontWeight: 900,
    fontSize: 11,
  },
  planBox: {
    display: "grid",
    gap: 6,
  },
  planLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#334155",
  },
  planSelect: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 800,
  },
  operatorHint: {
    borderRadius: 14,
    padding: 12,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    display: "grid",
    gap: 4,
  },
  operatorHintLabel: {
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#2563eb",
  },
  previewBoxNeutral: {
    borderRadius: 14,
    padding: 11,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 7,
  },
  previewBoxSuccess: {
    borderRadius: 14,
    padding: 11,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    display: "grid",
    gap: 7,
  },
  previewBoxWarning: {
    borderRadius: 14,
    padding: 11,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    display: "grid",
    gap: 7,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#475569",
  },
  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },
  previewTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(15, 23, 42, 0.12)",
    fontSize: 17,
    fontWeight: 1000,
    color: "#0f172a",
  },
  successText: {
    color: "#1d4ed8",
  },
  warningText: {
    color: "#c2410c",
  },
  amountHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  amountLabel: {
    fontSize: 15,
    fontWeight: 950,
    color: "#0f172a",
  },
  saldarBtn: {
    border: "none",
    borderRadius: 14,
    background: "#0f172a",
    color: "white",
    padding: "14px 18px",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
  },
  saldarBtnCredit: {
    background: "#15803d",
    boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.18), 0 10px 22px rgba(21, 128, 61, 0.2)",
  },
  amountRow: {
    display: "grid",
  },
  amountInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "2px solid #cbd5e1",
    borderRadius: 14,
    padding: "14px 14px",
    fontSize: 24,
    fontWeight: 950,
    outline: "none",
  },
  addBtn: {
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    background: "#ecfdf5",
    color: "#047857",
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
  },
  localError: {
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: 10,
    fontSize: 13,
    fontWeight: 800,
  },
};
