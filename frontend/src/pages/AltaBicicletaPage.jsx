import AltaBicicletaForm from "../components/mercaderia/bicicletas/AltaBicicletaForm";

const PASOS = [
  {
    numero: "1",
    titulo: "Modelo base",
    descripcion: "Nombre, marca, categoría y datos generales.",
    icono: "🚲",
  },
  {
    numero: "2",
    titulo: "Variantes",
    descripcion: "Color, talle, proveedor, códigos y precios.",
    icono: "🎨",
  },
  {
    numero: "3",
    titulo: "Imagen",
    descripcion: "Foto clara para catálogo, POS y control visual.",
    icono: "📷",
  },
  {
    numero: "4",
    titulo: "Ficha técnica",
    descripcion: "Rodado, material, transmisión y características.",
    icono: "📋",
  },
  {
    numero: "5",
    titulo: "Stock inicial",
    descripcion: "Ingreso físico a sucursal si corresponde.",
    icono: "📦",
  },
];

const CHECKS = [
  "Usá nombres claros: marca + modelo + rodado.",
  "Evitá variantes duplicadas por color o talle.",
  "Cargá imagen antes de usarla en POS.",
  "Si tiene número de cuadro, después armala como serializada.",
];

export default function AltaBicicletaPage() {
  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <span style={styles.kicker}>Mercadería</span>
          <h1 style={styles.title}>Alta de bicicletas</h1>
          <p style={styles.subtitle}>
            Cargá una bicicleta nueva para venta: primero el modelo, después sus
            variantes, imagen, ficha técnica y stock inicial.
          </p>
        </div>

        <div style={styles.heroBadge}>
          <span style={styles.heroBadgeIcon}>🚲</span>
          <div>
            <strong>Alta guiada</strong>
            <small>Menos errores al cargar productos nuevos</small>
          </div>
        </div>
      </header>

      <section style={styles.stepsCard}>
        <div style={styles.stepsHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Flujo recomendado</h2>
            <p style={styles.sectionSubtitle}>
              Seguí este orden para que después aparezca bien en catálogo, POS y
              serializadas.
            </p>
          </div>
        </div>

        <div style={styles.stepsGrid}>
          {PASOS.map((paso) => (
            <article key={paso.numero} style={styles.stepItem}>
              <div style={styles.stepIcon}>{paso.icono}</div>
              <div>
                <span style={styles.stepNumber}>Paso {paso.numero}</span>
                <strong style={styles.stepTitle}>{paso.titulo}</strong>
                <p style={styles.stepText}>{paso.descripcion}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <main style={styles.layout}>
        <section style={styles.formPanel}>
          <div style={styles.formPanelHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Datos de la bicicleta</h2>
              <p style={styles.sectionSubtitle}>
                Completá la información comercial y técnica. La pantalla conserva
                el formulario actual, pero con mejor contexto operativo.
              </p>
            </div>
          </div>

          <AltaBicicletaForm />
        </section>

        <aside style={styles.sidePanel}>
          <section style={styles.sideCardDark}>
            <span style={styles.sideKicker}>Control antes de guardar</span>
            <h2 style={styles.sideTitle}>Resumen operativo</h2>

            <div style={styles.summaryBox}>
              <span>Modelo</span>
              <strong>Definir nombre claro</strong>
            </div>

            <div style={styles.summaryBox}>
              <span>Variante</span>
              <strong>Color / talle / códigos</strong>
            </div>

            <div style={styles.summaryBox}>
              <span>Imagen</span>
              <strong>Foto visible en POS</strong>
            </div>

            <div style={styles.summaryBox}>
              <span>Stock</span>
              <strong>Ingresar solo si corresponde</strong>
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.checkTitle}>Para no cargar mal</h3>

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
              Dar de alta una bicicleta no significa que tenga número de cuadro.
              Si la bicicleta queda armada físicamente, después registrala como
              serializada desde el módulo de unidades únicas.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "#f1f5f9",
    color: "#0f172a",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
    padding: 22,
    borderRadius: 24,
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "white",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
  },
  kicker: {
    display: "block",
    color: "#fb923c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: 720,
    color: "#cbd5e1",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  heroBadge: {
    minWidth: 260,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
  },
  heroBadgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: "#f97316",
    display: "grid",
    placeItems: "center",
    fontSize: 26,
  },
  stepsCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
  },
  stepsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
    fontWeight: 1000,
  },
  sectionSubtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  stepItem: {
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr)",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  stepIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: "#fff7ed",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
  },
  stepNumber: {
    display: "block",
    fontSize: 11,
    color: "#f97316",
    textTransform: "uppercase",
    fontWeight: 1000,
    letterSpacing: "0.06em",
  },
  stepTitle: {
    display: "block",
    marginTop: 2,
    fontSize: 14,
    color: "#0f172a",
  },
  stepText: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 16,
    alignItems: "start",
  },
  formPanel: {
    minWidth: 0,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)",
  },
  formPanelHeader: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottom: "1px solid #e2e8f0",
  },
  sidePanel: {
    display: "grid",
    gap: 14,
    position: "sticky",
    top: 16,
  },
  sideCardDark: {
    background: "#0f172a",
    color: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
  },
  sideKicker: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sideTitle: {
    margin: "8px 0 14px",
    fontSize: 24,
  },
  summaryBox: {
    background: "#1e293b",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gap: 4,
    marginTop: 10,
  },
  sideCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
  },
  checkTitle: {
    margin: "0 0 12px",
    fontSize: 18,
    color: "#0f172a",
  },
  checkList: {
    display: "grid",
    gap: 10,
  },
  checkItem: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    gap: 8,
    color: "#334155",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: 1.35,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#047857",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
  },
  warningCard: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 20,
    padding: 16,
    fontWeight: 800,
    lineHeight: 1.4,
  },
};
