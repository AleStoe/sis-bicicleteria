import BicicletaModeloForm from "./BicicletaModeloForm";
import BicicletaVariantesForm from "./BicicletaVariantesForm";
import BicicletaFichaTecnicaForm from "./BicicletaFichaTecnicaForm";
import useAltaBicicleta from "./hooks/useAltaBicicleta";

export default function AltaBicicletaForm() {
  const {
    categorias,
    marcas,
    proveedores,
    form,
    procesando,
    error,
    mensaje,
    nombreProducto,
    setCampo,
    setVariante,
    setFicha,
    agregarVariante,
    quitarVariante,
    agregarFicha,
    quitarFicha,
    guardar,
  } = useAltaBicicleta();

  return (
    <form onSubmit={guardar} style={styles.form}>
      {error && <div style={styles.error}>Error: {error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.eyebrow}>Paso 1</p>
            <h2 style={styles.cardTitle}>Modelo base</h2>
            <p style={styles.muted}>
              Estos datos generan el producto principal que después aparece en
              catálogo, POS y stock.
            </p>
          </div>
        </div>

        <BicicletaModeloForm
          form={form}
          setCampo={setCampo}
          categorias={categorias}
          marcas={marcas}
          proveedores={proveedores}
          nombreProducto={nombreProducto}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.eyebrow}>Paso 2</p>
            <h2 style={styles.cardTitle}>Variantes e ingreso inicial</h2>
            <p style={styles.muted}>
              Cada variante representa una combinación vendible: talle, color,
              código proveedor, costo, precio e imagen.
            </p>
          </div>
        </div>

        <BicicletaVariantesForm
          variantes={form.variantes}
          onAdd={agregarVariante}
          onChange={setVariante}
          onRemove={quitarVariante}
        />
      </section>

      <details style={styles.details}>
        <summary style={styles.detailsSummary}>
          <div>
            <p style={styles.eyebrow}>Opcional</p>
            <strong>Ficha técnica</strong>
            <span> Cuadro, transmisión, frenos, ruedas y componentes.</span>
          </div>
        </summary>

        <div style={styles.detailsBody}>
          <BicicletaFichaTecnicaForm
            items={form.ficha_tecnica}
            onAdd={agregarFicha}
            onChange={setFicha}
            onRemove={quitarFicha}
          />
        </div>
      </details>

      <div style={styles.submitBar}>
        <div>
          <strong>{nombreProducto || "Bicicleta sin nombre generado"}</strong>
          <p>Revisá códigos, costos y cantidades antes de crear.</p>
        </div>

        <button type="submit" disabled={procesando} style={styles.primaryButton}>
          {procesando ? "Creando..." : "Crear bicicleta e ingresar variantes"}
        </button>
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: "18px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  },
  sectionHeader: {
    marginBottom: "14px",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cardTitle: {
    margin: "2px 0 0",
    fontSize: "22px",
    fontWeight: 900,
  },
  muted: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  details: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  },
  detailsSummary: {
    cursor: "pointer",
    padding: "18px",
    listStyle: "none",
  },
  detailsBody: {
    padding: "0 18px 18px",
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: "18px",
    padding: "16px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    position: "sticky",
    bottom: "12px",
    zIndex: 2,
  },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  error: {
    background: "#fef2f2",
    color: "#991b1b",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #fecaca",
    fontWeight: 700,
  },
  success: {
    background: "#ecfdf5",
    color: "#166534",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #bbf7d0",
    fontWeight: 700,
  },
};
