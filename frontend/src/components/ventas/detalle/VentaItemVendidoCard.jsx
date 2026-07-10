import { formatMoney } from "../../../utils/formatters";
import { useBreakpoint } from "../../ui";
import VentaItemVendidoAcciones from "./VentaItemVendidoAcciones";

export default function VentaItemVendidoCard({
  venta,
  item,
  procesando,
  onDevolverItem,
  onDevolverSerializada,
  onCorregirNumeroCuadro,
}) {
  const { isMobile } = useBreakpoint();
  const cantidadDevuelta = Number(item.cantidad_devuelta || 0);
  const cantidadVendida = Number(item.cantidad || 0);

  const devueltoTotal =
    item.devuelto_total || cantidadDevuelta >= cantidadVendida;

  const devueltoParcial = cantidadDevuelta > 0 && !devueltoTotal;

  const tienePrecioDiferente =
    Number(item.precio_lista) !== Number(item.precio_final);
  const bonificacionUnitaria = Number(
    item.bonificacion_unitaria ||
      Math.max(0, Number(item.precio_lista) - Number(item.precio_final)),
  );

  return (
    <article style={{ ...itemCardStyle, ...(isMobile ? itemCardMobileStyle : {}) }}>
      <div style={{ ...mainRowStyle, ...(isMobile ? mainRowMobileStyle : {}) }}>
        <div style={productBlockStyle}>
          <div style={titleRowStyle}>
            <h3 style={{ ...titleStyle, ...(isMobile ? titleMobileStyle : {}) }}>{item.descripcion_snapshot}</h3>

            {item.bonificado && (
              <Badge tone="success">
                {Number(item.precio_final) > 0
                  ? "Bonificación parcial"
                  : "Bonificado"}
              </Badge>
            )}
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
            {item.id_bicicleta_serializada && (
              <>
                {" "}
                ·{" "}
                <button
                  type="button"
                  style={linkButtonStyle}
                  onClick={() => onCorregirNumeroCuadro?.(item)}
                >
                  Corregir cuadro
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ ...subtotalBlockStyle, ...(isMobile ? subtotalBlockMobileStyle : {}) }}>
          <span>Subtotal</span>
          <strong style={{ fontSize: isMobile ? 18 : 20 }}>{formatMoney(item.subtotal)}</strong>
        </div>
      </div>

      <div style={{ ...bottomRowStyle, ...(isMobile ? bottomRowMobileStyle : {}) }}>
        <div style={{ ...moneyGridStyle, ...(isMobile ? moneyGridMobileStyle : {}) }}>
          {tienePrecioDiferente ? (
            <>
              <Metric label="Precio lista" value={formatMoney(item.precio_lista)} isMobile={isMobile} />
              {bonificacionUnitaria > 0 ? (
                <Metric
                  label="Bonificación garantía"
                  value={`-${formatMoney(bonificacionUnitaria)}`}
                  isMobile={isMobile}
                />
              ) : null}
              <Metric label="Precio final" value={formatMoney(item.precio_final)} isMobile={isMobile} />
            </>
          ) : (
            <Metric label="Precio" value={formatMoney(item.precio_final)} isMobile={isMobile} />
          )}

          {cantidadDevuelta > 0 && (
            <Metric
              label="Devuelto"
              value={cantidadDevuelta.toLocaleString("es-AR")}
              isMobile={isMobile}
            />
          )}
        </div>

        {item.motivo_bonificacion ? (
          <div style={bonusReasonStyle}>{item.motivo_bonificacion}</div>
        ) : null}

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

function Metric({ label, value, isMobile = false }) {
  return (
    <div style={{ ...metricStyle, ...(isMobile ? metricMobileStyle : {}) }}>
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
  minWidth: 0,
};

const itemCardMobileStyle = {
  padding: 12,
  borderRadius: 16,
};

const mainRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "start",
};

const mainRowMobileStyle = {
  gridTemplateColumns: "1fr",
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

const titleMobileStyle = {
  fontSize: 16,
};

const metaStyle = {
  color: "#667085",
  fontSize: 12,
  lineHeight: 1.3,
};

const linkButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#f97316",
  fontWeight: 900,
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
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

const subtotalBlockMobileStyle = {
  minWidth: 0,
  textAlign: "left",
};

const bottomRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const bottomRowMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
};

const moneyGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, max-content))",
  gap: 10,
  alignItems: "center",
  width: "fit-content",
};

const moneyGridMobileStyle = {
  gridTemplateColumns: "1fr 1fr",
  width: "100%",
  gap: 8,
};

const bonusReasonStyle = {
  flex: "1 1 260px",
  color: "#067647",
  background: "#ecfdf3",
  border: "1px solid #abefc6",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
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

const metricMobileStyle = {
  minWidth: 0,
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
