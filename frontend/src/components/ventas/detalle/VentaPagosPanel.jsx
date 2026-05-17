export default function VentaPagosPanel({ pagos = [], formatMoney }) {
  if (!pagos.length) return null;

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>Pagos registrados</h3>
        <span style={styles.count}>{pagos.length}</span>
      </div>

      <div style={styles.list}>
        {pagos.map((pago) => {
          const esTarjeta = pago.medio_pago === "tarjeta";

          return (
            <div key={pago.id} style={styles.paymentCard}>
              <div style={styles.paymentTop}>
                <div>
                  <div style={styles.method}>{renderMedioPago(pago)}</div>
                  <div style={styles.meta}>
                    Estado: <strong>{pago.estado}</strong>
                  </div>
                </div>

                <strong style={styles.amount}>
                  {formatMoney(pago.monto_total_cobrado)}
                </strong>
              </div>

              {esTarjeta && (
                <div style={styles.cardDetail}>
                  <Row
                    label="Plan"
                    value={pago.tarjeta_plan_nombre || "Plan tarjeta"}
                  />
                  <Row label="Cuotas" value={pago.cuotas || "-"} />
                  <Row
                    label="Base sin recargo"
                    value={formatMoney(pago.monto_base)}
                  />
                  <Row
                    label="Recargo financiero"
                    value={`+ ${formatMoney(pago.monto_recargo_financiero)}`}
                    tone="warning"
                  />
                  <Row
                    label="% aplicado"
                    value={
                      pago.porcentaje_recargo_aplicado != null
                        ? `${Number(pago.porcentaje_recargo_aplicado).toFixed(2)}%`
                        : "-"
                    }
                  />
                  <Row
                    label="Total cobrado"
                    value={formatMoney(pago.monto_neto_liquidado)}
                    strong
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

function Row({ label, value, tone, strong = false }) {
  return (
    <div style={styles.row}>
      <span>{label}</span>
      <strong
        style={{
          color: tone === "warning" ? "#b54708" : "#111827",
          fontSize: strong ? 15 : 13,
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
  },
  paymentTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
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
  note: {
    fontSize: 12,
    color: "#667085",
  },
};