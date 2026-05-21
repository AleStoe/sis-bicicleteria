import CarritoVentaPanel from "../CarritoVentaPanel";
import ResumenVentaPanel from "../ResumenVentaPanel";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function VentaCarritoSidebar({
  clientes,
  clienteId,
  tipoPrecio,
  items,
  total,
  observaciones,
  usarCredito,
  serializadasPorVariante,
  cargandoSerializadas,
  onCambiarCliente,
  onCambiarTipoPrecio,
  onCargarSerializadas,
  onSeleccionarSerializada,
  onCambiarCantidad,
  onQuitarItem,
  onActualizarItem,
  onObservacionesChange,
  onUsarCreditoChange,
  onVaciar,
  onIrACobrar,
}) {
  const cantidadItems = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Venta</h2>
          <p style={styles.subtitle}>{cantidadItems || 0} ítem(s) en carrito</p>
        </div>

        <button
          type="button"
          onClick={onVaciar}
          disabled={items.length === 0}
          style={items.length === 0 ? styles.clearBtnDisabled : styles.clearBtn}
        >
          Vaciar
        </button>
      </div>

      <div style={styles.fieldsGrid}>
        <label style={styles.fieldLabel}>
          Cliente
          <select
            value={clienteId}
            onChange={(e) => onCambiarCliente(e.target.value)}
            style={styles.select}
          >
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre} #{cliente.id}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.fieldLabel}>
          Precio
          <select
            value={tipoPrecio}
            onChange={(e) => onCambiarTipoPrecio(e.target.value)}
            style={styles.select}
          >
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
          </select>
        </label>
      </div>

      <CarritoVentaPanel
        items={items}
        serializadasPorVariante={serializadasPorVariante}
        cargandoSerializadas={cargandoSerializadas}
        onCargarSerializadas={onCargarSerializadas}
        onSeleccionarSerializada={onSeleccionarSerializada}
        onCambiarCantidad={onCambiarCantidad}
        onQuitarItem={onQuitarItem}
        onActualizarItem={onActualizarItem}
      />

      <ResumenVentaPanel total={total} />

      <label style={styles.fieldBlock}>
        <span>Observaciones</span>
        <textarea
          value={observaciones}
          onChange={(e) => onObservacionesChange(e.target.value)}
          placeholder="Opcional"
          style={styles.textarea}
        />
      </label>

      <label style={styles.checkRow}>
        <input
          type="checkbox"
          checked={usarCredito}
          onChange={(e) => onUsarCreditoChange(e.target.checked)}
        />
        Aplicar crédito disponible si existe
      </label>

      <div style={styles.totalCard}>
        <div>
          <span style={styles.totalLabel}>Precio lista</span>
          <strong style={styles.totalValue}>{formatMoney(total)}</strong>
        </div>

        <button
          type="button"
          onClick={onIrACobrar}
          disabled={items.length === 0}
          style={items.length === 0 ? styles.payBtnDisabled : styles.payBtn}
        >
          IR A COBRAR →
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "grid",
    gap: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  clearBtn: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  clearBtnDisabled: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "not-allowed",
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  fieldLabel: {
    display: "grid",
    gap: 5,
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 10px",
    background: "white",
    fontWeight: 800,
    color: "#0f172a",
    minWidth: 0,
  },
  fieldBlock: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },
  textarea: {
    width: "100%",
    minHeight: 54,
    resize: "vertical",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontFamily: "inherit",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#334155",
    fontWeight: 800,
    fontSize: 13,
  },
  totalCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#0f172a",
    color: "white",
    padding: 16,
    display: "grid",
    gap: 14,
    boxShadow: "0 14px 28px rgba(15, 23, 42, 0.18)",
  },
  totalLabel: {
    display: "block",
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  totalValue: {
    display: "block",
    marginTop: 4,
    fontSize: 30,
    lineHeight: 1,
  },
  payBtn: {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: "16px 18px",
    background: "#f97316",
    color: "white",
    fontWeight: 1000,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(249, 115, 22, 0.35)",
  },
  payBtnDisabled: {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: "16px 18px",
    background: "#cbd5e1",
    color: "#64748b",
    fontWeight: 1000,
    fontSize: 16,
    cursor: "not-allowed",
  },
};
