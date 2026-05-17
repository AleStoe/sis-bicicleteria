import { formatMoney } from "../../../utils/formatters";
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

  const tienePrecioDiferente =
    Number(item.precio_lista) !== Number(item.precio_final);

  return (
    <article style={itemCardStyle}>
      <div style={mainRowStyle}>
        <div style={productBlockStyle}>
          <div style={titleRowStyle}>
            <h3 style={titleStyle}>{item.descripcion_snapshot}</h3>

            {item.bonificado && <Badge tone="success">Bonificado</Badge>}
            {item.motivo_precio_manual && <Badge tone="warning">Precio manual</Badge>}
            {devueltoTotal && <Badge tone="info">Devuelto</Badge>}
            {devueltoParcial && (
              <Badge tone="neutral">
                Devuelto parcial: {cantidadDevuelta} de {cantidadVendida}
              </Badge>
            )}
          </div>

          <div style={metaStyle}>
            Item #{item.id} · Variante #{item.id_variante} · Cantidad{" "}
            {cantidadVendida.toLocaleString("es-AR")} ·{" "}
            {item.id_bicicleta_serializada
              ? `Serializada #${item.id_bicicleta_serializada}`
              : "No serializada"}
          </div>
        </div>

        <div style={subtotalBlockStyle}>
          <span>Subtotal</span>
          <strong style={{ fontSize: 20 }}>{formatMoney(item.subtotal)}</strong>
        </div>
      </div>

      <div style={bottomRowStyle}>
        <div style={moneyGridStyle}>
          {tienePrecioDiferente ? (
            <>
              <Metric label="Precio lista" value={formatMoney(item.precio_lista)} />
              <Metric label="Precio final" value={formatMoney(item.precio_final)} />
            </>
          ) : (
            <Metric label="Precio" value={formatMoney(item.precio_final)} />
          )}

          {cantidadDevuelta > 0 && (
            <Metric
              label="Devuelto"
              value={cantidadDevuelta.toLocaleString("es-AR")}
            />
          )}
        </div>

        <VentaItemVendidoAcciones
          venta={venta}
          item={item}
          procesando={procesando || devueltoTotal}
          onDevolverItem={onDevolverItem}
          onDevolverSerializada={onDevolverSerializada}
        />
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div style={metricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  const toneStyle =
    tone === "success"
      ? badgeSuccessStyle
      : tone === "warning"
        ? badgeWarningStyle
        : tone === "info"
          ? badgeInfoStyle
          : badgeNeutralStyle;

  return <span style={{ ...badgeBaseStyle, ...toneStyle }}>{children}</span>;
}

const itemCardStyle = {
  border: "1px solid #eaecf0",
  borderRadius: 14,
  padding: 16,
  background: "#ffffff",
  display: "grid",
  gap: 12,
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
};

const mainRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "start",
};

const productBlockStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const titleRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.2,
  fontWeight: 900,
  color: "#111827",
};

const metaStyle = {
  color: "#667085",
  fontSize: 12,
  lineHeight: 1.3,
};

const subtotalBlockStyle = {
  minWidth: 120,
  borderRadius: 12,
  padding: "8px 12px",
  color: "#111827",
  background: "#f8fafc",
  display: "grid",
  gap: 2,
  textAlign: "right",
};

const bottomRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const moneyGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, max-content))",
  gap: 10,
  alignItems: "center",
  width: "fit-content",
};

const metricStyle = {
  background: "#f8fafc",
  borderRadius: 10,
  padding: "8px 10px",
  display: "grid",
  gap: 2,
  color: "#667085",
  fontSize: 12,
  minWidth: 180,
};

const badgeBaseStyle = {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  fontWeight: 800,
};

const badgeSuccessStyle = {
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
};

const badgeWarningStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  border: "1px solid #f3dc97",
};

const badgeInfoStyle = {
  background: "#eef4ff",
  color: "#3538cd",
  border: "1px solid #c7d7fe",
};

const badgeNeutralStyle = {
  background: "#f9fafb",
  color: "#344054",
  border: "1px solid #d0d5dd",
};