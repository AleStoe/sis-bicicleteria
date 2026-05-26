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
    basePagosCubierta,
    creditoAplicado,
    baseCubierta,
    clientePagoTotal,
    saldoBasePendiente,
    ventaSaldada,
  } = resumen;

  return (
    <aside style={styles.summaryPanel}>
      <span style={styles.panelLabelDark}>Control de venta</span>
      <h2 style={styles.summaryClient}>{clienteNombre}</h2>

      <div style={styles.mainTotalBox}>
        <span>Total venta</span>
        <strong>{formatMoney(draft.total, { cents: true })}</strong>
      </div>

      <div style={ventaSaldada ? styles.statusBoxOk : styles.statusBox}>
        <span>{ventaSaldada ? "Estado" : "Falta cobrar"}</span>
        <strong>
          {ventaSaldada
            ? "Venta cubierta"
            : formatMoney(saldoBasePendiente, { cents: true })}
        </strong>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricBox}>
          <span>Cubierto total</span>
          <strong>{formatMoney(baseCubierta, { cents: true })}</strong>
        </div>
        {creditoAplicado > 0 && (
          <div style={styles.creditMiniBox}>
            <span>Crédito aplicado</span>
            <strong>- {formatMoney(creditoAplicado, { cents: true })}</strong>
          </div>
        )}
        <div style={styles.metricBox}>
          <span>Cobrado</span>
          <strong>{formatMoney(clientePagoTotal, { cents: true })}</strong>
        </div>
      </div>

      <ItemsVenta items={draft.items || []} />

      <PagosCargados pagosPanel={pagosPanel} onQuitarPago={onQuitarPago} />
    </aside>
  );
}

function PagosCargados({ pagosPanel, onQuitarPago }) {
  return (
    <section style={styles.sectionBox}>
      <div style={styles.boxHeader}>
        <strong>Pagos</strong>
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
                      {formatMoney(pago.monto_total_cobrado ?? pago.monto_base, {
                        cents: true,
                      })}
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

                  <span>Cobrado</span>
                  <strong>
                    {formatMoney(pago.monto_total_cobrado ?? pago.monto_base, {
                      cents: true,
                    })}
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
        <p style={styles.emptyText}>Todavía no agregaste pagos.</p>
      )}
    </section>
  );
}

function ItemsVenta({ items }) {
  return (
    <section style={styles.sectionBox}>
      <div style={styles.boxHeader}>
        <strong>Items</strong>
        <span>{items.length}</span>
      </div>

      {items.slice(0, 6).map((item) => {
        const numeroCuadro = getNumeroCuadroItem(item);
        const requiereCuadro = itemRequiereCuadro(item);
        const esBiciEnCaja = item.serializable && !numeroCuadro && !requiereCuadro;

        return (
          <div key={item.line_id || item.id_variante} style={styles.itemCard}>
            <div style={styles.itemRow}>
              <span>{item.descripcion || item.nombre || "Producto"}</span>
              <strong>x{item.cantidad}</strong>
            </div>

            {numeroCuadro ? (
              <div style={styles.numeroCuadroOk}>
                <span>N° DE CUADRO</span>
                <strong>{numeroCuadro}</strong>
              </div>
            ) : requiereCuadro ? (
              <div style={styles.numeroCuadroWarning}>
                ⚠ Falta número de cuadro
              </div>
            ) : esBiciEnCaja ? (
              <div style={styles.enCajaBadge}>📦 EN CAJA</div>
            ) : null}
          </div>
        );
      })}

      {items.length > 6 && (
        <p style={styles.moreItems}>+{items.length - 6} ítem(s) más</p>
      )}
    </section>
  );
}

const styles = {
  summaryPanel: {
    background: "white",
    color: "#0f172a",
    borderRadius: 16,
    padding: 16,
    position: "sticky",
    top: 20,
    border: "1px solid #e2e8f0",
  },
  panelLabelDark: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  summaryClient: {
    color: "#0f172a",
    margin: "6px 0 12px",
    fontSize: 22,
    lineHeight: 1.1,
  },
  mainTotalBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 4,
  },
  statusBox: {
    marginTop: 10,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 4,
    color: "#9a3412",
  },
  statusBoxOk: {
    marginTop: 10,
    background: "#ecfdf5",
    border: "1px solid #86efac",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 4,
    color: "#166534",
  },
  metricsGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  metricBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
    display: "grid",
    gap: 3,
    fontSize: 12,
  },
  sectionBox: {
    marginTop: 12,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: 12,
    display: "grid",
    gap: 9,
  },
  boxHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentsList: {
    display: "grid",
    gap: 9,
  },
  paymentRow: {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: 10,
    display: "grid",
    gap: 8,
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
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    padding: "7px 9px",
    background: "rgba(34, 197, 94, 0.12)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 12,
  },
  emptyText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  itemCard: {
    borderRadius: 10,
    background: "white",
    border: "1px solid #e2e8f0",
    padding: 10,
    display: "grid",
    gap: 8,
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    color: "#334155",
    fontSize: 12,
  },
  numeroCuadroOk: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 10,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 1000,
  },
  numeroCuadroWarning: {
    borderRadius: 10,
    background: "rgba(245, 158, 11, 0.14)",
    border: "1px solid rgba(251, 191, 36, 0.25)",
    color: "#fbbf24",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 1000,
  },
  enCajaBadge: {
    borderRadius: 10,
    background: "rgba(249, 115, 22, 0.15)",
    border: "1px solid rgba(251, 146, 60, 0.35)",
    color: "#fed7aa",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 1000,
    textAlign: "center",
  },
  moreItems: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
  },
  creditMiniBox: {
  marginTop: 8,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: 10,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
},
};