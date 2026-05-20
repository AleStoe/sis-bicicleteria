import { formatMoney } from "../../../utils/formatters";

export default function CheckoutPagosList({
  pagosDraft,
  quitarPago,
}) {
  return (
    <div style={styles.paymentsList}>
      <div style={styles.header}>
        <div style={styles.paymentsTitle}>Pagos cargados</div>
        <div style={styles.count}>{pagosDraft.length}</div>
      </div>

      {pagosDraft.length === 0 ? (
        <div style={styles.emptyPayments}>Sin pagos cargados.</div>
      ) : (
        <div style={styles.list}>
          {pagosDraft.map((pago) => {
            const base = pago.monto_base ?? pago.monto;
            const cobrado = pago.monto_total_cobrado ?? pago.monto;

            return (
              <div key={pago.temp_id} style={styles.paymentRow}>
                <div style={styles.left}>
                  <strong style={styles.method}>{renderMedio(pago.medio_pago)}</strong>

                  <div style={styles.metaLine}>
                    Base {formatMoney(base)}
                    {pago.monto_total_cobrado != null && (
                      <>
                        <span style={styles.dot}>•</span>
                        Cobrado {formatMoney(cobrado)}
                      </>
                    )}
                  </div>
                </div>

                <strong style={styles.amount}>
                  {formatMoney(cobrado)}
                </strong>

                <button
                  type="button"
                  onClick={() => quitarPago(pago.temp_id)}
                  style={styles.removePayment}
                >
                  Quitar
                </button>
              </div>
            );
          })}
        </div>
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
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    background: "#ffffff",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  paymentsTitle: {
    fontWeight: 900,
    color: "#111827",
  },

  count: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    background: "#f2f4f7",
    color: "#475467",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 900,
  },

  emptyPayments: {
    color: "#667085",
    fontSize: 13,
    border: "1px dashed #d0d5dd",
    borderRadius: 10,
    padding: 10,
    background: "#f9fafb",
  },

  list: {
    display: "grid",
    gap: 8,
  },

  paymentRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: 10,
    alignItems: "center",
    padding: 10,
    border: "1px solid #f2f4f7",
    borderRadius: 12,
    background: "#f9fafb",
  },

  left: {
    minWidth: 0,
  },

  method: {
    color: "#111827",
  },

  metaLine: {
    color: "#667085",
    fontSize: 12,
    marginTop: 3,
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  dot: {
    color: "#98a2b3",
  },

  amount: {
    fontSize: 16,
    color: "#111827",
    whiteSpace: "nowrap",
  },

  removePayment: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 8,
    padding: "6px 9px",
    fontWeight: 800,
    cursor: "pointer",
  },
};