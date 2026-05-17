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
  formatMoney,
  errorLocal,
  simulando,
  planesTarjeta,
  planTarjetaId,
  setPlanTarjetaId,
}) {
  const esTarjeta = medioPago === "tarjeta";

  const tramoPreview = previewSaldar?.tramos_pago?.at?.(-1);

  const montoBaseSugerido = previewSaldar?.monto_base_sugerido_para_saldar;
  const montoSugeridoCobrado = previewSaldar?.monto_sugerido_para_saldar;

  const descuentoPreview = Number(tramoPreview?.descuento_aplicado || 0);
  const recargoPreview = Number(tramoPreview?.recargo_aplicado || 0);
  const hayDescuento = descuentoPreview > 0;
  const hayRecargo = recargoPreview > 0;

  return (
    <div style={styles.payBox}>
      <div style={styles.payTitle}>Agregar pago</div>

      <div style={styles.paymentControls}>
        <select
          value={medioPago}
          onChange={(e) => setMedioPago(e.target.value)}
          style={styles.select}
        >
          {MEDIOS_PAGO.map((medio) => (
            <option key={medio.value} value={medio.value}>
              {medio.label}
            </option>
          ))}
        </select>

        {esTarjeta && (
          <div style={styles.cardPlanBox}>
            <label style={styles.cardPlanLabel}>Plan de tarjeta</label>

            <select
              value={planTarjetaId}
              onChange={(e) => setPlanTarjetaId(e.target.value)}
              style={styles.select}
              disabled={!planesTarjeta?.length}
            >
              {!planesTarjeta?.length && (
                <option value="">Sin planes activos</option>
              )}

              {planesTarjeta.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.entidad ? `${plan.entidad} - ` : ""}
                  {plan.cuotas} cuota(s) ·{" "}
                  {Number(plan.porcentaje_recargo_cliente || 0).toFixed(2)}%
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {previewSaldar?.monto_sugerido_para_saldar != null && (
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
            <span>Base sugerida</span>
            <strong>{formatMoney(montoBaseSugerido)}</strong>
          </div>

          {hayDescuento && (
            <div style={styles.previewRow}>
              <span>Descuento del tramo</span>
              <strong style={styles.successText}>
                - {formatMoney(descuentoPreview)}
              </strong>
            </div>
          )}

          {hayRecargo && (
            <div style={styles.previewRow}>
              <span>Recargo del tramo</span>
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
            <span>Total a cobrar</span>
            <strong>{formatMoney(montoSugeridoCobrado)}</strong>
          </div>
        </div>
      )}

      <div style={styles.amountRow}>
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto base"
          style={styles.input}
        />

        <button
          type="button"
          onClick={sugerirMontoParaSaldar}
          disabled={simulando}
          style={styles.saldarBtn}
        >
          {simulando ? "..." : "Saldar"}
        </button>

        <button type="button" onClick={agregarPago} style={styles.addBtn}>
          Agregar
        </button>
      </div>

      <div style={styles.hint}>
        Ingresá siempre el monto base del tramo. El backend calcula descuento,
        recargo y total cobrado real.
      </div>

      {errorLocal && <div style={styles.localError}>{errorLocal}</div>}
    </div>
  );
}

const styles = {
  payBox: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    background: "#f9fafb",
    marginBottom: 12,
  },
  payTitle: {
    fontWeight: 900,
    marginBottom: 8,
    color: "#344054",
  },
  paymentControls: {
    marginBottom: 10,
  },
  select: {
    width: "100%",
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 14,
    background: "white",
  },
  cardPlanBox: {
    marginTop: 10,
    display: "grid",
    gap: 6,
  },
  cardPlanLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#344054",
  },
  previewBoxSuccess: {
    border: "1px solid #d1fadf",
    background: "#ecfdf3",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    display: "grid",
    gap: 6,
  },
  previewBoxWarning: {
    border: "1px solid #fedf89",
    background: "#fffaeb",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    display: "grid",
    gap: 6,
  },
  previewBoxNeutral: {
    border: "1px solid #eaecf0",
    background: "#ffffff",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    display: "grid",
    gap: 6,
  },
  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    color: "#344054",
  },
  previewRowTotalSuccess: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 14,
    fontWeight: 900,
    color: "#067647",
    paddingTop: 6,
    borderTop: "1px solid #d1fadf",
  },
  previewRowTotalWarning: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 14,
    fontWeight: 900,
    color: "#b54708",
    paddingTop: 6,
    borderTop: "1px solid #fedf89",
  },
  previewRowTotalNeutral: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 14,
    fontWeight: 900,
    color: "#344054",
    paddingTop: 6,
    borderTop: "1px solid #eaecf0",
  },
  successText: {
    color: "#067647",
  },
  warningText: {
    color: "#b54708",
  },
  amountRow: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 100px",
    gap: 8,
  },
  input: {
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 15,
  },
  saldarBtn: {
    border: "1px solid #0b5bd3",
    background: "white",
    color: "#0b5bd3",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  addBtn: {
    border: "none",
    background: "#0b5bd3",
    color: "white",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  hint: {
    marginTop: 8,
    color: "#667085",
    fontSize: 12,
    lineHeight: 1.35,
  },
  localError: {
    marginTop: 8,
    background: "#fff1f0",
    border: "1px solid #fecdca",
    color: "#b42318",
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
  },
};