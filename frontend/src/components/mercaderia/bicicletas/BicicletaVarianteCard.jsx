function money(value) {
  const numero = Number(value || 0);
  return numero.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

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

  const cantidad = Number(variante.cantidad || 0);
  const costoUnitario = Number(variante.costo_unitario || 0);
  const totalCosto = cantidad * costoUnitario;

  return (
    <article style={styles.variantCard}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Variante #{index + 1}</p>
          <h3 style={styles.title}>
            {[variante.talle, variante.color].filter(Boolean).join(" / ") ||
              "Talle y color pendientes"}
          </h3>
        </div>

        {puedeEliminar && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={styles.dangerButton}
          >
            Eliminar
          </button>
        )}
      </div>

      <div style={styles.fastGrid}>
        <label style={styles.label}>
          Talle *
          <input
            style={styles.input}
            value={variante.talle}
            onChange={(e) => onChange(index, "talle", e.target.value)}
            placeholder="S / M / L / 17"
          />
        </label>

        <label style={styles.label}>
          Color *
          <input
            style={styles.input}
            value={variante.color}
            onChange={(e) => onChange(index, "color", e.target.value)}
            placeholder="Negro/Fucsia"
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
            min="1"
            value={variante.cantidad}
            onChange={(e) => onChange(index, "cantidad", e.target.value)}
          />
        </label>
      </div>

      <div style={styles.moneyGrid}>
        <label style={styles.label}>
          Costo unitario *
          <input
            style={styles.input}
            type="number"
            min="0"
            value={variante.costo_unitario}
            onChange={(e) => onChange(index, "costo_unitario", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Precio minorista
          <input
            style={styles.input}
            type="number"
            min="0"
            value={variante.precio_minorista}
            onChange={(e) => onChange(index, "precio_minorista", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Precio mayorista
          <input
            style={styles.input}
            type="number"
            min="0"
            value={variante.precio_mayorista}
            onChange={(e) => onChange(index, "precio_mayorista", e.target.value)}
          />
        </label>
      </div>

      <div style={styles.bottomGrid}>
        <div style={styles.summaryBox}>
          <span>Total costo ingreso</span>
          <strong>{money(totalCosto)}</strong>
        </div>

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
    </article>
  );
}

const styles = {
  variantCard: {
    display: "grid",
    gap: "14px",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    background: "#fafafa",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  title: {
    margin: "2px 0 0",
    fontSize: "18px",
    fontWeight: 900,
  },
  fastGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
  },
  moneyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "12px",
    alignItems: "end",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 800,
    fontSize: "13px",
  },
  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
  },
  summaryBox: {
    display: "grid",
    gap: "4px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    padding: "12px",
  },
  previewImg: {
    width: "100%",
    maxHeight: "220px",
    objectFit: "contain",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#ffffff",
  },
  dangerButton: {
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
