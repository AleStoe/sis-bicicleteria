import { OperationalStatusBadge, useBreakpoint } from "../../ui";

export default function VentaPagosPanel({
  pagos = [],
  formatMoney,
  procesando = false,
  canRevertirPago = () => false,
  onRevertirPago,
}) {
  const { isMobile } = useBreakpoint();

  if (!pagos.length) return null;

  return (
    <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
      <div style={styles.header}>
        <h3 style={styles.title}>Pagos registrados</h3>
        <span style={styles.count}>{pagos.length}</span>
      </div>

      <div style={styles.list}>
        {pagos.map((pago) => {
          const esTarjeta = pago.medio_pago === "tarjeta";
          const detalleFinanciero = getDetalleFinanciero(pago);
          const tieneAjuste =
            detalleFinanciero.descuento > 0 || detalleFinanciero.recargo > 0;

          return (
            <div key={pago.id} style={styles.paymentCard}>
              <div style={{ ...styles.paymentTop, ...(isMobile ? styles.paymentTopMobile : {}) }}>
                <div>
                  <div style={styles.method}>{renderMedioPago(pago)}</div>
                  <div style={styles.meta}>
                    <OperationalStatusBadge domain="pago" status={pago.estado} />
                  </div>
                </div>

                <strong style={{ ...styles.amount, ...(isMobile ? styles.amountMobile : {}) }}>
                  {formatMoney(pago.monto_total_cobrado)}
                </strong>
              </div>

              {(tieneAjuste || esTarjeta) && (
                <div style={styles.cardDetail}>
                  {esTarjeta && (
                    <>
                      <Row label="Plan" value={pago.tarjeta_plan_nombre || "Plan tarjeta"} isMobile={isMobile} />
                      <Row label="Cuotas" value={pago.cuotas || "-"} isMobile={isMobile} />
                    </>
                  )}

                  <Row label="Cubre de la venta" value={formatMoney(detalleFinanciero.base)} isMobile={isMobile} />

                  {detalleFinanciero.descuento > 0 && (
                    <Row
                      label="Descuento aplicado"
                      value={`- ${formatMoney(detalleFinanciero.descuento)}`}
                      tone="success"
                      isMobile={isMobile}
                    />
                  )}

                  {detalleFinanciero.recargo > 0 && (
                    <Row
                      label="Financiacion incluida"
                      value={`+ ${formatMoney(detalleFinanciero.recargo)}`}
                      tone="warning"
                      isMobile={isMobile}
                    />
                  )}

                  <Row
                    label="Total cobrado"
                    value={formatMoney(detalleFinanciero.total)}
                    strong
                    isMobile={isMobile}
                  />
                </div>
              )}

              {pago.nota && <div style={styles.note}>Nota: {pago.nota}</div>}

              {canRevertirPago(pago) && (
                <div style={styles.actionsRow}>
                  <button
                    type="button"
                    disabled={procesando}
                    onClick={() => onRevertirPago?.(pago)}
                    style={styles.dangerButton}
                  >
                    Revertir pago
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({ label, value, tone, strong = false, isMobile = false }) {
  return (
    <div style={{ ...styles.row, ...(isMobile ? styles.rowMobile : {}) }}>
      <span>{label}</span>
      <strong
        style={{
          color:
            tone === "warning"
              ? "#b54708"
              : tone === "success"
                ? "#047857"
                : "#111827",
          fontSize: strong ? 15 : 13,
          textAlign: isMobile ? "left" : "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function renderMedioPago(pago) {
  if (pago.medio_pago === "tarjeta") {
    return `Tarjeta${pago.cuotas ? ` - ${pago.cuotas} cuotas` : ""}`;
  }

  if (pago.medio_pago === "efectivo") return "Efectivo";
  if (pago.medio_pago === "transferencia") return "Transferencia";
  if (pago.medio_pago === "mercadopago") return "MercadoPago";

  return pago.medio_pago;
}

function getDetalleFinanciero(pago) {
  const total = Number(pago.monto_total_cobrado ?? 0);
  const base = Number(
    pago.monto_base_aplicado ??
      pago.monto_base ??
      pago.monto_neto_liquidado ??
      total
  );
  const descuento = Number(pago.monto_descuento_aplicado ?? 0);
  const recargo = Number(
    pago.monto_recargo_aplicado ??
      pago.monto_recargo_financiero ??
      0
  );

  return {
    base: Number.isFinite(base) ? base : total,
    descuento: Number.isFinite(descuento) ? descuento : 0,
    recargo: Number.isFinite(recargo) ? recargo : 0,
    total: Number.isFinite(total) ? total : 0,
  };
}

const styles = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    background: "white",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  cardMobile: {
    padding: 12,
    borderRadius: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "#111827",
  },
  count: {
    background: "#f2f4f7",
    color: "#344054",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 800,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  paymentCard: {
    border: "1px solid #f2f4f7",
    borderRadius: 12,
    padding: 12,
    background: "#f9fafb",
    display: "grid",
    gap: 10,
    minWidth: 0,
  },
  paymentTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  paymentTopMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
  },
  method: {
    fontWeight: 900,
    color: "#344054",
  },
  meta: {
    marginTop: 3,
    color: "#667085",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  amount: {
    color: "#111827",
    fontSize: 17,
    whiteSpace: "nowrap",
  },
  amountMobile: {
    whiteSpace: "normal",
    fontSize: 18,
  },
  cardDetail: {
    borderTop: "1px solid #eaecf0",
    paddingTop: 10,
    display: "grid",
    gap: 7,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    color: "#667085",
  },
  rowMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 2,
  },
  note: {
    fontSize: 12,
    color: "#667085",
  },
  actionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
