import AltaBicicletaForm from "../components/mercaderia/bicicletas/AltaBicicletaForm";
import useMediaQuery from "../hooks/useMediaQuery";

const CHECKS = [
  "Nombre claro: marca + tipo + modelo + rodado.",
  "Una variante por talle/color/código proveedor.",
  "Cargá stock solo si la mercadería ya ingresó físicamente.",
  "El número de cuadro se carga después en bicicletas serializadas.",
];

export default function AltaBicicletaPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1100px)");

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Mercadería / Bicicletas</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Alta de bicicletas</h1>
          <p style={styles.subtitle}>
            Cargá el modelo base, sus variantes comerciales y el stock inicial.
            La ficha técnica queda como dato opcional.
          </p>
        </div>
      </header>

      <section style={isNarrow ? styles.contentGridMobile : styles.contentGrid}>
        <main style={styles.mainColumn}>
          <AltaBicicletaForm />
        </main>

        <aside style={isNarrow ? styles.sideColumnMobile : styles.sideColumn}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Orden recomendado</h3>
            <ol style={styles.steps}>
              <li>Definí el modelo base.</li>
              <li>Cargá una o varias variantes.</li>
              <li>Revisá códigos, costos y precios.</li>
              <li>Completá ficha técnica solo si aporta valor.</li>
            </ol>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Control antes de guardar</h3>
            <div style={styles.checkList}>
              {CHECKS.map((check) => (
                <div key={check} style={styles.checkItem}>
                  <span style={styles.checkIcon}>✓</span>
                  <span>{check}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.warningCard}>
            <strong>Importante</strong>
            <p>
              Esta pantalla crea el producto bicicleta y sus variantes. No crea
              unidades únicas con número de cuadro. Eso va en el módulo de
              bicicletas serializadas.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#f3f4f6",
    color: "#111827",
  },
  pageMobile: {
    padding: "12px",
    overflowX: "hidden",
  },
  header: {
    marginBottom: "18px",
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
    fontSize: "30px",
    fontWeight: 900,
  },
  titleMobile: {
    fontSize: "24px",
  },
  subtitle: {
    margin: "6px 0 0",
    maxWidth: "780px",
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: "18px",
    alignItems: "start",
  },
  contentGridMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "14px",
    alignItems: "start",
  },
  mainColumn: {
    minWidth: 0,
  },
  sideColumn: {
    display: "grid",
    gap: "14px",
    position: "sticky",
    top: "16px",
  },
  sideColumnMobile: {
    display: "grid",
    gap: "12px",
    position: "static",
  },
  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
  },
  sideTitle: {
    margin: "0 0 12px",
    fontSize: "16px",
    fontWeight: 900,
  },
  steps: {
    margin: 0,
    paddingLeft: "20px",
    color: "#4b5563",
    display: "grid",
    gap: "8px",
    fontSize: "14px",
  },
  checkList: {
    display: "grid",
    gap: "10px",
  },
  checkItem: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    gap: "8px",
    color: "#374151",
    fontWeight: 700,
    fontSize: "13px",
    lineHeight: 1.35,
  },
  checkIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  warningCard: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    borderRadius: "16px",
    padding: "16px",
    fontWeight: 700,
    lineHeight: 1.4,
  },
};
