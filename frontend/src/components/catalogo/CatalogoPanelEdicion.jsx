export default function CatalogoPanelEdicion({
  seleccionado,
  productoForm,
  form,
  imagenUrl,
  categorias,
  marcas,
  procesando,
  onCerrar,
  onGuardarProducto,
  onGuardarVariante,
  onGuardarImagen,
  onToggleEstado,
  setProductoForm,
  setForm,
  setImagenUrl,
}) {
  if (!seleccionado || !productoForm || !form) {
    return null;
  }

  return (
    <aside style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Editar catálogo</h2>

          <div style={mutedSmallStyle}>
            {seleccionado.producto_nombre}
          </div>
        </div>

        <button type="button" onClick={onCerrar}>
          ✕
        </button>
      </div>

      <form onSubmit={onGuardarProducto} style={panelSectionStyle}>
        <h3 style={sectionTitleStyle}>Producto</h3>

        <label style={labelStyle}>
          Nombre producto

          <input
            style={inputStyle}
            value={productoForm.nombre}
            onChange={(e) =>
              setProductoForm((p) => ({
                ...p,
                nombre: e.target.value,
              }))
            }
          />
        </label>

        <label style={labelStyle}>
          Categoría

          <select
            style={inputStyle}
            value={productoForm.id_categoria}
            onChange={(e) =>
              setProductoForm((p) => ({
                ...p,
                id_categoria: e.target.value,
              }))
            }
          >
            <option value="">Seleccionar...</option>

            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Marca

          <select
            style={inputStyle}
            value={productoForm.id_marca || ""}
            onChange={(e) =>
              setProductoForm((p) => ({
                ...p,
                id_marca: e.target.value,
              }))
            }
          >
            <option value="">Sin marca</option>

            {marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {marca.nombre}
              </option>
            ))}
          </select>
        </label>

        <button disabled={procesando}>
          Guardar producto
        </button>
      </form>

      <form onSubmit={onGuardarVariante} style={panelSectionStyle}>
        <h3 style={sectionTitleStyle}>Variante</h3>

        <label style={labelStyle}>
          Nombre variante

          <input
            style={inputStyle}
            value={form.nombre_variante}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                nombre_variante: e.target.value,
              }))
            }
          />
        </label>

        <label style={labelStyle}>
          IVA

          <input
            style={inputStyle}
            type="number"
            step="0.01"
            value={form.alicuota_iva}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                alicuota_iva: e.target.value,
              }))
            }
          />
        </label>

        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={form.gravado}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                gravado: e.target.checked,
              }))
            }
          />

          Gravado
        </label>

        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={form.permite_precio_libre}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                permite_precio_libre: e.target.checked,
              }))
            }
          />

          Permite precio libre
        </label>

        <button disabled={procesando}>
          Guardar variante
        </button>
      </form>

      <form onSubmit={onGuardarImagen} style={panelSectionStyle}>
        <h3 style={sectionTitleStyle}>Imagen principal</h3>

        <label style={labelStyle}>
          URL imagen

          <input
            style={inputStyle}
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <button disabled={procesando}>
          Guardar imagen
        </button>
      </form>

      <div style={panelSectionStyle}>
        <h3 style={sectionTitleStyle}>Estado</h3>

        <button
          type="button"
          disabled={procesando}
          onClick={onToggleEstado}
        >
          {seleccionado.activo
            ? "Desactivar variante"
            : "Activar variante"}
        </button>
      </div>
    </aside>
  );
}

const panelStyle = {
  width: "360px",
  background: "#fff",
  borderLeft: "1px solid #eaecf0",
  padding: "18px",
  overflowY: "auto",
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  marginBottom: "18px",
};

const panelSectionStyle = {
  marginBottom: "24px",
  display: "grid",
  gap: "12px",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "16px",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  fontSize: "14px",
};

const inputStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "14px",
};

const checkboxStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const mutedSmallStyle = {
  color: "#667085",
  fontSize: "13px",
  marginTop: "4px",
};