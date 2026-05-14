import {
  FICHA_TECNICA_BICICLETA,
  getCamposPorGrupo,
} from "../../constants/fichaTecnicaBicicleta";

export default function FichaTecnicaEditor({
  items,
  procesando,
  onChange,
  onAdd,
  onRemove,
  onSave,
}) {
  return (
    <form onSubmit={onSave} style={styles.box}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Ficha técnica</h3>

          <div style={styles.subtitle}>
            Componentes y especificaciones del producto.
          </div>
        </div>

        <button type="button" onClick={onAdd} style={styles.secondaryButton}>
          + Agregar
        </button>
      </div>

      {items.length === 0 ? (
        <div style={styles.empty}>Sin componentes cargados.</div>
      ) : (
        items.map((item, index) => {
          const camposDisponibles = getCamposPorGrupo(item.grupo);

          return (
            <div key={item.id ?? index} style={styles.row}>
              <select
                style={styles.input}
                value={item.grupo || ""}
                onChange={(e) => {
                  onChange(index, "grupo", e.target.value);
                  onChange(index, "clave", "");
                }}
              >
                <option value="">Grupo</option>

                {FICHA_TECNICA_BICICLETA.map((grupo) => (
                  <option key={grupo.grupo} value={grupo.grupo}>
                    {grupo.grupo}
                  </option>
                ))}
              </select>

              <select
                style={styles.input}
                value={item.clave || ""}
                onChange={(e) =>
                  onChange(index, "clave", e.target.value)
                }
                disabled={!item.grupo}
              >
                <option value="">Campo</option>

                {camposDisponibles.map((campo) => (
                  <option key={campo} value={campo}>
                    {campo}
                  </option>
                ))}
              </select>

              <input
                style={styles.input}
                value={item.valor || ""}
                onChange={(e) =>
                  onChange(index, "valor", e.target.value)
                }
                placeholder="Valor"
              />

              <button
                type="button"
                onClick={() => onRemove(index)}
                style={styles.dangerButton}
              >
                X
              </button>
            </div>
          );
        })
      )}

      <button
        type="submit"
        disabled={procesando}
        style={styles.primaryButton}
      >
        {procesando ? "Guardando..." : "Guardar ficha técnica"}
      </button>
    </form>
  );
}

const styles = {
  box: {
    display: "grid",
    gap: "12px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "start",
  },

  title: {
    margin: 0,
    fontSize: "18px",
  },

  subtitle: {
    color: "#667085",
    fontSize: "13px",
    marginTop: "4px",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.5fr auto",
    gap: "8px",
    alignItems: "center",
  },

  input: {
    width: "100%",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    boxSizing: "border-box",
    background: "white",
  },

  empty: {
    color: "#667085",
    fontSize: "13px",
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "12px",
  },

  primaryButton: {
    border: "none",
    background: "#0b5bd3",
    color: "white",
    borderRadius: "10px",
    padding: "11px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: "10px",
    padding: "9px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  dangerButton: {
    border: "none",
    background: "#b42318",
    color: "white",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};