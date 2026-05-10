export default function VentaItemVendidoAcciones({
  venta,
  item,
  procesando,
  onDevolverItem,
  onDevolverSerializada,
}) {
  if (venta.estado !== "entregada") {
    return null;
  }

  return (
    <div style={actionsRowStyle}>
      <button
        onClick={() => onDevolverItem(item)}
        disabled={procesando}
        style={secondaryBtnStyle}
      >
        Devolver item
      </button>

      {item.id_bicicleta_serializada && (
        <button
          onClick={() => onDevolverSerializada(item)}
          disabled={procesando}
          style={warnBtnStyle}
        >
          Devolver serializada
        </button>
      )}
    </div>
  );
}

const actionsRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const warnBtnStyle = {
  border: "1px solid #f3dc97",
  background: "#fff8e1",
  color: "#8a6d00",
  borderRadius: "10px",
  padding: "10px 12px",
  fontWeight: 800,
  cursor: "pointer",
};