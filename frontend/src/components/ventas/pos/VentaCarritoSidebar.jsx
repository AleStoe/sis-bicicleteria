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

function formatearCliente(cliente) {
  if (!cliente) return "";

  const partes = [cliente.nombre];

  if (cliente.dni) partes.push(`DNI ${cliente.dni}`);
  if (cliente.telefono) partes.push(cliente.telefono);

  return partes.filter(Boolean).join(" · ");
}

export default function VentaCarritoSidebar({
  clientes,
  clienteId,
  clienteQuery,
  buscandoClientes,
  tipoPrecio,
  items,
  total,
  observaciones,
  usarCredito,
  serializadasPorVariante,
  cargandoSerializadas,
  onCambiarCliente,
  onClienteQueryChange,
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

  const clienteSeleccionado = clientes.find(
    (cliente) => Number(cliente.id) === Number(clienteId)
  );
  const clienteEsConsumidorFinal = Number(clienteId) === 1;

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
        <div style={styles.clientColumn}>
          <label style={styles.fieldLabel}>
            Cliente

            <input
              value={clienteQuery}
              onChange={(e) => onClienteQueryChange(e.target.value)}
              onFocus={() => {
                if (clienteEsConsumidorFinal) {
                  onClienteQueryChange("");
                }
              }}
              placeholder="Buscar por nombre, DNI o teléfono..."
              {...{ placeholder: "Buscar cliente por nombre/telefono..." }}
              style={styles.clientSearchInput}
            />
          </label>

          <div style={styles.clientResults}>
            {buscandoClientes && (
              <div style={styles.clientResultMuted}>Buscando clientes...</div>
            )}

            {!buscandoClientes && clientes.length === 0 && (
              <div style={styles.clientResultMuted}>Sin resultados</div>
            )}

            {!buscandoClientes &&
              clientes.slice(0, 5).map((cliente) => {
                const activo = Number(cliente.id) === Number(clienteId);

                return (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => onCambiarCliente(String(cliente.id))}
                    style={
                      activo ? styles.clientResultActive : styles.clientResult
                    }
                  >
                    <span style={styles.clientResultName}>
                      {cliente.nombre}
                    </span>

                    <span style={styles.clientResultMeta}>
                      #{cliente.id}
                      {cliente.dni ? ` · DNI ${cliente.dni}` : ""}
                      {cliente.telefono ? ` · ${cliente.telefono}` : ""}
                    </span>
                  </button>
                );
              })}
          </div>

          {clienteSeleccionado && (
            <span style={styles.selectedClientHint}>
              Seleccionado: {formatearCliente(clienteSeleccionado)}
            </span>
          )}
        </div>

        <label style={styles.priceColumn}>
          <span style={styles.priceLabel}>Precio</span>

          <select
            value={tipoPrecio}
            onChange={(event) => onCambiarTipoPrecio(event.target.value)}
            style={styles.priceSelect}
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
        Usar saldo a favor
      </label>

      {usarCredito && (
        <div style={styles.creditHint}>
          Se aplicará automáticamente al cobrar si el cliente tiene saldo disponible.
        </div>
      )}

      <div style={styles.totalCard}>
        <div>
          <span style={styles.totalLabel}>Total a cobrar</span>
          <strong style={styles.totalValue}>{formatMoney(total)}</strong>
        </div>

        <button
          type="button"
          onClick={onIrACobrar}
          disabled={items.length === 0}
          style={items.length === 0 ? styles.payBtnDisabled : styles.payBtn}
        >
          IR A COBRAR · F4 →
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
    gridTemplateColumns: "minmax(0, 1fr) 195px",
    gap: 12,
    alignItems: "start",
  },
  clientColumn: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  fieldLabel: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },
  priceColumn: {
    display: "grid",
    gap: 6,
    alignSelf: "start",
    minWidth: 0,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },
  priceSelect: {
    width: "100%",
    height: 44,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "0 12px",
    background: "white",
    fontWeight: 800,
    color: "#0f172a",
    cursor: "pointer",
  },
  clientSearchInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 10px",
    background: "white",
    fontWeight: 800,
    color: "#0f172a",
    minWidth: 0,
  },
  clientResults: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#f8fafc",
    padding: 5,
    display: "grid",
    gap: 4,
    maxHeight: 178,
    overflowY: "auto",
  },
  clientResult: {
    width: "100%",
    border: "1px solid transparent",
    borderRadius: 9,
    background: "white",
    color: "#0f172a",
    padding: "8px 9px",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 2,
  },
  clientResultActive: {
    width: "100%",
    border: "1px solid #93c5fd",
    borderRadius: 9,
    background: "#eff6ff",
    color: "#0f172a",
    padding: "8px 9px",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 2,
  },
  clientResultName: {
    fontWeight: 950,
    fontSize: 13,
  },
  clientResultMeta: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11,
  },
  clientResultMuted: {
    padding: "8px 9px",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 12,
  },
  selectedClientHint: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11,
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
  creditHint: {
    marginTop: -6,
    marginBottom: 12,
    padding: "8px 10px",
    borderRadius: 10,
    background: "#ecfdf3",
    color: "#067647",
    border: "1px solid #abefc6",
    fontSize: 12,
    fontWeight: 700,
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
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-0.04em",
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
