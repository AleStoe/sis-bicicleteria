import {
  FICHA_TECNICA_BICICLETA,
  getCamposPorGrupo,
} from "../../../constants/fichaTecnicaBicicleta";

function normalizarGrupo(grupo) {
  const limpio = String(grupo || "").trim().toLowerCase();

  const encontrado = FICHA_TECNICA_BICICLETA.find(
    (item) => item.grupo.toLowerCase() === limpio
  );

  return encontrado?.grupo || grupo || "";
}

export default function BicicletaFichaTecnicaForm({
  items,
  onAdd,
  onChange,
  onRemove,
}) {
  return (
    <section style={styles.section}>
      <div style={styles.rowBetween}>
        <div>
          <h2 style={styles.cardTitle}>Ficha técnica</h2>
          <p style={styles.muted}>
            No bloquea la venta. Usala para mejorar catálogo, ficha del producto
            y atención al cliente.
          </p>
        </div>

        <button type="button" onClick={onAdd} style={styles.secondaryButton}>
          + Agregar componente
        </button>
      </div>

      <div style={styles.rows}>
        {items.map((item, index) => {
          const grupoNormalizado = normalizarGrupo(item.grupo);
          const camposDisponibles = getCamposPorGrupo(grupoNormalizado);

          return (
            <div key={index} style={styles.fichaRow}>
              <select
                style={styles.input}
                value={grupoNormalizado}
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
                onChange={(e) => onChange(index, "clave", e.target.value)}
                disabled={!grupoNormalizado}
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
                onChange={(e) => onChange(index, "valor", e.target.value)}
                placeholder="Valor"
              />

              <button
                type="button"
                onClick={() => onRemove(index)}
                style={styles.dangerButton}
              >
                Quitar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: "14px",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
  },
  muted: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  rows: {
    display: "grid",
    gap: "10px",
  },
  fichaRow: {
    display: "grid",
    gridTemplateColumns: "180px 240px 1fr auto",
    gap: "8px",
    alignItems: "center",
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
  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "11px 13px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerButton: {
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
