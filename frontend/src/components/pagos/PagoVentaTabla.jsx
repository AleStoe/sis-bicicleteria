import { formatDateTime, formatMoney } from "../../utils/formatters";

export default function PagoVentaTabla({
  titulo,
  pagos,
  guardando,
  onRevertir,
  vacio,
  soloHistorial = false,
}) {
  return (
    <div style={styles.box}>
      <div style={styles.header}>
        <h3 style={styles.title}>{titulo}</h3>
      </div>

      {pagos.length === 0 ? (
        <div style={styles.empty}>{vacio}</div>
      ) : (
        <div style={styles.list}>
          {pagos.map((pago) => (
            <div key={pago.id} style={styles.item}>
              <div style={styles.left}>
                <div style={styles.topLine}>
                  <strong>#{pago.id}</strong>
                  <span style={styles.dot}>•</span>
                  <span>{formatDateTime(pago.fecha)}</span>
                  <span style={styles.dot}>•</span>
                  <strong>{renderMedio(pago.medio_pago)}</strong>
                </div>

                <div style={styles.metaGrid}>
                  <Meta label="Base" value={formatMoney(pago.monto_base_aplicado)} />

                  <Meta
                    label="Desc."
                    value={`- ${formatMoney(pago.monto_descuento_aplicado)}`}
                    tone="success"
                  />

                  <Meta
                    label="Recargo"
                    value={`+ ${formatMoney(pago.monto_recargo_aplicado)}`}
                    tone="warning"
                  />

                  <Meta label="Estado" value={pago.estado} />
                  <Meta label="Nota" value={pago.nota || "-"} />
                </div>
              </div>

              <div style={styles.right}>
                <div style={styles.amount}>
                  {formatMoney(pago.monto_total_cobrado)}
                </div>

                {!soloHistorial && pago.estado === "confirmado" ? (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => onRevertir(pago)}
                    style={styles.dangerButton}
                  >
                    Revertir
                  </button>
                ) : (
                  <span style={styles.muted}>Sin acciones</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value, tone }) {
  return (
    <div>
      <span style={styles.metaLabel}>{label}</span>

      <strong
        style={{
          ...styles.metaValue,
          color:
            tone === "success"
              ? "#067647"
              : tone === "warning"
                ? "#b54708"
                : "#344054",
        }}
      >
        {value}
      </strong>
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
  box: {
    marginTop: 16,
  },

  header: {
    marginBottom: 8,
  },

  title: {
    margin: 0,
    fontSize: 17,
  },

  empty: {
    border: "1px dashed #d0d5dd",
    borderRadius: 12,
    padding: 14,
    color: "#667085",
    background: "#f9fafb",
  },

  list: {
    display: "grid",
    gap: 10,
  },

  item: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 12,
    background: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
  },

  left: {
    minWidth: 0,
    flex: 1,
  },

  topLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#344054",
    fontSize: 14,
    marginBottom: 10,
    flexWrap: "wrap",
  },

  dot: {
    color: "#98a2b3",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 10,
  },

  metaLabel: {
    display: "block",
    color: "#667085",
    fontSize: 11,
    marginBottom: 2,
  },

  metaValue: {
    fontSize: 13,
  },

  right: {
    textAlign: "right",
    display: "grid",
    gap: 8,
    justifyItems: "end",
  },

  amount: {
    fontSize: 20,
    fontWeight: 950,
    color: "#111827",
  },

  dangerButton: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 8,
    padding: "7px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },

  muted: {
    color: "#667085",
    fontSize: 13,
  },
};