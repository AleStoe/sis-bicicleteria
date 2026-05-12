import AltaBicicletaForm from "../components/mercaderia/bicicletas/AltaBicicletaForm";

export default function AltaBicicletaPage() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Alta de bicicletas</h1>
          <p style={styles.subtitle}>
            Cargá modelos base, variantes, ficha técnica e ingreso de stock.
          </p>
        </div>
      </header>

      <AltaBicicletaForm />
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  header: {
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#667085",
  },
};