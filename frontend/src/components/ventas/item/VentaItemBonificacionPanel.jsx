export default function VentaItemBonificacionPanel({
  motivoBonificacion,
  setMotivoBonificacion,
  aplicarBonificacion,
  limpiarBonificacion,
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Bonificación</div>

      <div style={styles.inlineForm}>
        <input
          value={motivoBonificacion}
          onChange={(e) => setMotivoBonificacion(e.target.value)}
          placeholder="Motivo obligatorio"
          style={styles.inputGrow}
        />

        <button
          type="button"
          onClick={aplicarBonificacion}
          style={styles.dangerBtn}
        >
          Bonificar
        </button>

        <button
          type="button"
          onClick={limpiarBonificacion}
          style={styles.ghostBtn}
        >
          Quitar
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
  inputGrow: {
    flex: 1,
    minWidth: 180,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
  },
  dangerBtn: {
    border: "none",
    borderRadius: 8,
    background: "#dc2626",
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