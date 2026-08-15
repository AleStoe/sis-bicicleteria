import VentaItemRow from "./VentaItemRow";

export default function CarritoVentaPanel({
  items,
  serializadasPorVariante,
  cargandoSerializadas,
  onCargarSerializadas,
  onSeleccionarSerializada,
  onCambiarCantidad,
  onQuitarItem,
  onActualizarItem,
}) {
  return (
    <section style={cartStyle}>
      {items.length === 0 ? (
        <div style={emptyCartStyle}>Agregá productos desde el listado.</div>
      ) : (
        items.map((item, index) => (
          <VentaItemRow
            key={item.line_id}
            item={item}
            index={index}
            serializadasPorVariante={serializadasPorVariante}
            cargandoSerializadas={cargandoSerializadas}
            onCargarSerializadas={onCargarSerializadas}
            onSeleccionarSerializada={onSeleccionarSerializada}
            onCambiarCantidad={onCambiarCantidad}
            onQuitarItem={onQuitarItem}
            onActualizarItem={onActualizarItem}
            />
        ))
      )}
    </section>
  );
}

const cartStyle = {
  display: "grid",
  gap: 10,
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  background: "#f8fafc",
  padding: 8,
  overflowY: "auto",
  minHeight: "240px",
  maxHeight: "46vh",
  marginBottom: "12px",
};

const emptyCartStyle = {
  minHeight: "240px",
  display: "grid",
  placeItems: "center",
  color: "#667085",
};
