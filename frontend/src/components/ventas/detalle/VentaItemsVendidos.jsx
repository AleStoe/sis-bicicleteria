import VentaItemVendidoCard from "./VentaItemVendidoCard";

export default function VentaItemsVendidos({
  venta,
  items,
  procesando,
  onDevolverItem,
  onDevolverSerializada,
}) {
  return (
    <section style={itemsCardStyle}>
      <div style={itemsHeaderStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Items vendidos</h2>

          <span style={mutedStyle}>
            Productos y bicicletas asociados a la venta.
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "18px" }}>La venta no tiene items.</div>
      ) : (
        <div style={itemsGridStyle}>
          {items.map((item) => (
            <VentaItemVendidoCard
              key={item.id}
              venta={venta}
              item={item}
              procesando={procesando}
              onDevolverItem={onDevolverItem}
              onDevolverSerializada={onDevolverSerializada}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const itemsCardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
};

const itemsHeaderStyle = {
  marginBottom: "16px",
};

const itemsGridStyle = {
  display: "grid",
  gap: "14px",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
};