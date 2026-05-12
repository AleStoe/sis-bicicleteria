export default function AltaBicicletaForm() {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>Modelo base</h2>

      <div style={styles.infoBox}>
        Acá vamos a cargar la bicicleta como producto base y después sus variantes:
        talle, color, código proveedor, precio, imagen e ingreso.
      </div>

      <div style={styles.previewBox}>
        <strong>Ejemplo de estructura correcta</strong>

        <div style={styles.example}>
          <div>
            <span style={styles.label}>Producto base</span>
            <p style={styles.value}>
              BICICLETA MTB TOPMEGA REGAL R29 ALUMINIO 21V TOURNEY
            </p>
          </div>

          <div>
            <span style={styles.label}>Variantes</span>
            <ul style={styles.list}>
              <li>Talle S · Negro/Fucsia/Naranja · Código 1007977</li>
              <li>Talle M · Negro/Fucsia/Naranja · Código 1007978</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = {
  card: {
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    padding: "16px",
  },
  cardTitle: {
    margin: "0 0 14px",
    fontSize: "20px",
  },
  infoBox: {
    padding: "12px",
    borderRadius: "12px",
    background: "#eef4ff",
    border: "1px solid #bfdbfe",
    color: "#344054",
    marginBottom: "14px",
  },
  previewBox: {
    display: "grid",
    gap: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "14px",
  },
  example: {
    display: "grid",
    gap: "10px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    color: "#667085",
    marginBottom: "4px",
  },
  value: {
    margin: 0,
    fontWeight: 800,
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
  },
};