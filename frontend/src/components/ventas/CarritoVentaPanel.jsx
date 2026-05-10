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
            key={`${item.id_variante}-${index}`}
            item={item}
            index={index}
            items={items}
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
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  overflow: "hidden",
  minHeight: "240px",
  marginBottom: "12px",
};

const emptyCartStyle = {
  minHeight: "240px",
  display: "grid",
  placeItems: "center",
  color: "#667085",
};
