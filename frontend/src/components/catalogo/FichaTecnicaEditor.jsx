export default function FichaTecnicaEditor({
  items,
  procesando,
  onChange,
  onAdd,
  onRemove,
  onSave,
}) {
  return (
    <form onSubmit={onSave} style={styles.box}>
      <div style={styles.header}>
        <h3 style={styles.title}>Ficha técnica</h3>

        <button type="button" onClick={onAdd} style={styles.secondaryButton}>
          + Agregar
        </button>
      </div>

      {items.length === 0 ? (
        <div style={styles.empty}>Sin componentes cargados.</div>
      ) : (
        items.map((item, index) => (
          <div key={item.id ?? index} style={styles.row}>
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
        ))
      )}

      <button type="submit" disabled={procesando} style={styles.primaryButton}>
        {procesando ? "Guardando..." : "Guardar ficha técnica"}
      </button>
    </form>
  );
}

const styles = {
  box: {
    display: "grid",
    gap: "10px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "16px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.4fr auto",
    gap: "6px",
    alignItems: "center",
  },
  input: {
    width: "100%",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    padding: "9px 10px",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  empty: {
    color: "#667085",
    fontSize: "13px",
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "10px",
  },
  primaryButton: {
    border: "none",
    background: "#0b5bd3",
    color: "white",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    background: "#b42318",
    color: "white",
    borderRadius: "10px",
    padding: "8px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
};