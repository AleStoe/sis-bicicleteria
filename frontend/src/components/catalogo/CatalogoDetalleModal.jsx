import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/appConfig";
import { obtenerFichaTecnicaProducto } from "../../services/catalogoService";
import EstadoBadge from "./EstadoBadge";
import PreciosComercialesCatalogo from "./PreciosComercialesCatalogo";
import { X } from "lucide-react";
import { colors, radius, shadows, spacing, typography } from "../../theme";

export default function CatalogoDetalleModal({ item, onClose, onEdit }) {
  const [fichaTecnica, setFichaTecnica] = useState([]);
  const [cargandoFicha, setCargandoFicha] = useState(false);

  useEffect(() => {
    cargarFichaTecnica();
  }, [item?.id_producto]);

  async function cargarFichaTecnica() {
    if (!item?.id_producto) return;

    try {
      setCargandoFicha(true);
      const data = await obtenerFichaTecnicaProducto(item.id_producto);
      setFichaTecnica(data || []);
    } catch {
      setFichaTecnica([]);
    } finally {
      setCargandoFicha(false);
    }
  }

  const stock = useMemo(
    () => [
      { label: "Disponible", value: item.stock_disponible, tone: "ok" },
      { label: "Físico", value: item.stock_fisico, tone: "info" },
      { label: "Reservado", value: item.stock_reservado, tone: "muted" },
      {
        label: "Pendiente entrega",
        value: item.stock_vendido_pendiente_entrega,
        tone: "warning",
      },
    ],
    [item]
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>Detalle de catálogo</p>
            <h2 style={styles.title}>{item.producto_nombre}</h2>
            <p style={styles.subtitle}>{item.nombre_variante || "Variante única"}</p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main style={styles.content}>
          <section style={styles.leftColumn}>
            <div style={styles.imageCard}>
              {item.imagen_principal ? (
                <img
                  src={getImageUrl(item.imagen_principal)}
                  alt={item.producto_nombre}
                  style={styles.image}
                />
              ) : (
                <div style={styles.placeholder}>Sin imagen</div>
              )}
            </div>

            <div style={styles.statusCard}>
              <div>
                <span style={styles.smallLabel}>Estado</span>
                <div style={styles.badgeWrap}>
                  <EstadoBadge item={item} />
                </div>
              </div>
              <strong>{item.disponible_para_venta ? "Listo para vender" : "Revisar"}</strong>
            </div>

            <PreciosComercialesCatalogo
              item={item}
              nombre={[item.producto_nombre, item.nombre_variante]
                .filter(Boolean)
                .join(" - ")}
            />
          </section>

          <section style={styles.rightColumn}>
            <div style={styles.stockGrid}>
              {stock.map((s) => (
                <StockBox key={s.label} {...s} />
              ))}
            </div>

            <div style={styles.twoColumns}>
              <InfoSection title="Códigos">
                <InfoRow label="SKU" value={item.sku} />
                <InfoRow label="EAN" value={item.codigo_barras} />
                <InfoRow label="Código proveedor" value={item.codigo_proveedor} strong />
              </InfoSection>

              <InfoSection title="Datos comerciales">
                <InfoRow label="Marca" value={item.marca_nombre} strong />
                <InfoRow label="Categoría" value={item.categoria_nombre} strong />
                <InfoRow label="Proveedor" value={item.proveedor_preferido_nombre} />
              </InfoSection>
            </div>

            <InfoSection title="Ficha técnica">
              {cargandoFicha ? (
                <div style={styles.emptyText}>Cargando ficha técnica...</div>
              ) : fichaTecnica.length === 0 ? (
                <div style={styles.emptyText}>Sin ficha técnica cargada.</div>
              ) : (
                <FichaTecnicaAgrupada items={fichaTecnica} />
              )}
            </InfoSection>
          </section>
        </main>

        <footer style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Cerrar
          </button>
          <button type="button" onClick={onEdit} style={styles.primaryButton}>
            Editar producto
          </button>
        </footer>
      </div>
    </div>
  );
}

function getImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function InfoSection({ title, children }) {
  return (
    <section style={styles.sectionCard}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

function InfoRow({ label, value, strong = false }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <strong style={strong ? styles.strongValue : undefined}>{value || "-"}</strong>
    </div>
  );
}

function StockBox({ label, value, tone }) {
  return (
    <div style={{ ...styles.stockBox, ...(styles.stockTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function FichaTecnicaAgrupada({ items }) {
  const grupos = items.reduce((acc, item) => {
    const grupo = item.grupo || "Otros";
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(item);
    return acc;
  }, {});

  return (
    <div style={styles.fichaGrid}>
      {Object.entries(grupos).map(([grupo, componentes]) => (
        <div key={grupo} style={styles.fichaGroup}>
          <h4 style={styles.fichaGroupTitle}>{grupo}</h4>
          <div style={styles.fichaSpecs}>
            {componentes.map((item) => (
              <div key={item.id || `${item.grupo}-${item.clave}`} style={styles.fichaRow}>
                <span>{item.clave}</span>
                <strong>{item.valor || "-"}</strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: 3,
  });
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.58)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    width: "min(1120px, 100%)",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    background: colors.surfaceMuted,
    borderRadius: radius.lg,
    overflow: "hidden",
    boxShadow: shadows.lg,
  },
  header: {
    padding: "20px 24px",
    background: colors.surface,
    borderBottom: `1px solid ${colors.borderSoft}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  kicker: {
    margin: 0,
    color: colors.primary,
    fontSize: typography.small.fontSize,
    fontWeight: typography.label.fontWeight,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "4px 0 0",
    fontSize: typography.title.fontSize,
    lineHeight: 1.1,
    fontWeight: typography.title.fontWeight,
    color: colors.textStrong,
  },
  subtitle: {
    margin: "6px 0 0",
    color: colors.textMuted,
    fontWeight: typography.label.fontWeight,
  },
  closeButton: {
    width: 38,
    height: 38,
    display: "inline-grid",
    placeItems: "center",
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    borderRadius: radius.md,
    cursor: "pointer",
    fontWeight: 1000,
    color: colors.text,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "330px minmax(0, 1fr)",
    gap: spacing.lg,
    padding: spacing.xl,
    overflowY: "auto",
    alignItems: "start",
  },
  leftColumn: {
    display: "grid",
    gap: 14,
  },
  rightColumn: {
    display: "grid",
    gap: 14,
  },
  imageCard: {
    minHeight: 330,
    borderRadius: radius.lg,
    border: `1px solid ${colors.borderSoft}`,
    background: colors.surface,
    display: "grid",
    placeItems: "center",
    padding: 14,
  },
  image: {
    width: "100%",
    height: 300,
    objectFit: "contain",
  },
  placeholder: {
    width: "100%",
    height: 300,
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    fontWeight: 900,
    background: "#f8fafc",
  },
  statusCard: {
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.md,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  smallLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 6,
  },
  badgeWrap: {
    display: "flex",
  },
  stockGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  },
  stockBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 6,
    background: "#ffffff",
  },
  stockTones: {
    ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" },
    info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" },
    warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" },
    muted: { color: "#475569", background: "#f8fafc" },
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  sectionCard: {
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 1000,
  },
  sectionBody: {
    display: "grid",
    gap: 8,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #f1f5f9",
    color: "#64748b",
  },
  strongValue: {
    color: "#0f172a",
  },
  emptyText: {
    color: "#64748b",
    fontWeight: 800,
  },
  fichaGrid: {
    display: "grid",
    gap: 12,
  },
  fichaGroup: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    background: "#f8fafc",
  },
  fichaGroupTitle: {
    margin: "0 0 10px",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  fichaSpecs: {
    display: "grid",
    gap: 8,
  },
  fichaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#64748b",
    paddingBottom: 7,
    borderBottom: "1px solid #e2e8f0",
  },
  footer: {
    padding: 16,
    background: "#ffffff",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 13,
    padding: "12px 16px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    background: "#f97316",
    color: "#ffffff",
    borderRadius: 13,
    padding: "12px 16px",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(249, 115, 22, 0.22)",
  },
};
