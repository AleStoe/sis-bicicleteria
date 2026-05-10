export default function VentaItemSerializadaPanel({
  item,
  bicicletasDisponibles,
  seleccionarSerializada,
  limpiarSerializada,
}) {
  const serialSeleccionada = item.id_bicicleta_serializada;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>
            Bicicleta serializada
          </div>

          <div style={styles.subtitle}>
            Seleccioná un número de cuadro disponible
          </div>
        </div>

        {serialSeleccionada && (
          <span style={styles.badgeOk}>
            Serializada seleccionada
          </span>
        )}
      </div>

      <div style={styles.selectorWrap}>
        <select
          value={serialSeleccionada || ""}
          onChange={(e) => {
            const value = e.target.value;

            if (!value) {
              limpiarSerializada();
              return;
            }

            seleccionarSerializada(Number(value));
          }}
          style={styles.select}
        >
          <option value="">
            Seleccionar número de cuadro
          </option>

          {bicicletasDisponibles.map((bici) => (
            <option
              key={bici.id}
              value={bici.id}
            >
              #{bici.id} · {bici.numero_cuadro}
            </option>
          ))}
        </select>

        {serialSeleccionada && (
          <button
            type="button"
            onClick={limpiarSerializada}
            style={styles.clearBtn}
          >
            Limpiar
          </button>
        )}
      </div>

      {bicicletasDisponibles.length === 0 && (
        <div style={styles.warningBox}>
          No hay bicicletas serializadas disponibles
          para esta variante.
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    border: "1px solid #eaecf0",
    background: "#f9fafb",
    borderRadius: 10,
    padding: 10,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },

  title: {
    fontSize: 12,
    fontWeight: 900,
    color: "#344054",
  },

  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
  },

  badgeOk: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 900,
  },

  selectorWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  select: {
    flex: 1,
    minWidth: 260,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "9px 10px",
    fontSize: 13,
    background: "white",
  },

  clearBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "white",
    color: "#344054",
    fontWeight: 800,
    padding: "8px 10px",
    cursor: "pointer",
  },

  warningBox: {
    marginTop: 10,
    borderRadius: 8,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
};