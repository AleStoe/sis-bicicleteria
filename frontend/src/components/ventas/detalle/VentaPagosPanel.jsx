import { useBreakpoint } from "../../ui";

export default function VentaPagosPanel({ pagos = [], formatMoney }) {
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

          return (
            <div key={pago.id} style={styles.paymentCard}>
              <div style={{ ...styles.paymentTop, ...(isMobile ? styles.paymentTopMobile : {}) }}>
                <div>
                  <div style={styles.method}>{renderMedioPago(pago)}</div>
                  <div style={styles.meta}>
                    Estado: <strong>{pago.estado}</strong>
                  </div>
                </div>

                <strong style={{ ...styles.amount, ...(isMobile ? styles.amountMobile : {}) }}>
                  {formatMoney(pago.monto_total_cobrado)}
                </strong>
              </div>

              {esTarjeta && (
                <div style={styles.cardDetail}>
                  <Row label="Plan" value={pago.tarjeta_plan_nombre || "Plan tarjeta"} isMobile={isMobile} />
                  <Row label="Cuotas" value={pago.cuotas || "-"} isMobile={isMobile} />
                  <Row label="Base sin recargo" value={formatMoney(pago.monto_base)} isMobile={isMobile} />
                  <Row
                    label="Recargo financiero"
                    value={`+ ${formatMoney(pago.monto_recargo_financiero)}`}
                    tone="warning"
                    isMobile={isMobile}
                  />
                  <Row
                    label="% aplicado"
                    value={
                      pago.porcentaje_recargo_aplicado != null
                        ? `${Number(pago.porcentaje_recargo_aplicado).toFixed(2)}%`
                        : "-"
                    }
                    isMobile={isMobile}
                  />
                  <Row
                    label="Total cobrado"
                    value={formatMoney(pago.monto_neto_liquidado)}
                    strong
                    isMobile={isMobile}
                  />
                </div>
              )}

              {pago.nota && <div style={styles.note}>Nota: {pago.nota}</div>}
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
          color: tone === "warning" ? "#b54708" : "#111827",
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
    return `Tarjeta${pago.cuotas ? ` · ${pago.cuotas} cuotas` : ""}`;
  }

  if (pago.medio_pago === "efectivo") return "Efectivo";
  if (pago.medio_pago === "transferencia") return "Transferencia";
  if (pago.medio_pago === "mercadopago") return "MercadoPago";

  return pago.medio_pago;
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
};
