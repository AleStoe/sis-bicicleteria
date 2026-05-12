import BicicletaVarianteCard from "./BicicletaVarianteCard";

export default function BicicletaVariantesForm({
  variantes,
  onAdd,
  onChange,
  onRemove,
}) {
  return (
    <section style={styles.section}>
      <div style={styles.rowBetween}>
        <h2 style={styles.cardTitle}>Variantes</h2>

        <button type="button" onClick={onAdd} style={styles.secondaryButton}>
          + Agregar variante
        </button>
      </div>

      {variantes.map((variante, index) => (
        <BicicletaVarianteCard
          key={index}
          variante={variante}
          index={index}
          puedeEliminar={variantes.length > 1}
          onChange={onChange}
          onRemove={onRemove}
        />
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
  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};