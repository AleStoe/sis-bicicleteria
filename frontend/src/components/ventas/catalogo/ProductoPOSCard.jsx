import { buildImageUrl } from "../../../utils/images";
import { formatMoney, formatNumber } from "../../../utils/formatters";
import useMediaQuery from "../../../hooks/useMediaQuery";
import {
  getCodigoItemCatalogo,
  getDescripcionItemCatalogo,
  getMotivoBloqueoItemCatalogo,
  getOfertaItemCatalogo,
  getPrecioItemCatalogo,
  puedeAgregarItemCatalogo,
} from "../../../helpers/ventasItemsHelper";

export default function ProductoPOSCard({
  producto,
  tipoPrecio,
  onAgregarItem,
  onSeleccionarItem,
  seleccionado = false,
  agregado = false,
}) {
  const isMobile = useMediaQuery("(max-width: 680px)");
  const bloqueado = !puedeAgregarItemCatalogo(producto, tipoPrecio);
  const oferta = getOfertaItemCatalogo(producto, tipoPrecio);

  function agregar() {
    if (!bloqueado) onAgregarItem(producto);
  }

  function seleccionar() {
    if (!bloqueado) onSeleccionarItem?.(producto);
  }

  return (
    <div
      onClick={seleccionar}
      onMouseDown={(event) => event.preventDefault()}
      style={{
        ...(bloqueado ? productRowBlockedStyle : productRowStyle),
        ...(!bloqueado && seleccionado ? productRowSelectedStyle : {}),
        ...(isMobile ? productRowMobileStyle : {}),
      }}
      title={
        bloqueado
          ? getMotivoBloqueoItemCatalogo(producto, tipoPrecio)
          : seleccionado
            ? "Click otra vez para agregar"
            : "Click para seleccionar"
      }
    >
      <div style={{ ...imageBoxStyle, ...(isMobile ? imageBoxMobileStyle : {}) }}>
        {producto.imagen_principal ? (
          <img
            src={buildImageUrl(producto.imagen_principal)}
            alt={getDescripcionItemCatalogo(producto)}
            style={imageStyle}
          />
        ) : (
          <span style={placeholderStyle}>Bici</span>
        )}
      </div>

      <div style={productInfoStyle}>
        <strong>{getDescripcionItemCatalogo(producto)}</strong>
        <div style={mutedStyle}>{getCodigoItemCatalogo(producto)}</div>
        <div style={tagRowStyle}>
          {seleccionado && <span style={selectedTagStyle}>Seleccionado</span>}
          {agregado && <span style={addedTagStyle}>En carrito</span>}
          {oferta && <span style={offerTagStyle}>Oferta</span>}
          <span style={tagStyle}>{producto.categoria_nombre}</span>
          {producto.serializable ? (
            <span style={serializableTagStyle}>Bicicleta</span>
          ) : producto.stockeable ? (
            <span style={stockTagStyle}>
              Stock: {formatNumber(producto.stock_disponible || 0)}
            </span>
          ) : (
            <span style={stockTagStyle}>Sin control de stock</span>
          )}
          {bloqueado && (
            <span style={dangerTagStyle}>
              {getMotivoBloqueoItemCatalogo(producto, tipoPrecio)}
            </span>
          )}
        </div>
      </div>

      <div style={{ ...productPriceStyle, ...(isMobile ? productPriceMobileStyle : {}) }}>
        <div style={priceValuesStyle}>
          {oferta && (
            <span style={oldPriceStyle}>{formatMoney(oferta.precio_regular)}</span>
          )}
          <strong style={oferta ? offerPriceStyle : undefined}>
            {formatMoney(getPrecioItemCatalogo(producto, tipoPrecio))}
          </strong>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            agregar();
          }}
          disabled={bloqueado}
          style={bloqueado ? addBtnDisabledStyle : addBtnStyle}
          title="Agregar al carrito"
        >
          +
        </button>
      </div>
    </div>
  );
}

const productRowStyle = {
  display: "grid",
  gridTemplateColumns: "96px 1fr 130px",
  gap: "12px",
  alignItems: "center",
  border: "0",
  outline: "0",
  borderRadius: "12px",
  padding: "10px",
  background: "white",
  minWidth: 0,
  cursor: "pointer",
  boxShadow: "inset 0 0 0 1px #e5e7eb",
  transition: "background .18s ease, box-shadow .18s ease",
};

const productRowSelectedStyle = {
  background: "#fff7ed",
  outline: "0",
  boxShadow: "inset 0 0 0 1px #fb923c, 0 0 0 2px rgba(249, 115, 22, .12)",
};

const productRowMobileStyle = {
  gridTemplateColumns: "66px minmax(0, 1fr)",
  alignItems: "start",
  gap: "10px",
  padding: "9px",
};

const productRowBlockedStyle = {
  ...productRowStyle,
  opacity: 0.62,
  background: "#f9fafb",
  cursor: "not-allowed",
};

const imageBoxStyle = {
  width: "96px",
  height: "76px",
  borderRadius: "10px",
  background: "#ffffff",
  border: "1px solid #eef2f7",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  padding: "6px",
  boxSizing: "border-box",
};

const imageBoxMobileStyle = {
  width: 66,
  height: 58,
  borderRadius: 9,
  padding: 5,
};

const imageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  objectPosition: "center",
  display: "block",
};

const placeholderStyle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#667085",
};

const productInfoStyle = { minWidth: 0, display: "grid", gap: "4px" };
const mutedStyle = { color: "#667085", fontSize: "13px" };
const tagRowStyle = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" };
const tagStyle = { background: "#eef4ff", color: "#175cd3", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const stockTagStyle = { background: "#ecfdf3", color: "#067647", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const serializableTagStyle = { background: "#fff8e1", color: "#8a6d00", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const dangerTagStyle = { background: "#fee4e2", color: "#b42318", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" };
const selectedTagStyle = { background: "#ffedd5", color: "#c2410c", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 900 };
const addedTagStyle = { background: "#dbeafe", color: "#1d4ed8", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 900 };
const offerTagStyle = { background: "#ffedd5", color: "#c2410c", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 900 };
const priceValuesStyle = { display: "grid", gap: 2, justifyItems: "end" };
const oldPriceStyle = { color: "#667085", fontSize: 12, textDecoration: "line-through" };
const offerPriceStyle = { color: "#ea580c", fontSize: 18 };

const productPriceStyle = {
  display: "grid",
  gap: "8px",
  justifyItems: "end",
  fontSize: "16px",
};

const productPriceMobileStyle = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  justifyItems: "stretch",
  width: "100%",
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
