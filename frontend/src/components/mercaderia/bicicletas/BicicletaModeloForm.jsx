export default function BicicletaModeloForm({
  form,
  setCampo,
  categorias,
  marcas,
  proveedores,
  nombreProducto,
}) {
  return (
    <section style={styles.section}>
      <div style={styles.previewBox}>
        <span>Nombre generado</span>
        <strong>{nombreProducto || "Completá marca, modelo y datos base"}</strong>
      </div>

      <div style={styles.gridPrimary}>
        <div style={styles.readOnlyField}>
          <span style={styles.readOnlyLabel}>Categoría</span>
          <strong>Bicicletas</strong>
        </div>

        <label style={styles.label}>
          Marca *
          <select
            style={styles.input}
            value={form.id_marca}
            onChange={(e) => setCampo("id_marca", e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Proveedor *
          <select
            style={styles.input}
            value={form.id_proveedor}
            onChange={(e) => setCampo("id_proveedor", e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id} - {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.gridPrimary}>
        <label style={styles.label}>
          Modelo *
          <input
            style={styles.input}
            value={form.modelo}
            onChange={(e) => setCampo("modelo", e.target.value)}
            placeholder="Ej: Regal, Tigris, Svel"
          />
        </label>

        <label style={styles.label}>
          Rodado
          <input
            style={styles.input}
            value={form.rodado}
            onChange={(e) => setCampo("rodado", e.target.value)}
            placeholder="29"
          />
        </label>

        <label style={styles.label}>
          Tipo bicicleta
          <input
            style={styles.input}
            value={form.tipo_bicicleta}
            onChange={(e) => setCampo("tipo_bicicleta", e.target.value)}
            placeholder="MTB"
          />
        </label>
      </div>

      <div style={styles.gridSecondary}>
        <label style={styles.label}>
          Material cuadro
          <input
            style={styles.input}
            value={form.material_cuadro}
            onChange={(e) => setCampo("material_cuadro", e.target.value)}
            placeholder="Aluminio"
          />
        </label>

        <label style={styles.label}>
          Transmisión / velocidades
          <input
            style={styles.input}
            value={form.transmision}
            onChange={(e) => setCampo("transmision", e.target.value)}
            placeholder="21V Shimano Tourney"
          />
        </label>
      </div>
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: "14px",
  },
  gridPrimary: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  gridSecondary: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 800,
    fontSize: "13px",
  },
  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
  },
  previewBox: {
    display: "grid",
    gap: "4px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    padding: "14px",
  },
  readOnlyField: {
  display: "grid",
  gap: "4px",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "#f9fafb",
},

readOnlyLabel: {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
},
};
