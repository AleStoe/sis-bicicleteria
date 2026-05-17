export default function CheckoutPagosList({
  pagosDraft,
  quitarPago,
  formatMoney,
}) {
  return (
    <div style={styles.paymentsList}>
      <div style={styles.paymentsTitle}>Pagos cargados</div>

      {pagosDraft.length === 0 ? (
        <div style={styles.emptyPayments}>Sin pagos cargados.</div>
      ) : (
        pagosDraft.map((pago) => (
          <div key={pago.temp_id} style={styles.paymentRow}>
            <div>
              <strong>{renderMedio(pago.medio_pago)}</strong>

              <div style={styles.paymentMeta}>
                Base: {formatMoney(pago.monto_base ?? pago.monto)}
              </div>

              {pago.monto_total_cobrado != null && (
                <div style={styles.paymentMeta}>
                  Cobrado: {formatMoney(pago.monto_total_cobrado)}
                </div>
              )}
            </div>

            <strong>
              {formatMoney(pago.monto_total_cobrado ?? pago.monto)}
            </strong>

            <button
              type="button"
              onClick={() => quitarPago(pago.temp_id)}
              style={styles.removePayment}
            >
              Quitar
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function renderMedio(medio) {
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    tarjeta: "Tarjeta",
  };

  return map[medio] || medio;
}

const styles = {
  paymentsList: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },

  paymentsTitle: {
    fontWeight: 900,
    marginBottom: 8,
  },

  emptyPayments: {
    color: "#667085",
    fontSize: 13,
  },

  paymentRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 8,
    alignItems: "center",
    padding: "7px 0",
    borderTop: "1px solid #f2f4f7",
  },

  paymentMeta: {
    color: "#667085",
    fontSize: 12,
    marginTop: 2,
  },

  removePayment: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 8,
    padding: "5px 8px",
    fontWeight: 800,
    cursor: "pointer",
  },
};