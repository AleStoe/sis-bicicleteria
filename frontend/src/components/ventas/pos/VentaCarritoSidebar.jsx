import { useState } from "react";
import { Link } from "react-router-dom";
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
  const [clienteBuscadorActivo, setClienteBuscadorActivo] = useState(false);
  const cantidadItems = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  const clienteSeleccionado = clientes.find(
    (cliente) => Number(cliente.id) === Number(clienteId)
  );
  const clienteEsConsumidorFinal = Number(clienteId) === 1;
  const clienteSeleccionadoTexto = formatearCliente(clienteSeleccionado);
  const mostrarResultadosCliente =
    clienteBuscadorActivo &&
    (buscandoClientes ||
      clientes.length === 0 ||
      clienteQuery.trim() !== clienteSeleccionadoTexto.trim());

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Venta</h2>
          <p style={styles.subtitle}>{cantidadItems || 0} ítem(s) en carrito</p>
        </div>

        <div style={styles.headerActions}>
          <label style={styles.headerCondition}>
            <span>Lista</span>
            <select
              value={tipoPrecio}
              onChange={(event) => onCambiarTipoPrecio(event.target.value)}
              style={styles.headerConditionSelect}
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>

          <button
            type="button"
            onClick={onVaciar}
            disabled={items.length === 0}
            style={items.length === 0 ? styles.clearBtnDisabled : styles.clearBtn}
          >
            Vaciar
          </button>
        </div>
      </div>

      <div style={styles.fieldsGrid}>
        <div style={styles.clientColumn}>
          <label style={styles.fieldLabel}>
            Cliente

            <input
              value={clienteQuery}
              onChange={(e) => {
                setClienteBuscadorActivo(true);
                onClienteQueryChange(e.target.value);
              }}
              onFocus={() => {
                setClienteBuscadorActivo(true);
                if (clienteEsConsumidorFinal) {
                  onClienteQueryChange("");
                }
              }}
              placeholder="Buscar por nombre, DNI o teléfono..."
              {...{ placeholder: "Buscar cliente por nombre/telefono..." }}
              style={styles.clientSearchInput}
            />
          </label>

          {mostrarResultadosCliente && (
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
                    onClick={() => {
                      onCambiarCliente(String(cliente.id));
                      setClienteBuscadorActivo(false);
                    }}
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
          )}

          {clienteSeleccionado && (
            <div
              style={
                clienteEsConsumidorFinal
                  ? styles.selectedClientCardWarning
                  : styles.selectedClientCard
              }
            >
              <div style={styles.selectedClientTop}>
                <strong>{clienteSeleccionado.nombre}</strong>
                {!clienteEsConsumidorFinal && (
                  <Link to={`/clientes/${clienteSeleccionado.id}`} style={styles.clientProfileLink}>
                    Ver perfil
                  </Link>
                )}
              </div>

              <div style={styles.selectedClientMeta}>
                {clienteSeleccionado.dni && <span style={styles.clientMetaStrong}>DNI {clienteSeleccionado.dni}</span>}
                {clienteSeleccionado.telefono && <span style={styles.clientMetaStrong}>Tel {clienteSeleccionado.telefono}</span>}
                <span style={styles.clientMetaSoft}>{tipoPrecio === "mayorista" ? "Mayorista" : "Minorista"}</span>
              </div>

              {clienteEsConsumidorFinal ? (
                <small>Venta sin historial personalizado.</small>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setClienteBuscadorActivo(true);
                    onClienteQueryChange("");
                  }}
                  style={styles.changeClientBtn}
                >
                  Cambiar cliente
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "none" }}>
          <span style={styles.conditionLabel}>Condición</span>
          <strong style={styles.conditionValue}>
            {tipoPrecio === "mayorista" ? "Mayorista" : "Minorista"}
          </strong>
          <span style={styles.conditionBenefit}>Efvo / transf. 10% OFF</span>
          <label style={styles.conditionChange}>
            Cambiar lista
            <select
              value={tipoPrecio}
              onChange={(event) => onCambiarTipoPrecio(event.target.value)}
              style={styles.conditionSelect}
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>
        </div>
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

      <ResumenVentaPanel total={total} mostrarContado />

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
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  headerCondition: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 10,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 950,
  },
  headerConditionSelect: {
    border: 0,
    background: "transparent",
    color: "#0f172a",
    fontWeight: 950,
    outline: "none",
    cursor: "pointer",
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
    gridTemplateColumns: "minmax(0, 1fr)",
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
  saleConditionCard: {
    alignSelf: "start",
    border: "1px solid #fed7aa",
    borderRadius: 14,
    background: "#fff7ed",
    padding: 10,
    display: "grid",
    gap: 5,
    color: "#9a3412",
    minWidth: 0,
  },
  conditionLabel: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  conditionValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1,
  },
  conditionBenefit: {
    borderRadius: 999,
    background: "white",
    color: "#c2410c",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 950,
    justifySelf: "start",
  },
  conditionChange: {
    display: "grid",
    gap: 4,
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    marginTop: 2,
  },
  conditionSelect: {
    width: "100%",
    height: 32,
    border: "1px solid #fdba74",
    borderRadius: 9,
    padding: "0 8px",
    background: "white",
    fontWeight: 850,
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
  selectedClientCard: {
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    background: "#eff6ff",
    padding: 10,
    display: "grid",
    gap: 7,
  },
  selectedClientCardWarning: {
    border: "1px solid #fed7aa",
    borderRadius: 12,
    background: "#fff7ed",
    color: "#9a3412",
    padding: 10,
    display: "grid",
    gap: 7,
  },
  selectedClientTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 8,
    color: "#0f172a",
    fontSize: 13,
  },
  selectedClientMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 11,
    fontWeight: 850,
  },
  clientMetaStrong: {
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1e3a8a",
    padding: "3px 7px",
    fontWeight: 950,
  },
  clientMetaSoft: {
    borderRadius: 999,
    background: "rgba(255,255,255,0.7)",
    color: "#475569",
    padding: "3px 7px",
    fontWeight: 850,
  },
  clientProfileLink: {
    color: "#0b5bd3",
    textDecoration: "none",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  changeClientBtn: {
    justifySelf: "start",
    border: 0,
    background: "transparent",
    color: "#0b5bd3",
    padding: 0,
    fontSize: 11,
    fontWeight: 950,
    cursor: "pointer",
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
