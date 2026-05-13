export default function EstadoBadge({ item }) {
  if (item.disponible_para_venta) {
    return <span style={styles.ok}>Disponible</span>;
  }

  if (item.motivo_no_disponible === "sin_stock") {
    return <span style={styles.danger}>Sin stock</span>;
  }

  if (item.motivo_no_disponible === "precio_no_definido") {
    return <span style={styles.warning}>Sin precio</span>;
  }

  return <span style={styles.warning}>Revisar</span>;
}

const base = {
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};

const styles = {
  ok: {
    ...base,
    background: "#ecfdf3",
    color: "#067647",
  },
  warning: {
    ...base,
    background: "#fffaeb",
    color: "#b54708",
  },
  danger: {
    ...base,
    background: "#fff1f0",
    color: "#b42318",
  },
};