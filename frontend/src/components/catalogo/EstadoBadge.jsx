export default function EstadoBadge({ item }) {
  if (item.disponible_para_venta) {
    return <span style={styles.ok}>Disponible</span>;
  }

  if (item.motivo_no_disponible === "sin_stock") {
    return <span style={styles.warning}>Pendiente armado</span>;
  }

  if (item.motivo_no_disponible === "precio_no_definido") {
    return <span style={styles.warning}>Sin precio</span>;
  }

  return <span style={styles.warning}>Revisar</span>;
}

const base = {
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 1000,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const styles = {
  ok: {
    ...base,
    background: "#dcfce7",
    color: "#047857",
  },
  warning: {
    ...base,
    background: "#fef3c7",
    color: "#b45309",
  },
  danger: {
    ...base,
    background: "#fee2e2",
    color: "#b42318",
  },
};
