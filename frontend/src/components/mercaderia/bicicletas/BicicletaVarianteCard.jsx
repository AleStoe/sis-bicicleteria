export default function BicicletaVarianteCard({
  variante,
  index,
  puedeEliminar,
  onChange,
  onRemove,
}) {
  function cambiarArchivo(e) {
    const archivo = e.target.files?.[0] || null;

    onChange(index, "imagen_archivo", archivo);
    onChange(index, "imagen_preview", archivo ? URL.createObjectURL(archivo) : "");
  }

  return (
    <div style={styles.variantCard}>
      <div style={styles.rowBetween}>
        <strong>Variante #{index + 1}</strong>

        {puedeEliminar && (
          <button type="button" onClick={() => onRemove(index)} style={styles.dangerButton}>
            Eliminar
          </button>
        )}
      </div>

      <div style={styles.grid}>
        <label style={styles.label}>
          Talle *
          <input
            style={styles.input}
            value={variante.talle}
            onChange={(e) => onChange(index, "talle", e.target.value)}
            placeholder="S / M / L"
          />
        </label>

        <label style={styles.label}>
          Color *
          <input
            style={styles.input}
            value={variante.color}
            onChange={(e) => onChange(index, "color", e.target.value)}
            placeholder="Negro/Fucsia/Naranja"
          />
        </label>

        <label style={styles.label}>
          Código proveedor *
          <input
            style={styles.input}
            value={variante.codigo_proveedor}
            onChange={(e) => onChange(index, "codigo_proveedor", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Cantidad *
          <input
            style={styles.input}
            type="number"
            value={variante.cantidad}
            onChange={(e) => onChange(index, "cantidad", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Costo unitario *
          <input
            style={styles.input}
            type="number"
            value={variante.costo_unitario}
            onChange={(e) => onChange(index, "costo_unitario", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Precio minorista
          <input
            style={styles.input}
            type="number"
            value={variante.precio_minorista}
            onChange={(e) => onChange(index, "precio_minorista", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Precio mayorista
          <input
            style={styles.input}
            type="number"
            value={variante.precio_mayorista}
            onChange={(e) => onChange(index, "precio_mayorista", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Imagen variante
          <input
            style={styles.input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={cambiarArchivo}
          />
        </label>
      </div>

      {variante.imagen_preview && (
        <img
          src={variante.imagen_preview}
          alt={`Preview variante ${index + 1}`}
          style={styles.previewImg}
        />
      )}
    </div>
  );
}

const styles = {
  variantCard: {
    display: "grid",
    gap: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "14px",
    background: "#fafafa",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 700,
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  previewImg: {
    width: "100%",
    maxHeight: "180px",
    objectFit: "contain",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#fff",
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