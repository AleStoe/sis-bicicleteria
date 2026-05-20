import { formatMoney } from "../../../utils/formatters";

const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "tarjeta", label: "Tarjeta" },
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

  const tramoPreview = previewSaldar?.tramos_pago?.at?.(-1);

  const montoBaseSugerido =
    previewSaldar?.monto_base_sugerido_para_saldar;

  const montoSugeridoCobrado =
    previewSaldar?.monto_sugerido_para_saldar;

  const descuentoPreview = Number(
    tramoPreview?.descuento_aplicado || 0
  );

  const recargoPreview = Number(
    tramoPreview?.recargo_aplicado || 0
  );

  const hayDescuento = descuentoPreview > 0;
  const hayRecargo = recargoPreview > 0;

  const mostrarPreview =
    Number(monto || 0) > 0 &&
    previewSaldar?.monto_sugerido_para_saldar != null;

  return (
    <div style={styles.payBox}>
      <div style={styles.header}>
        <div>
          <div style={styles.payTitle}>Agregar pago</div>

          <div style={styles.subtitle}>
            El sistema calcula automáticamente descuentos,
            recargos y total final según el medio de pago.
          </div>
        </div>
      </div>

      <div style={styles.paymentTabs}>
        {MEDIOS_PAGO.map((medio) => {
          const active = medioPago === medio.value;

          return (
            <button
              key={medio.value}
              type="button"
              onClick={() => setMedioPago(medio.value)}
              style={{
                ...styles.tabButton,
                ...(active ? styles.tabButtonActive : {}),
              }}
            >
              {medio.label}
            </button>
          );
        })}
      </div>

      {esTarjeta && (
        <div style={styles.cardPlanBox}>
          <label style={styles.cardPlanLabel}>
            Plan de financiación
          </label>

          <select
            value={planTarjetaId}
            onChange={(e) => setPlanTarjetaId(e.target.value)}
            style={styles.select}
            disabled={!planesTarjeta?.length}
          >
            {!planesTarjeta?.length && (
              <option value="">
                Sin planes activos
              </option>
            )}

            {planesTarjeta.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.entidad
                  ? `${plan.entidad} · `
                  : ""}
                {plan.cuotas} cuota(s) ·{" "}
                {Number(
                  plan.porcentaje_recargo_cliente || 0
                ).toFixed(0)}
                %
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
          <div style={styles.previewRow}>
            <span>Monto base</span>

            <strong>
              {formatMoney(montoBaseSugerido)}
            </strong>
          </div>

          {hayDescuento && (
            <div style={styles.previewRow}>
              <span>Descuento aplicado</span>

              <strong style={styles.successText}>
                - {formatMoney(descuentoPreview)}
              </strong>
            </div>
          )}

          {hayRecargo && (
            <div style={styles.previewRow}>
              <span>Recargo financiación</span>

              <strong style={styles.warningText}>
                + {formatMoney(recargoPreview)}
              </strong>
            </div>
          )}

          <div
            style={
              hayRecargo
                ? styles.previewRowTotalWarning
                : hayDescuento
                  ? styles.previewRowTotalSuccess
                  : styles.previewRowTotalNeutral
            }
          >
            <span>Cliente paga</span>

            <strong>
              {formatMoney(montoSugeridoCobrado)}
            </strong>
          </div>
        </div>
      )}

      <div style={styles.amountLabel}>
        {esTarjeta
          ? "Monto base financiado"
          : "Monto"}
      </div>

      <div style={styles.amountRow}>
        <input
          type="text"
          inputMode="numeric"
          value={monto}
          onChange={(e) => {
            const value = e.target.value
              .replace(",", ".")
              .replace(/[^0-9.]/g, "");

            setMonto(value);
          }}
          placeholder="Ingresar monto"
          style={styles.amountInput}
        />

        <button
          type="button"
          onClick={sugerirMontoParaSaldar}
          disabled={simulando}
          style={styles.saldarBtn}
        >
          {simulando ? "..." : "Saldar"}
        </button>

        <button
          type="button"
          onClick={agregarPago}
          style={styles.addBtn}
        >
          Agregar
        </button>
      </div>

      {errorLocal && (
        <div style={styles.localError}>
          {errorLocal}
        </div>
      )}
    </div>
  );
}

const styles = {
  payBox: {
    border: "1px solid #eaecf0",
    borderRadius: 16,
    padding: 14,
    background: "#ffffff",
    marginBottom: 12,
    display: "grid",
    gap: 12,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  payTitle: {
    fontWeight: 900,
    fontSize: 18,
    color: "#111827",
  },

  subtitle: {
    marginTop: 4,
    color: "#667085",
    fontSize: 13,
    lineHeight: 1.4,
  },

  paymentTabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  tabButton: {
    border: "1px solid #d0d5dd",
    background: "#ffffff",
    color: "#344054",
    borderRadius: 999,
    padding: "9px 14px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "0.15s",
  },

  tabButtonActive: {
    border: "1px solid #0b5bd3",
    background: "#eff6ff",
    color: "#0b5bd3",
  },

  cardPlanBox: {
    display: "grid",
    gap: 6,
  },

  cardPlanLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#344054",
  },

  select: {
    width: "100%",
    border: "1px solid #d0d5dd",
    borderRadius: 12,
    padding: "11px 12px",
    fontSize: 14,
    background: "white",
  },

  previewBoxSuccess: {
    border: "1px solid #d1fadf",
    background: "#ecfdf3",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 8,
  },

  previewBoxWarning: {
    border: "1px solid #fedf89",
    background: "#fffaeb",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 8,
  },

  previewBoxNeutral: {
    border: "1px solid #eaecf0",
    background: "#f9fafb",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 8,
  },

  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
    color: "#344054",
  },

  previewRowTotalSuccess: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 16,
    fontWeight: 900,
    color: "#067647",
    paddingTop: 8,
    borderTop: "1px solid #d1fadf",
  },

  previewRowTotalWarning: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 16,
    fontWeight: 900,
    color: "#b54708",
    paddingTop: 8,
    borderTop: "1px solid #fedf89",
  },

  previewRowTotalNeutral: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 16,
    fontWeight: 900,
    color: "#344054",
    paddingTop: 8,
    borderTop: "1px solid #eaecf0",
  },

  successText: {
    color: "#067647",
  },

  warningText: {
    color: "#b54708",
  },

  amountLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#344054",
  },

  amountRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: 8,
    alignItems: "stretch",
  },

  amountInput: {
    border: "2px solid #d0d5dd",
    borderRadius: 14,
    padding: "16px 14px",
    fontSize: 28,
    fontWeight: 900,
    color: "#111827",
    background: "#ffffff",
    outline: "none",
  },

  saldarBtn: {
    border: "1px solid #0b5bd3",
    background: "white",
    color: "#0b5bd3",
    borderRadius: 12,
    padding: "0 16px",
    fontWeight: 900,
    cursor: "pointer",
  },

  addBtn: {
    border: "none",
    background: "#16a34a",
    color: "white",
    borderRadius: 12,
    padding: "0 18px",
    fontWeight: 900,
    cursor: "pointer",
  },

  localError: {
    background: "#fff1f0",
    border: "1px solid #fecdca",
    color: "#b42318",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
  },
};