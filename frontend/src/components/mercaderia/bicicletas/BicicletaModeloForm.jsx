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
      <h2 style={styles.cardTitle}>Modelo base</h2>

      <div style={styles.grid}>
        <label style={styles.label}>
          Categoría *
          <select
            style={styles.input}
            value={form.id_categoria}
            onChange={(e) => setCampo("id_categoria", e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

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

        <label style={styles.label}>
          Modelo *
          <input
            style={styles.input}
            value={form.modelo}
            onChange={(e) => setCampo("modelo", e.target.value)}
            placeholder="REGAL"
          />
        </label>

        <label style={styles.label}>
          Rodado
          <input
            style={styles.input}
            value={form.rodado}
            onChange={(e) => setCampo("rodado", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Tipo bicicleta
          <input
            style={styles.input}
            value={form.tipo_bicicleta}
            onChange={(e) => setCampo("tipo_bicicleta", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Material cuadro
          <input
            style={styles.input}
            value={form.material_cuadro}
            onChange={(e) => setCampo("material_cuadro", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Transmisión / velocidades
          <input
            style={styles.input}
            value={form.transmision}
            onChange={(e) => setCampo("transmision", e.target.value)}
          />
        </label>
      </div>

      <div style={styles.previewBox}>
        <span>Nombre generado</span>
        <strong>{nombreProducto || "Completá los datos del modelo"}</strong>
      </div>
    </section>
  );
}

const styles = {
  section: { display: "grid", gap: "14px" },
  cardTitle: { margin: 0, fontSize: "20px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 700,
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  previewBox: {
    display: "grid",
    gap: "4px",
    background: "#eef4ff",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "12px",
  },
};