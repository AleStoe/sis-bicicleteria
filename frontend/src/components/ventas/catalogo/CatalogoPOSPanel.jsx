import ProductoPOSCard from "./ProductoPOSCard";

export default function CatalogoPOSPanel({
  query,
  categoriaId,
  categorias,
  catalogo,
  buscando,
  tipoPrecio,
  onQueryChange,
  onBuscarEnter,
  onRecargarCatalogo,
  onCategoriaChange,
  onAgregarItem,
  isMobile = false,
}) {
  const categoriasVisibles = categorias.filter((categoria) => {
    return categoria.nombre?.trim().toLowerCase() !== "servicios";
  });

  const catalogoVisible = catalogo.filter((producto) => {
    if (producto.tipo_item && producto.tipo_item !== "producto") return false;
    if (!producto.stockeable) return true;
    return Number(producto.stock_disponible || 0) > 0;
  });
  return (
    <section style={{ ...leftPanelStyle, ...(isMobile ? mobileLeftPanelStyle : {}) }}>
      <div style={{ ...searchRowStyle, ...(isMobile ? mobileSearchRowStyle : {}) }}>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onBuscarEnter}
          placeholder="Producto, talle, SKU o código de barras"
          style={{ ...searchStyle, ...(isMobile ? mobileSearchStyle : {}) }}
        />
        <button onClick={onRecargarCatalogo} style={iconButtonStyle} disabled={buscando}>
          {buscando ? "..." : "↻"}
        </button>
      </div>

      <div style={categoryFilterStyle}>
        <label style={categoryLabelStyle}>Categoría</label>
        <select
          value={categoriaId || ""}
          onChange={(e) => onCategoriaChange(e.target.value)}
          style={categorySelectStyle}
        >
          <option value="">Todas las categorías</option>
          {categoriasVisibles.map((categoria) => (
            <option key={categoria.id} value={String(categoria.id)}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...catalogListStyle, ...(isMobile ? mobileCatalogListStyle : {}) }}>
        {catalogoVisible.length === 0 ? (
          <div style={emptyStyle}>No hay productos para mostrar.</div>
        ) : (
          catalogoVisible.map((producto) => (
            <ProductoPOSCard
              key={producto.id_variante}
              producto={producto}
              tipoPrecio={tipoPrecio}
              onAgregarItem={onAgregarItem}
            />
          ))
        )}
      </div>
    </section>
  );
}

const leftPanelStyle = {
  background: "white",
  borderRadius: "14px",
  padding: "14px",
  boxShadow: "0 2px 10px rgba(16,24,40,.08)",
  minWidth: 0,
};

const searchRowStyle = { display: "flex", gap: "8px", marginBottom: "12px" };

const searchStyle = {
  flex: 1,
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "11px 12px",
};

const iconButtonStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "white",
  padding: "0 14px",
};

const categoryRowStyle = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "10px",
  marginBottom: "8px",
};

const categoryStyle = {
  whiteSpace: "nowrap",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "#f9fafb",
  color: "#344054",
  fontWeight: 700,
};

const activeCategoryStyle = {
  ...categoryStyle,
  background: "#0b5bd3",
  color: "white",
  borderColor: "#0b5bd3",
};

const catalogListStyle = {
  display: "grid",
  gap: "10px",
  maxHeight: "calc(100vh - 210px)",
  overflowY: "auto",
  paddingRight: "4px",
};

const emptyStyle = {
  padding: "40px",
  textAlign: "center",
  color: "#667085",
};


const mobileLeftPanelStyle = {
  borderRadius: "16px",
  padding: "10px",
};

const mobileSearchRowStyle = {
  gap: "6px",
  marginBottom: "10px",
};

const mobileSearchStyle = {
  minWidth: 0,
  fontSize: 14,
};

const mobileCatalogListStyle = {
  maxHeight: "none",
  overflowY: "visible",
  paddingRight: 0,
};

const categoryFilterStyle = {
  display: "grid",
  gap: "6px",
  marginBottom: "10px",
};

const categoryLabelStyle = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#475467",
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const categorySelectStyle = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "white",
  color: "#111827",
  fontWeight: 700,
  boxSizing: "border-box",
};