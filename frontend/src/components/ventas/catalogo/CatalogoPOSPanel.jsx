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
}) {
  return (
    <section style={leftPanelStyle}>
      <div style={searchRowStyle}>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onBuscarEnter}
          placeholder="Producto, talle, SKU o código de barras"
          style={searchStyle}
        />
        <button onClick={onRecargarCatalogo} style={iconButtonStyle} disabled={buscando}>
          {buscando ? "..." : "↻"}
        </button>
      </div>

      <div style={categoryRowStyle}>
        <button
          type="button"
          onClick={() => onCategoriaChange("")}
          style={!categoriaId ? activeCategoryStyle : categoryStyle}
        >
          Todos
        </button>

        {categorias.map((categoria) => (
          <button
            key={categoria.id}
            type="button"
            onClick={() => onCategoriaChange(String(categoria.id))}
            style={String(categoriaId) === String(categoria.id) ? activeCategoryStyle : categoryStyle}
          >
            {categoria.nombre}
          </button>
        ))}
      </div>

      <div style={catalogListStyle}>
        {catalogo.length === 0 ? (
          <div style={emptyStyle}>No hay productos para mostrar.</div>
        ) : (
          catalogo.map((producto) => (
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
