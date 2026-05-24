import { formatMoney } from "../../../utils/formatters";

const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo", icon: "💵", helper: "Contado" },
  { value: "transferencia", label: "Transferencia", icon: "🏦", helper: "Contado" },
  { value: "tarjeta", label: "Tarjeta", icon: "💳", helper: "Cuotas / recargo" },
  { value: "mercadopago", label: "MercadoPago", icon: "📲", helper: "Digital" },
];

export default function CheckoutAgregarPago({
  medioPago,
  setMedioPago,
  monto,
  setMonto,
  agregarPago,
  sugerirMontoParaSaldar,
  previewSaldar,
  errorLocal,
  simulando,
  planesTarjeta,
  planTarjetaId,
  setPlanTarjetaId,
}) {
  const esTarjeta = medioPago === "tarjeta";
  const medioActivo = MEDIOS_PAGO.find((medio) => medio.value === medioPago);

  const tramoPreview = previewSaldar?.tramos_pago?.at?.(-1);
  const montoBaseSugerido = previewSaldar?.monto_base_sugerido_para_saldar;
  const montoSugeridoCobrado = previewSaldar?.monto_sugerido_para_saldar;

  const descuentoPreview = Number(tramoPreview?.descuento_aplicado || 0);
  const recargoPreview = Number(tramoPreview?.recargo_aplicado || 0);
  const hayDescuento = descuentoPreview > 0;
  const hayRecargo = recargoPreview > 0;
  const mostrarPreview = previewSaldar?.monto_sugerido_para_saldar != null;

  return (
    <div style={styles.payBox}>
      <div style={styles.header}>
        <div>
          <div style={styles.payTitle}>¿Cómo paga el cliente?</div>
          <div style={styles.subtitle}>
            Elegí un medio, tocá “Completar saldo” y el sistema te dice cuánto cobrar.
          </div>
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
              <small style={active ? styles.methodHelperActive : styles.methodHelper}>{medio.helper}</small>
            </button>
          );
        })}
      </div>

      {esTarjeta && (
        <div style={styles.cardPlanBox}>
          <label style={styles.cardPlanLabel}>Plan de tarjeta</label>
          <select
            value={planTarjetaId}
            onChange={(e) => setPlanTarjetaId(e.target.value)}
            style={styles.select}
            disabled={!planesTarjeta?.length}
          >
            {!planesTarjeta?.length && <option value="">Sin planes activos</option>}
            {planesTarjeta.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.entidad ? `${plan.entidad} · ` : ""}
                {plan.cuotas} cuota(s) · {Number(plan.porcentaje_recargo_cliente || 0).toFixed(0)}%
              </option>
            ))}
          </select>
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
          <div style={styles.previewHeader}>
            <span>{medioActivo?.icon} {medioActivo?.label}</span>
            <strong>{hayRecargo ? "Precio financiación" : hayDescuento ? "Precio contado" : "Precio final"}</strong>
          </div>

          <div style={styles.previewRow}>
            <span>Parte de la venta que cubre</span>
            <strong>{formatMoney(montoBaseSugerido)}</strong>
          </div>

          {hayDescuento && (
            <div style={styles.previewRow}>
              <span>Beneficio por medio de pago</span>
              <strong style={styles.successText}>- {formatMoney(descuentoPreview)}</strong>
            </div>
          )}

          {hayRecargo && (
            <div style={styles.previewRow}>
              <span>Costo financiero</span>
              <strong style={styles.warningText}>+ {formatMoney(recargoPreview)}</strong>
            </div>
          )}

          <div style={styles.previewTotalRow}>
            <span>Cliente paga</span>
            <strong>{formatMoney(montoSugeridoCobrado)}</strong>
          </div>
        </div>
      )}

      <div style={styles.amountHeader}>
        <div>
          <div style={styles.amountLabel}>{esTarjeta ? "Parte de la venta a financiar" : "Parte de la venta a cubrir"}</div>
          <small style={styles.amountHint}>No lo pienses: usá “Completar saldo” para cargar lo pendiente.</small>
        </div>
        <button type="button" onClick={sugerirMontoParaSaldar} disabled={simulando} style={styles.saldarBtn}>
          {simulando ? "Calculando..." : "Completar saldo"}
        </button>
      </div>

      <div style={styles.amountRow}>
        <input
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={(e) => {
            const value = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
            setMonto(value);
          }}
          placeholder="Ej: 10000"
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
    border: "1px solid #eaecf0",
    borderRadius: 22,
    padding: 16,
    background: "#ffffff",
    marginBottom: 12,
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  payTitle: {
    fontWeight: 950,
    fontSize: 19,
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    color: "#667085",
    fontSize: 13,
    lineHeight: 1.4,
  },
  paymentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  methodCard: {
    border: "1px solid #d0d5dd",
    background: "#ffffff",
    color: "#1f2937",
    borderRadius: 18,
    padding: "16px 12px",
    minHeight: 92,
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: 10,
    rowGap: 2,
    alignItems: "center",
    textAlign: "left",
    boxShadow: "0 6px 18px rgba(16,24,40,0.05)",
  },
  methodCardActive: {
    background: "linear-gradient(135deg, #ff6b00 0%, #f35b04 100%)",
    borderColor: "#ff6b00",
    color: "white",
    boxShadow: "0 12px 26px rgba(255, 107, 0, 0.26)",
  },
  methodIcon: {
    fontSize: 30,
    gridRow: "span 2",
  },
  methodText: {
    fontSize: 17,
    fontWeight: 950,
  },
  methodHelper: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 800,
  },
  methodHelperActive: {
    color: "rgba(255,255,255,.86)",
    fontSize: 12,
    fontWeight: 800,
  },
  cardPlanBox: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 12,
    background: "#f9fafb",
    display: "grid",
    gap: 6,
  },
  cardPlanLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#344054",
  },
  select: {
    border: "1px solid #d0d5dd",
    borderRadius: 12,
    padding: 12,
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
  },
  previewBoxNeutral: {
    border: "1px solid #d0d5dd",
    borderRadius: 18,
    padding: 14,
    background: "#f9fafb",
    display: "grid",
    gap: 9,
  },
  previewBoxSuccess: {
    border: "1px solid #abefc6",
    borderRadius: 18,
    padding: 14,
    background: "#ecfdf3",
    display: "grid",
    gap: 9,
  },
  previewBoxWarning: {
    border: "1px solid #fedf89",
    borderRadius: 18,
    padding: 14,
    background: "#fffaeb",
    display: "grid",
    gap: 9,
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#111827",
    fontWeight: 950,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(16,24,40,0.08)",
  },
  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#344054",
    fontSize: 14,
  },
  previewTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    color: "#111827",
    fontSize: 18,
    fontWeight: 950,
    paddingTop: 8,
    borderTop: "1px solid rgba(16,24,40,0.08)",
  },
  successText: { color: "#079455" },
  warningText: { color: "#b54708" },
  amountHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  amountLabel: {
    color: "#344054",
    fontSize: 14,
    fontWeight: 950,
  },
  amountHint: {
    color: "#667085",
    fontSize: 12,
  },
  amountRow: {
    display: "grid",
  },
  amountInput: {
    border: "1px solid #d0d5dd",
    borderRadius: 16,
    padding: "16px 14px",
    fontSize: 26,
    fontWeight: 850,
    color: "#111827",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  saldarBtn: {
    border: "1px solid #0b5bd3",
    background: "#eff6ff",
    color: "#0b5bd3",
    borderRadius: 12,
    padding: "10px 13px",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  addBtn: {
    border: "none",
    background: "linear-gradient(135deg, #12a15f 0%, #079455 100%)",
    color: "white",
    borderRadius: 17,
    padding: "16px 14px",
    fontWeight: 950,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(18, 161, 95, 0.22)",
  },
  localError: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 12,
    padding: 10,
    fontWeight: 800,
    fontSize: 13,
  },
};
