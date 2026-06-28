export default function VentaItemBonificacionPanel({
  motivoBonificacion,
  setMotivoBonificacion,
  aplicarBonificacion,
  limpiarBonificacion,
}) {
  const motivosRapidos = [
    "Garantía",
    "Cortesía",
    "Reposición",
    "Error en mercadería",
    "Atención comercial",
    "Promoción",
    "Diferencia de precio",
    "Otro",
  ];

  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Bonificar ítem</div>
      <div style={styles.panelHelp}>
        Usá esto cuando el producto queda bonificado en $0. No lo uses para descuentos por forma de pago.
      </div>

      <div style={styles.inlineForm}>
        <input
          value={motivoBonificacion}
          onChange={(e) => setMotivoBonificacion(e.target.value)}
          placeholder="Motivo obligatorio"
          style={styles.inputGrow}
        />

        <div style={styles.quickReasons}>
          {motivosRapidos.map((motivo) => (
            <button
              key={motivo}
              type="button"
              onClick={() => setMotivoBonificacion(motivo)}
              style={motivoBonificacion === motivo ? styles.reasonActive : styles.reason}
            >
              {motivo}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={aplicarBonificacion}
          style={styles.dangerBtn}
        >
          Bonificar ítem
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
  panelHelp: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
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
  quickReasons: {
    width: "100%",
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  reason: {
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#344054",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  reasonActive: {
    border: "1px solid #16a34a",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
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
