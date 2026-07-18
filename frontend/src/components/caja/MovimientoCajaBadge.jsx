export default function MovimientoCajaBadge({ movimiento }) {
  const label = getMovimientoLabel(movimiento);
  const tone = getMovimientoTone(movimiento);

  return (
    <span
      style={{
        ...styles.badge,
        ...(tone === "danger" ? styles.danger : null),
        ...(tone === "warning" ? styles.warning : null),
        ...(tone === "success" ? styles.success : null),
      }}
    >
      {label}
    </span>
  );
}

export function getMovimientoLabel(movimiento) {
  if (movimiento.origen_tipo === "correccion_operativa") {
    return movimiento.tipo_movimiento === "egreso"
      ? "Egreso por correccion"
      : "Correccion operativa";
  }

  if (movimiento.tipo_movimiento === "ajuste") {
    return movimiento.direccion_ajuste === "negativo"
      ? "Ajuste negativo"
      : "Ajuste positivo";
  }

  if (movimiento.tipo_movimiento === "egreso") return "Egreso";
  if (movimiento.tipo_movimiento === "ingreso") return "Ingreso";

  return movimiento.tipo_movimiento || "-";
}

export function getMovimientoMontoColor(movimiento) {
  if (movimiento.tipo_movimiento === "egreso") return "#b42318";

  if (movimiento.tipo_movimiento === "ajuste") {
    return movimiento.direccion_ajuste === "negativo" ? "#b42318" : "#027a48";
  }

  return "#027a48";
}

function getMovimientoTone(movimiento) {
  if (movimiento.origen_tipo === "correccion_operativa") return "warning";

  if (movimiento.tipo_movimiento === "egreso") return "danger";

  if (movimiento.tipo_movimiento === "ajuste") {
    return movimiento.direccion_ajuste === "negativo" ? "danger" : "warning";
  }

  return "success";
}

const styles = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 800,
    background: "#f2f4f7",
    color: "#344054",
    border: "1px solid #eaecf0",
  },
  success: {
    background: "#ecfdf3",
    color: "#027a48",
    borderColor: "#abefc6",
  },
  danger: {
    background: "#fff1f0",
    color: "#b42318",
    borderColor: "#f4c7c3",
  },
  warning: {
    background: "#fff7ed",
    color: "#9a3412",
    borderColor: "#fdba74",
  },
};
