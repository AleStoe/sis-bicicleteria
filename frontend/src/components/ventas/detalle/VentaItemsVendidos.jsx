import { formatMoney } from "../../../pages/VentasListPage";

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
          <h2 style={{ margin: 0, fontSize: "20px" }}>
            Items vendidos
          </h2>

          <span style={mutedStyle}>
            Productos y bicicletas asociados a la venta.
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "18px" }}>
          La venta no tiene items.
        </div>
      ) : (
        <div style={itemsGridStyle}>
          {items.map((item) => (
            <div key={item.id} style={itemCardStyle}>
              <div style={itemTopStyle}>
                <div>
                  <strong style={{ fontSize: "16px" }}>
                    {item.descripcion_snapshot}
                  </strong>

                  <div style={mutedInlineStyle}>
                    Item #{item.id} · Variante #{item.id_variante}
                  </div>
                </div>

                <div style={priceBoxStyle}>
                  <span>Subtotal</span>
                  <strong>{formatMoney(item.subtotal)}</strong>
                </div>
              </div>

              <div style={specsGridStyle}>
                <Spec
                  label="Cantidad"
                  value={Number(item.cantidad).toLocaleString("es-AR")}
                />

                <Spec
                  label="Precio lista"
                  value={formatMoney(item.precio_lista)}
                />

                <Spec
                  label="Precio final"
                  value={formatMoney(item.precio_final)}
                />

                <Spec
                  label="Serializada"
                  value={
                    item.id_bicicleta_serializada
                      ? `#${item.id_bicicleta_serializada}`
                      : "-"
                  }
                />
              </div>

              {(item.bonificado || item.motivo_precio_manual) && (
                <div style={badgesRowStyle}>
                  {item.bonificado && (
                    <div style={bonusBadgeStyle}>
                      Bonificado
                    </div>
                  )}

                  {item.motivo_precio_manual && (
                    <div style={manualPriceBadgeStyle}>
                      Precio manual
                    </div>
                  )}
                </div>
              )}

              {venta.estado === "entregada" && (
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
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Spec({ label, value }) {
  return (
    <div style={specStyle}>
      <span style={specLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
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

const itemCardStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "16px",
  background: "#fcfcfd",
  display: "grid",
  gap: "14px",
};

const itemTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const priceBoxStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "10px 14px",
  display: "grid",
  gap: "4px",
  textAlign: "right",
};

const specsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const specStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "10px",
  display: "grid",
  gap: "4px",
};

const specLabelStyle = {
  fontSize: "12px",
  color: "#667085",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
};

const mutedInlineStyle = {
  color: "#667085",
  fontSize: "13px",
  marginTop: "4px",
};

const badgesRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const bonusBadgeStyle = {
  display: "inline-block",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: 800,
};

const manualPriceBadgeStyle = {
  display: "inline-block",
  background: "#fff8e1",
  color: "#8a6d00",
  border: "1px solid #f3dc97",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: 800,
};

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