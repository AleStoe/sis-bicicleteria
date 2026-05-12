export default function AltaMercaderiaProveedorSelect({
  form,
  setCampo,
  proveedores,
}) {
  return (
    <label style={styles.label}>
      Proveedor *
      <select
        style={styles.input}
        value={form.id_proveedor}
        onChange={(e) => setCampo("id_proveedor", e.target.value)}
      >
        <option value="">Seleccionar proveedor...</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            #{p.id} - {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

const styles = {
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
};