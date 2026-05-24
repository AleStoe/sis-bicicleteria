import { formatMoney } from "../../../utils/formatters";
import {
  describirPago,
  getAjustePago,
  getNumeroCuadroItem,
  getPagoAccent,
  itemRequiereCuadro,
} from "../../../helpers/checkoutVentaHelper";

export default function CheckoutResumenLateral({
  draft,
  clienteNombre,
  resumen,
  onQuitarPago,
}) {
  const {
    pagosPanel,
    baseCubierta,
    clientePagoTotal,
    saldoBasePendiente,
    ventaSaldada,
  } = resumen;

  return (
    <aside style={styles.summaryPanel}>
      <span style={styles.panelLabelDark}>Resumen</span>
      <h2 style={styles.summaryClient}>{clienteNombre}</h2>

      <div style={styles.summaryBox}>
        <span>Precio de venta</span>
        <strong>{formatMoney(draft.total, { cents: true })}</strong>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricBox}>
          <span>Venta cubierta</span>
          <strong>{formatMoney(baseCubierta, { cents: true })}</strong>
        </div>

        <div style={styles.metricBox}>
          <span>Cobrado al cliente</span>
          <strong>{formatMoney(clientePagoTotal, { cents: true })}</strong>
        </div>
      </div>

      <div style={ventaSaldada ? styles.statusBoxOk : styles.statusBox}>
        <span>{ventaSaldada ? "Estado" : "Falta cubrir"}</span>
        <strong>
          {ventaSaldada ? "Venta saldada" : formatMoney(saldoBasePendiente, { cents: true })}
        </strong>
        <small>
          {ventaSaldada
            ? "La venta ya está cubierta."
            : "Elegí el medio de pago para saber cuánto cobra el cliente."}
        </small>
      </div>

      <PagosCargados pagosPanel={pagosPanel} onQuitarPago={onQuitarPago} />
      <ItemsVenta items={draft.items || []} />
    </aside>
  );
}

function PagosCargados({ pagosPanel, onQuitarPago }) {
  return (
    <div style={styles.paymentsBox}>
      <div style={styles.boxHeader}>
        <strong>Pagos agregados</strong>
        <span>{pagosPanel.length}</span>
      </div>

      {pagosPanel.length ? (
        <div style={styles.paymentsList}>
          {pagosPanel.map((pago) => {
            const ajuste = getAjustePago(pago);

            return (
              <div
                key={pago.temp_id}
                style={{
                  ...styles.paymentRow,
                  borderLeft: `5px solid ${getPagoAccent(pago)}`,
                }}
              >
                <div style={styles.paymentTitleRow}>
                  <strong>{describirPago(pago)}</strong>

                  <div style={styles.paymentAmountActions}>
                    <span>
                      {formatMoney(pago.monto_total_cobrado ?? pago.monto_base, { cents: true })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuitarPago?.(pago.temp_id)}
                      style={styles.removePaymentButton}
                      title="Quitar este pago"
                      aria-label="Quitar este pago"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div style={styles.paymentDetails}>
                  <span>Cubre venta</span>
                  <strong>{formatMoney(pago.monto_base, { cents: true })}</strong>

                  <span>Cobrado al cliente</span>
                  <strong>
                    {formatMoney(pago.monto_total_cobrado ?? pago.monto_base, { cents: true })}
                  </strong>
                </div>

                {ajuste && (
                  <div
                    style={
                      ajuste.tone === "warning"
                        ? styles.adjustmentWarning
                        : styles.adjustmentSuccess
                    }
                  >
                    <span>{ajuste.label}</span>
                    <strong>{formatMoney(ajuste.value, { cents: true })}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={styles.emptyPayments}>Todavía no agregaste pagos.</p>
      )}
    </div>
  );
}

function ItemsVenta({ items }) {
  return (
    <div style={styles.itemsBox}>
      <strong>Items</strong>
      {items.slice(0, 6).map((item) => {
        const numeroCuadro = getNumeroCuadroItem(item);
        const requiereCuadro = itemRequiereCuadro(item);

        return (
          <div key={item.line_id || item.id_variante} style={styles.itemCard}>
            <div style={styles.itemRow}>
              <span>{item.descripcion || item.nombre || "Producto"}</span>
              <strong>x{item.cantidad}</strong>
            </div>

            {numeroCuadro ? (
              <div style={styles.numeroCuadroOk}>
                <span>Cuadro</span>
                <strong>{numeroCuadro}</strong>
              </div>
            ) : requiereCuadro ? (
              <div style={styles.numeroCuadroWarning}>⚠ Sin número de cuadro asignado</div>
            ) : null}
          </div>
        );
      })}

      {items.length > 6 && (
        <p style={styles.moreItems}>+{items.length - 6} ítem(s) más en la venta</p>
      )}
    </div>
  );
}

const styles = {
  summaryPanel: {
    background: "#0f172a",
    color: "white",
    borderRadius: 22,
    padding: 18,
    position: "sticky",
    top: 20,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
  },
  panelLabelDark: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  summaryClient: {
    margin: "8px 0 16px",
    fontSize: 22,
  },
  summaryBox: {
    background: "#1e293b",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
  },
  metricsGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  metricBox: {
    background: "#111827",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 4,
  },
  statusBox: {
    marginTop: 12,
    background: "#172554",
    border: "1px solid rgba(96, 165, 250, 0.35)",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
  },
  statusBoxOk: {
    marginTop: 12,
    background: "rgba(22, 101, 52, 0.72)",
    border: "1px solid rgba(134, 239, 172, 0.35)",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
  },
  paymentsBox: {
    marginTop: 14,
    background: "#1e293b",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  paymentsList: {
    display: "grid",
    gap: 10,
  },
  boxHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentRow: {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 9,
    minWidth: 0,
    overflow: "hidden",
  },
  paymentTitleRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },
  paymentAmountActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  },
  removePaymentButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    border: "1px solid rgba(248, 113, 113, 0.45)",
    background: "rgba(248, 113, 113, 0.14)",
    color: "#fecaca",
    fontWeight: 1000,
    cursor: "pointer",
    lineHeight: 1,
  },
  paymentDetails: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "4px 10px",
    color: "#cbd5e1",
    fontSize: 12,
  },
  adjustmentWarning: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    padding: "7px 9px",
    background: "rgba(245, 158, 11, 0.12)",
    color: "#fbbf24",
    fontWeight: 900,
    fontSize: 12,
  },
  adjustmentSuccess: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    padding: "7px 9px",
    background: "rgba(34, 197, 94, 0.12)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 12,
  },
  emptyPayments: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  itemsBox: {
    marginTop: 14,
    background: "#1e293b",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  itemCard: {
    borderRadius: 14,
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    padding: 10,
    display: "grid",
    gap: 8,
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 12,
  },
  numeroCuadroOk: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 10,
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(134, 239, 172, 0.22)",
    color: "#86efac",
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  numeroCuadroWarning: {
    borderRadius: 10,
    background: "rgba(245, 158, 11, 0.14)",
    border: "1px solid rgba(251, 191, 36, 0.25)",
    color: "#fbbf24",
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  moreItems: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
  },
};
