import { useEffect, useMemo, useState } from "react";
import { Barcode, FileText, Printer, Search, Tags } from "lucide-react";
import { listarVariantes } from "../services/catalogoService";
import { listarSerializadas } from "../services/serializadasService";
import {
  getEtiquetaDepositoBicicletaUrl,
  getEtiquetaDepositoVarianteUrl,
  getPrecioA4BicicletaUrl,
  getPrecioA4VarianteUrl,
} from "../services/documentosService";
import { formatMoney } from "../utils/formatters";

const MOBILE_BREAKPOINT = 760;

function normalizar(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function descripcionVariante(item) {
  return [item.producto_nombre, item.nombre_variante].filter(Boolean).join(" - ");
}

function descripcionBicicleta(item) {
  return [item.producto_nombre, item.nombre_variante, item.numero_cuadro]
    .filter(Boolean)
    .join(" - ");
}

function abrirPdf(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [breakpoint]);

  return isMobile;
}

export default function EtiquetasPage() {
  const [modo, setModo] = useState("variantes");
  const [query, setQuery] = useState("");
  const [copias, setCopias] = useState(1);
  const [variantes, setVariantes] = useState([]);
  const [bicicletas, setBicicletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError("");

    try {
      const [variantesData, bicicletasData] = await Promise.all([
        listarVariantes(),
        listarSerializadas(),
      ]);
      setVariantes(variantesData || []);
      setBicicletas(bicicletasData || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos para etiquetas");
    } finally {
      setLoading(false);
    }
  }

  const resultados = useMemo(() => {
    const texto = normalizar(query);
    const source = modo === "variantes" ? variantes : bicicletas;

    return source
      .filter((item) => {
        if (!texto) return true;

        const haystack =
          modo === "variantes"
            ? [
                item.producto_nombre,
                item.nombre_variante,
                item.sku,
                item.codigo_barras,
                item.codigo_proveedor,
                item.categoria_nombre,
              ].join(" ")
            : [
                item.producto_nombre,
                item.nombre_variante,
                item.numero_cuadro,
                item.sku,
                item.codigo_barras,
                item.codigo_proveedor,
                item.estado,
                item.sucursal_nombre,
              ].join(" ");

        return normalizar(haystack).includes(texto);
      })
      .slice(0, 80);
  }, [bicicletas, modo, query, variantes]);

  function imprimirDeposito(item) {
    const cantidad = Number(copias) || 1;
    const url =
      modo === "variantes"
        ? getEtiquetaDepositoVarianteUrl(item.id, cantidad)
        : getEtiquetaDepositoBicicletaUrl(item.id, cantidad);
    abrirPdf(url);
  }

  function imprimirPrecioA4(item) {
    const url =
      modo === "variantes"
        ? getPrecioA4VarianteUrl(item.id)
        : getPrecioA4BicicletaUrl(item.id);
    abrirPdf(url);
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Deposito y mostrador</p>
          <h1 style={styles.title}>Etiquetas</h1>
        </div>
        <button type="button" onClick={cargarDatos} style={styles.refreshButton}>
          <Printer size={18} />
          Recargar
        </button>
      </header>

      <section style={isMobile ? styles.toolbarMobile : styles.toolbar}>
        <div style={styles.segmented}>
          <button
            type="button"
            onClick={() => setModo("variantes")}
            style={modo === "variantes" ? styles.segmentActive : styles.segment}
          >
            <Tags size={17} />
            Productos
          </button>
          <button
            type="button"
            onClick={() => setModo("bicicletas")}
            style={modo === "bicicletas" ? styles.segmentActive : styles.segment}
          >
            <Barcode size={17} />
            Bicicletas
          </button>
        </div>

        <label style={styles.searchBox}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, codigo, sku o cuadro"
            style={styles.searchInput}
          />
        </label>

        <label style={styles.copyBox}>
          Copias
          <input
            type="number"
            min="1"
            max="50"
            value={copias}
            onChange={(event) => setCopias(event.target.value)}
            style={styles.copyInput}
          />
        </label>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {loading && <div style={styles.empty}>Cargando etiquetas...</div>}

      {!loading && (
        <section style={styles.list}>
          {resultados.map((item) => (
            <article key={`${modo}-${item.id}`} style={isMobile ? styles.rowMobile : styles.row}>
              <div style={styles.itemMain}>
                <strong style={styles.itemTitle}>
                  {modo === "variantes" ? descripcionVariante(item) : descripcionBicicleta(item)}
                </strong>
                <span style={styles.itemMeta}>
                  {modo === "variantes"
                    ? [
                        item.categoria_nombre,
                        item.sku ? `SKU ${item.sku}` : null,
                        item.codigo_proveedor ? `Prov. ${item.codigo_proveedor}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : [
                        item.estado,
                        item.sucursal_nombre,
                        item.sku ? `SKU ${item.sku}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              </div>

              <div style={isMobile ? styles.priceBoxMobile : styles.priceBox}>
                <span style={styles.priceLabel}>Minorista</span>
                <strong>{formatMoney(item.precio_minorista || 0)}</strong>
              </div>

              <div style={isMobile ? styles.actionsMobile : styles.actions}>
                <button type="button" onClick={() => imprimirDeposito(item)} style={styles.primaryButton}>
                  <Barcode size={17} />
                  80x40
                </button>
                <button type="button" onClick={() => imprimirPrecioA4(item)} style={styles.secondaryButton}>
                  <FileText size={17} />
                  A4 precio
                </button>
              </div>
            </article>
          ))}

          {resultados.length === 0 && (
            <div style={styles.empty}>No encontre resultados para esa busqueda.</div>
          )}
        </section>
      )}
    </main>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 18,
    padding: 24,
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  kicker: {
    margin: "0 0 4px",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.1,
  },
  refreshButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "auto minmax(220px, 1fr) auto",
    gap: 12,
    alignItems: "center",
  },
  toolbarMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    alignItems: "stretch",
  },
  segmented: {
    display: "flex",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
    background: "#ffffff",
  },
  segment: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: 0,
    background: "transparent",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
    color: "#475569",
  },
  segmentActive: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: 0,
    background: "#0f172a",
    padding: "10px 12px",
    fontWeight: 900,
    cursor: "pointer",
    color: "#ffffff",
  },
  searchBox: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: 8,
    padding: "0 12px",
  },
  searchInput: {
    width: "100%",
    minWidth: 0,
    border: 0,
    outline: 0,
    padding: "11px 0",
    fontSize: 14,
  },
  copyBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },
  copyInput: {
    width: 70,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "10px 8px",
    fontWeight: 800,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) 130px auto",
    gap: 12,
    alignItems: "center",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 14,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },
  rowMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    alignItems: "stretch",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 14,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },
  itemMain: {
    minWidth: 0,
    display: "grid",
    gap: 5,
  },
  itemTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemMeta: {
    color: "#64748b",
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  priceBox: {
    display: "grid",
    gap: 3,
    justifyItems: "end",
  },
  priceBoxMobile: {
    display: "grid",
    gap: 3,
    justifyItems: "start",
  },
  priceLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  actionsMobile: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid #ea580c",
    background: "#f97316",
    color: "#ffffff",
    borderRadius: 8,
    padding: "9px 11px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 8,
    padding: "9px 11px",
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: 12,
    fontWeight: 800,
  },
  empty: {
    border: "1px dashed #cbd5e1",
    background: "#ffffff",
    color: "#64748b",
    borderRadius: 8,
    padding: 18,
    fontWeight: 800,
    textAlign: "center",
  },
};
