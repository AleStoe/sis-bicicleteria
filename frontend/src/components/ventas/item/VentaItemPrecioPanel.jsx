export default function VentaItemPrecioPanel({
  precioManual,
  setPrecioManual,
  motivoPrecio,
  setMotivoPrecio,
  aplicarPrecioManual,
  limpiarPrecioManual,
}) {
  const motivosRapidos = [
    "Precio acordado con cliente",
    "Igualar precio competencia",
    "Promoción del local",
    "Error de etiqueta",
    "Cliente frecuente",
    "Autorizado por encargado",
    "Ajuste comercial",
    "Otro",
  ];

  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Modificar precio</div>
      <div style={styles.panelHelp}>
        Usá esto sólo para cambiar el precio de venta de este ítem. Las bonificaciones por forma de pago se aplican en el cobro.
      </div>

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

        <div style={styles.quickReasons}>
          {motivosRapidos.map((motivo) => (
            <button
              key={motivo}
              type="button"
              onClick={() => setMotivoPrecio(motivo)}
              style={motivoPrecio === motivo ? styles.reasonActive : styles.reason}
            >
              {motivo}
            </button>
          ))}
        </div>

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
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
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
