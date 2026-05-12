export default function AltaMercaderiaImagenUpload({ form, setForm }) {
  return (
    <>
      <label style={styles.label}>
        Imagen del producto
        <input
          style={styles.input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const archivo = e.target.files?.[0] || null;

            if (!archivo) {
              setForm((p) => ({
                ...p,
                imagen_archivo: null,
                imagen_preview: "",
              }));
              return;
            }

            setForm((p) => ({
              ...p,
              imagen_archivo: archivo,
              imagen_preview: URL.createObjectURL(archivo),
            }));
          }}
        />
      </label>

      {form.imagen_preview && (
        <img src={form.imagen_preview} alt="Preview" style={styles.preview} />
      )}
    </>
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
  preview: {
    width: "100%",
    maxHeight: "220px",
    objectFit: "contain",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#f9fafb",
  },
};