export default function VentaItemPrecioPanel({
  precioManual,
  setPrecioManual,
  motivoPrecio,
  setMotivoPrecio,
  aplicarPrecioManual,
  limpiarPrecioManual,
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Precio manual</div>

      <div style={styles.inlineForm}>
        <input
          type="number"
          value={precioManual}
          onChange={(e) => setPrecioManual(e.target.value)}
          placeholder="Precio manual"
          style={styles.input}
        />

        <input
          value={motivoPrecio}
          onChange={(e) => setMotivoPrecio(e.target.value)}
          placeholder="Motivo obligatorio"
          style={styles.inputGrow}
        />

        <button
          type="button"
          onClick={aplicarPrecioManual}
          style={styles.applyBtn}
        >
          Aplicar
        </button>

        <button
          type="button"
          onClick={limpiarPrecioManual}
          style={styles.ghostBtn}
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    border: "1px solid #eaecf0",
    background: "#f9fafb",
    borderRadius: 10,
    padding: 10,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "#344054",
    marginBottom: 7,
  },
  inlineForm: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    width: 130,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
  },
  inputGrow: {
    flex: 1,
    minWidth: 160,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
  },
  applyBtn: {
    border: "none",
    borderRadius: 8,
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    padding: "7px 10px",
    cursor: "pointer",
  },
  ghostBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "white",
    color: "#344054",
    fontWeight: 800,
    padding: "7px 10px",
    cursor: "pointer",
  },
};