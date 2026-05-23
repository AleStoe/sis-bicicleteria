import { calcularCantidadItems } from "../../../helpers/checkoutVentaHelper";
import { formatMoney } from "../../../utils/formatters";

export default function CheckoutClienteVentaCard({ draft, clienteNombre }) {
  const cantidadItems = calcularCantidadItems(draft?.items || []);

  return (
    <div style={styles.clientPanel}>
      <div style={styles.avatar}>👤</div>
      <div>
        <span style={styles.panelLabel}>Cliente de la venta</span>
        <h2 style={styles.clientName}>{clienteNombre}</h2>
        <p style={styles.clientMeta}>
          {draft.tipoPrecio} · {cantidadItems} ítem(s) · precio lista {formatMoney(draft.total, { cents: true })}
        </p>
      </div>
    </div>
  );
}

const styles = {
  clientPanel: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    background: "#f97316",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    flex: "0 0 auto",
  },
  panelLabel: {
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  clientName: {
    margin: "3px 0",
    color: "#0f172a",
    fontSize: 24,
  },
  clientMeta: {
    margin: 0,
    color: "#64748b",
    fontWeight: 700,
  },
};
