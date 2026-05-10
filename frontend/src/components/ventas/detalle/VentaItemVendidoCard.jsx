import { formatMoney } from "../../../pages/VentasListPage";
import VentaItemVendidoAcciones from "./VentaItemVendidoAcciones";

export default function VentaItemVendidoCard({
  venta,
  item,
  procesando,
  onDevolverItem,
  onDevolverSerializada,
}) {
  const cantidadDevuelta = Number(item.cantidad_devuelta || 0);
  const cantidadVendida = Number(item.cantidad || 0);

  const devueltoTotal =
    item.devuelto_total || cantidadDevuelta >= cantidadVendida;

  const devueltoParcial = cantidadDevuelta > 0 && !devueltoTotal;

  return (
    <div style={itemCardStyle}>
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
          value={cantidadVendida.toLocaleString("es-AR")}
        />

        <Spec
          label="Devuelto"
          value={
            cantidadDevuelta > 0
              ? cantidadDevuelta.toLocaleString("es-AR")
              : "-"
          }
        />

        <Spec label="Precio lista" value={formatMoney(item.precio_lista)} />

        <Spec label="Precio final" value={formatMoney(item.precio_final)} />

        <Spec
          label="Serializada"
          value={
            item.id_bicicleta_serializada
              ? `#${item.id_bicicleta_serializada}`
              : "-"
          }
        />
      </div>

      {(item.bonificado ||
        item.motivo_precio_manual ||
        devueltoTotal ||
        devueltoParcial) && (
        <div style={badgesRowStyle}>
          {item.bonificado && <div style={bonusBadgeStyle}>Bonificado</div>}

          {item.motivo_precio_manual && (
            <div style={manualPriceBadgeStyle}>Precio manual</div>
          )}

          {devueltoTotal && <div style={devueltoBadgeStyle}>Devuelto</div>}

          {devueltoParcial && (
            <div style={devueltoParcialBadgeStyle}>
              Devuelto parcial: {cantidadDevuelta} de {cantidadVendida}
            </div>
          )}
        </div>
      )}

      <VentaItemVendidoAcciones
        venta={venta}
        item={item}
        procesando={procesando || devueltoTotal}
        onDevolverItem={onDevolverItem}
        onDevolverSerializada={onDevolverSerializada}
      />
    </div>
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

const devueltoBadgeStyle = {
  display: "inline-block",
  background: "#eef4ff",
  color: "#3538cd",
  border: "1px solid #c7d7fe",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: 800,
};

const devueltoParcialBadgeStyle = {
  display: "inline-block",
  background: "#f9fafb",
  color: "#344054",
  border: "1px solid #d0d5dd",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: 800,
};