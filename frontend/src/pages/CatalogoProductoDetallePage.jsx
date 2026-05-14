import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getImageUrl } from "../utils/images";
import {
  obtenerProducto,
  listarVariantes,
  obtenerFichaTecnicaProducto,
} from "../services/catalogoService";

const TAB_GENERAL = "general";

const TAB_VARIANTES = "variantes";

const TAB_FICHA = "ficha";

export default function CatalogoProductoDetallePage() {
  const { productoId } = useParams();
  const navigate = useNavigate();

  const [producto, setProducto] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [fichaTecnica, setFichaTecnica] = useState([]);
  const [tabActiva, setTabActiva] = useState(TAB_GENERAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargar();
  }, [productoId]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");

      const [productoData, variantesData, fichaData] = await Promise.all([
        obtenerProducto(productoId),
        listarVariantes(),
        obtenerFichaTecnicaProducto(productoId),
      ]);

      setProducto(productoData);

      setVariantes(
        (variantesData || []).filter(
          (v) => String(v.id_producto) === String(productoId)
        )
      );
      setFichaTecnica(fichaData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el producto");
    } finally {
      setLoading(false);
    }
  }

  const imagenPrincipal = useMemo(() => {
    const varianteConImagen = variantes.find(
      (v) => v.imagen_principal
    );

    return varianteConImagen?.imagen_principal || null;
  }, [variantes]);

  const resumenVariantes = useMemo(() => {
    const activas = variantes.filter(
      (v) => v.activo !== false
    ).length;

    return {
      total: variantes.length,
      activas,
      inactivas: variantes.length - activas,
    };
  }, [variantes]);

  if (loading) {
    return <div style={styles.state}>Cargando producto...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!producto) {
    return <div style={styles.error}>Producto no encontrado</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <button
            type="button"
            onClick={() => navigate("/catalogo")}
            style={styles.backButton}
          >
            ← Volver al catálogo
          </button>

          <h1 style={styles.title}>{producto.nombre}</h1>

          <div style={styles.subtitle}>
            Producto #{producto.id}
          </div>
        </div>

        <div style={styles.headerActions}>
          <button type="button" onClick={cargar} style={styles.secondaryButton}>
            Refrescar
          </button>
        </div>
      </header>

      <section style={styles.heroGrid}>
        <div style={styles.imageCard}>
          {imagenPrincipal ? (
            <img
              src={getImageUrl(imagenPrincipal)}
              alt={producto.nombre}
              style={styles.heroImage}
            />
          ) : (
            <div style={styles.imagePlaceholder}>
              Sin imagen principal
            </div>
          )}
        </div>

        <div style={styles.summaryCard}>
          <h2 style={styles.sectionTitle}>Resumen</h2>

          <div style={styles.summaryGrid}>
            <Info label="Marca" value={producto.marca_nombre} />
            <Info label="Categoría" value={producto.categoria_nombre} />
            <Info label="Activo" value={producto.activo ? "Sí" : "No"} />
            <Info label="Stockeable" value={producto.stockeable ? "Sí" : "No"} />
            <Info label="Serializable" value={producto.serializable ? "Sí" : "No"} />
            <Info label="Variantes" value={resumenVariantes.total} />
          </div>
        </div>
      </section>

      <nav style={styles.tabs}>
        <TabButton
          active={tabActiva === TAB_GENERAL}
          onClick={() => setTabActiva(TAB_GENERAL)}
        >
          General
        </TabButton>

        <TabButton
          active={tabActiva === TAB_VARIANTES}
          onClick={() => setTabActiva(TAB_VARIANTES)}
        >
          Variantes ({resumenVariantes.total})
        </TabButton>
        <TabButton
          active={tabActiva === TAB_FICHA}
          onClick={() => setTabActiva(TAB_FICHA)}
        >
          Ficha técnica ({fichaTecnica.length})
        </TabButton>
      </nav>

      {tabActiva === TAB_GENERAL && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Información general</h2>

          <div style={styles.infoGrid}>
            <Info label="Nombre" value={producto.nombre} />
            <Info label="Tipo item" value={producto.tipo_item} />
            <Info label="Descripción" value={producto.descripcion} />
            <Info label="Rodado" value={producto.rodado} />
            <Info label="Tipo bicicleta" value={producto.tipo_bicicleta} />
            <Info label="Material cuadro" value={producto.material_cuadro} />
          </div>
        </section>
      )}

      {tabActiva === TAB_VARIANTES && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Variantes</h2>
              <p style={styles.muted}>
                {resumenVariantes.activas} activas · {resumenVariantes.inactivas} inactivas
              </p>
            </div>
          </div>

          {variantes.length === 0 ? (
            <div style={styles.empty}>Este producto no tiene variantes.</div>
          ) : (
            <div style={styles.variantes}>
              {variantes.map((variante) => (
                <div key={variante.id} style={styles.varianteCard}>
                  <div>
                    <strong style={styles.varianteTitle}>
                      {variante.nombre_variante}
                    </strong>

                    <div style={styles.smallText}>
                      Variante #{variante.id}
                    </div>
                  </div>

                  <div style={styles.varianteMeta}>
                    <InfoCompact label="SKU" value={variante.sku} />
                    <InfoCompact label="EAN" value={variante.codigo_barras} />
                    <InfoCompact label="Código proveedor" value={variante.codigo_proveedor} />
                    <InfoCompact label="Talle" value={variante.talle} />
                    <InfoCompact label="Color" value={variante.color} />
                  </div>

                  <div style={styles.priceBox}>
                    <div>
                      <div style={styles.smallText}>Minorista</div>
                      <strong>{formatMoney(variante.precio_minorista)}</strong>
                    </div>

                    <div>
                      <div style={styles.smallText}>Mayorista</div>
                      <strong>{formatMoney(variante.precio_mayorista)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {tabActiva === TAB_FICHA && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Ficha técnica</h2>
              <p style={styles.muted}>
                Componentes y especificaciones del producto base.
              </p>
            </div>
          </div>

          {fichaTecnica.length === 0 ? (
            <div style={styles.empty}>Este producto no tiene ficha técnica cargada.</div>
          ) : (
            <div style={styles.fichaGrid}>
              {fichaTecnica.map((item) => (
                <div key={item.id} style={styles.fichaItem}>
                  <div style={styles.fichaGrupo}>{item.grupo || "GENERAL"}</div>
                  <div style={styles.fichaClave}>{item.clave}</div>
                  <strong>{item.valor || "-"}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? styles.tabActive : styles.tab}
    >
      {children}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoLabel}>{label}</div>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function InfoCompact({ label, value }) {
  return (
    <div style={styles.compactBox}>
      <span style={styles.infoLabel}>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

const tabBase = {
  border: "1px solid #d0d5dd",
  borderRadius: "999px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const styles = {
  page: {
    display: "grid",
    gap: "18px",
    padding: "22px",
    background: "#f6f7fb",
    minHeight: "100vh",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "14px",
  },

  headerActions: {
    display: "flex",
    gap: "10px",
  },

  backButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    marginBottom: "10px",
    fontWeight: 800,
  },

  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1.15,
  },

  subtitle: {
    color: "#667085",
    marginTop: "6px",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "340px 1fr",
    gap: "16px",
    alignItems: "stretch",
  },

  imageCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 2px 10px rgba(0,0,0,.06)",
    minHeight: "260px",
  },

  imagePlaceholder: {
    height: "100%",
    minHeight: "230px",
    border: "1px dashed #d0d5dd",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    color: "#667085",
    background: "#f9fafb",
    fontWeight: 700,
  },

  summaryCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 2px 10px rgba(0,0,0,.06)",
  },

  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 2px 10px rgba(0,0,0,.06)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "start",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: 0,
    marginBottom: "14px",
    fontSize: "22px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: "12px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "12px",
  },

  infoBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    background: "#fff",
  },

  compactBox: {
    display: "grid",
    gap: "3px",
    minWidth: "140px",
  },

  infoLabel: {
    fontSize: "12px",
    color: "#667085",
    marginBottom: "4px",
  },

  tabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  tab: {
    ...tabBase,
    background: "white",
    color: "#344054",
  },

  tabActive: {
    ...tabBase,
    background: "#0b5bd3",
    borderColor: "#0b5bd3",
    color: "white",
  },

  variantes: {
    display: "grid",
    gap: "12px",
  },

  varianteCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.2fr) minmax(360px, 2fr) minmax(180px, .8fr)",
    gap: "14px",
    alignItems: "center",
  },

  varianteTitle: {
    fontSize: "16px",
  },

  varianteMeta: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  priceBox: {
    display: "grid",
    gap: "8px",
    justifyItems: "end",
  },

  smallText: {
    color: "#667085",
    fontSize: "13px",
  },

  muted: {
    color: "#667085",
    margin: 0,
  },

  empty: {
    color: "#667085",
    padding: "18px",
    borderRadius: "12px",
    background: "#f9fafb",
  },

  state: {
    padding: "20px",
  },

  error: {
    padding: "20px",
    color: "#b42318",
  },
  heroImage: {
  width: "100%",
  height: "100%",
  minHeight: "230px",
  objectFit: "contain",
  borderRadius: "14px",
  background: "#f9fafb",
},
fichaGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
},

fichaItem: {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "12px",
  background: "#fff",
},

fichaGrupo: {
  color: "#175cd3",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  marginBottom: "4px",
},

fichaClave: {
  color: "#667085",
  fontSize: "13px",
  marginBottom: "4px",
},
};