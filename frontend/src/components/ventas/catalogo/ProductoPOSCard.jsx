import { buildImageUrl } from "../../../utils/images";
import { formatMoney, formatNumber } from "../../../utils/formatters";
import {
  getCodigoItemCatalogo,
  getDescripcionItemCatalogo,
  getMotivoBloqueoItemCatalogo,
  getPrecioItemCatalogo,
  puedeAgregarItemCatalogo,
} from "../../../helpers/ventasItemsHelper";

export default function ProductoPOSCard({ producto, tipoPrecio, onAgregarItem }) {
  const bloqueado = !puedeAgregarItemCatalogo(producto, tipoPrecio);

  return (
    <div
      style={bloqueado ? productRowBlockedStyle : productRowStyle}
    >
      <div style={imageBoxStyle}>
        {producto.imagen_principal ? (
          <img
            src={buildImageUrl(producto.imagen_principal)}
            alt={getDescripcionItemCatalogo(producto)}
            style={imageStyle}
          />
        ) : (
          <span style={{ fontSize: "30px" }}>🚲</span>
        )}
      </div>

      <div style={productInfoStyle}>
        <strong>{getDescripcionItemCatalogo(producto)}</strong>
        <div style={mutedStyle}>{getCodigoItemCatalogo(producto)}</div>
        <div style={tagRowStyle}>
          <span style={tagStyle}>{producto.categoria_nombre}</span>
          {producto.serializable ? (
            <span style={serializableTagStyle}>Bicicleta</span>
          ) : producto.stockeable ? (
            <span style={stockTagStyle}>
              Stock: {formatNumber(producto.stock_disponible || 0)}
            </span>
          ) : (
            <span style={serviceTagStyle}>Servicio</span>
          )}
          {bloqueado && (
            <span style={dangerTagStyle}>
              {getMotivoBloqueoItemCatalogo(producto, tipoPrecio)}
            </span>
          )}
        </div>
      </div>

      <div style={productPriceStyle}>
        <strong>{formatMoney(getPrecioItemCatalogo(producto, tipoPrecio))}</strong>
        <button
          type="button"
          onClick={() => onAgregarItem(producto)}
          disabled={bloqueado}
          style={bloqueado ? addBtnDisabledStyle : addBtnStyle}
        >
          +
        </button>
      </div>
    </div>
  );
}

const productRowStyle = {
  display: "grid",
  gridTemplateColumns: "82px 1fr 130px",
  gap: "12px",
  alignItems: "center",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "10px",
  background: "white",
};

const productRowBlockedStyle = {
  ...productRowStyle,
  opacity: 0.62,
  background: "#f9fafb",
};

const imageBoxStyle = {
  width: "82px",
  height: "72px",
  borderRadius: "10px",
  background: "#f2f4f7",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
};

const imageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const productInfoStyle = { minWidth: 0, display: "grid", gap: "4px" };
const mutedStyle = { color: "#667085", fontSize: "13px" };
const tagRowStyle = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" };
const tagStyle = { background: "#eef4ff", color: "#175cd3", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const stockTagStyle = { background: "#ecfdf3", color: "#067647", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const serializableTagStyle = { background: "#fff8e1", color: "#8a6d00", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const serviceTagStyle = { background: "#fef7c3", color: "#854a0e", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const dangerTagStyle = { background: "#fee4e2", color: "#b42318", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };

const productPriceStyle = {
  display: "grid",
  gap: "8px",
  justifyItems: "end",
  fontSize: "16px",
};

const addBtnStyle = {
  width: "42px",
  height: "34px",
  borderRadius: "10px",
  border: "none",
  background: "#0b5bd3",
  color: "white",
  fontSize: "22px",
  cursor: "pointer",
};

const addBtnDisabledStyle = {
  ...addBtnStyle,
  background: "#d0d5dd",
  cursor: "not-allowed",
};
