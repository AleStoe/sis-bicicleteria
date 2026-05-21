import { formatMoney } from "../../../utils/formatters";

export default function CheckoutPagosList({ pagosDraft, quitarPago }) {
  return (
    <div style={styles.paymentsList}>
      <div style={styles.header}>
        <div style={styles.paymentsTitle}>Pagos cargados</div>
        <div style={styles.count}>{pagosDraft.length}</div>
      </div>

      {pagosDraft.length === 0 ? (
        <div style={styles.emptyPayments}>Todavía no cargaste pagos.</div>
      ) : (
        <div style={styles.list}>
          {pagosDraft.map((pago) => {
            const base = pago.monto_base ?? pago.monto;
            const cobrado = pago.monto_total_cobrado ?? pago.monto;

            return (
              <div key={pago.temp_id} style={styles.paymentRow}>
                <div style={styles.statusIcon}>✓</div>

                <div style={styles.left}>
                  <strong style={styles.method}>{renderMedio(pago)}</strong>
                  <div style={styles.metaLine}>Base {formatMoney(base)}</div>
                </div>

                <strong style={styles.amount}>{formatMoney(cobrado)}</strong>

                <button type="button" onClick={() => quitarPago(pago.temp_id)} style={styles.removePayment}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderMedio(pago) {
  const map = {
    efectivo: "💵 Efectivo",
    transferencia: "🏦 Transferencia",
    mercadopago: "📲 MercadoPago",
    tarjeta: pago.cuotas ? `💳 Tarjeta · ${pago.cuotas} cuota(s)` : "💳 Tarjeta",
  };

  return map[pago.medio_pago] || pago.medio_pago;
}

const styles = {
  paymentsList: {
    border: "1px solid #eaecf0",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    background: "#ffffff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  paymentsTitle: {
    fontWeight: 950,
    color: "#111827",
    fontSize: 16,
  },
  count: {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    background: "#eff6ff",
    color: "#0b5bd3",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 950,
  },
  emptyPayments: {
    color: "#667085",
    fontSize: 13,
    border: "1px dashed #d0d5dd",
    borderRadius: 14,
    padding: 13,
    background: "#f9fafb",
    textAlign: "center",
    fontWeight: 750,
  },
  list: {
    display: "grid",
    gap: 8,
  },
  paymentRow: {
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr) auto 32px",
    gap: 10,
    alignItems: "center",
    padding: 10,
    border: "1px solid #eaecf0",
    borderRadius: 14,
    background: "#f9fafb",
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#12a15f",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
  },
  left: { minWidth: 0 },
  method: {
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
  },
  metaLine: {
    color: "#667085",
    fontSize: 12,
    marginTop: 3,
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
    borderRadius: 10,
    width: 32,
    height: 32,
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
  },
};
