export default function BicicletaFichaTecnicaForm({
  items,
  onAdd,
  onChange,
  onRemove,
}) {
  return (
    <section style={styles.section}>
      <div style={styles.rowBetween}>
        <h2 style={styles.cardTitle}>Ficha técnica</h2>

        <button type="button" onClick={onAdd} style={styles.secondaryButton}>
          + Agregar componente
        </button>
      </div>

      {items.map((item, index) => (
        <div key={index} style={styles.fichaRow}>
          <input
            style={styles.input}
            value={item.grupo}
            onChange={(e) => onChange(index, "grupo", e.target.value)}
            placeholder="Grupo"
          />

          <input
            style={styles.input}
            value={item.clave}
            onChange={(e) => onChange(index, "clave", e.target.value)}
            placeholder="Clave"
          />

          <input
            style={styles.input}
            value={item.valor}
            onChange={(e) => onChange(index, "valor", e.target.value)}
            placeholder="Valor"
          />

          <button
            type="button"
            onClick={() => onRemove(index)}
            style={styles.dangerButton}
          >
            X
          </button>
        </div>
      ))}
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: "14px",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
  },
  fichaRow: {
    display: "grid",
    gridTemplateColumns: "180px 240px 1fr auto",
    gap: "8px",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    background: "#b42318",
    color: "white",
    borderRadius: "10px",
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};