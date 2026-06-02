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
        <div>
          <strong style={styles.sectionTitle}>Variantes</strong>
          <p style={styles.muted}>
            Agregá una tarjeta por talle/color. Evitá repetir códigos proveedor.
          </p>
        </div>

        <button type="button" onClick={onAdd} style={styles.secondaryButton}>
          + Agregar variante
        </button>
      </div>

      <div style={styles.cardsGrid}>
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
      </div>
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
  sectionTitle: {
    display: "block",
    fontSize: "16px",
    fontWeight: 900,
  },
  muted: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "13px",
  },
  cardsGrid: {
    display: "grid",
    gap: "14px",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "11px 13px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
