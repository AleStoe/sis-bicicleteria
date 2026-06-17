import { useBreakpoint } from "../../ui";
import VentaItemVendidoCard from "./VentaItemVendidoCard";

export default function VentaItemsVendidos({
  venta,
  items,
  procesando,
  onDevolverItem,
  onDevolverSerializada,
}) {
  const { isMobile } = useBreakpoint();
  const totalItems = items.length;
  const totalUnidades = items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );
  const totalBicicletas = items.filter((item) => item.id_bicicleta_serializada).length;

  return (
    <section style={{ ...itemsCardStyle, ...(isMobile ? itemsCardMobileStyle : {}) }}>
      <div style={{ ...itemsHeaderStyle, ...(isMobile ? itemsHeaderMobileStyle : {}) }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? "18px" : "20px" }}>Items vendidos</h2>

          <span style={mutedStyle}>
            {totalItems} item{totalItems === 1 ? "" : "s"} - {totalUnidades} unidad
            {totalUnidades === 1 ? "" : "es"}
            {totalBicicletas > 0 ? ` - ${totalBicicletas} bici${totalBicicletas === 1 ? "" : "s"}` : ""}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "18px" }}>La venta no tiene items.</div>
      ) : (
        <div style={{ ...itemsGridStyle, ...(isMobile ? itemsGridMobileStyle : {}) }}>
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
  background: "#ffffff",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "18px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const itemsCardMobileStyle = {
  padding: "14px",
  borderRadius: "16px",
};

const itemsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px",
};

const itemsHeaderMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
};

const mutedStyle = {
  display: "block",
  marginTop: "4px",
  color: "#667085",
  fontSize: "13px",
  fontWeight: 700,
};

const itemsGridStyle = {
  display: "grid",
  gap: "12px",
};

const itemsGridMobileStyle = {
  gap: "10px",
};
