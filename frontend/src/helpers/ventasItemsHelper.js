export function crearLineId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDescripcionItemCatalogo(item) {
  return [item.producto_nombre, item.nombre_variante].filter(Boolean).join(" - ");
}

export function getCodigoItemCatalogo(item) {
  return item.codigo_barras || item.sku || `#${item.id_variante}`;
}

export function getPrecioItemCatalogo(item, tipoPrecio) {
  return Number(
    tipoPrecio === "mayorista"
      ? item.precio_mayorista || 0
      : item.precio_minorista || 0
  );
}

export function getMotivoBloqueoItemCatalogo(item, tipoPrecio) {
  if (item.motivo_no_disponible === "sin_stock" && !item.serializable) return "Sin stock";
  if (item.motivo_no_disponible === "precio_no_definido") return "Precio no definido";
  if (!item.serializable && item.stockeable && Number(item.stock_disponible || 0) <= 0) return "Sin stock";
  if (getPrecioItemCatalogo(item, tipoPrecio) <= 0) return "Precio no definido";
  return "No disponible";
}

export function puedeAgregarItemCatalogo(item, tipoPrecio) {
  if (item.disponible_para_venta === false && !item.serializable) return false;
  if (getPrecioItemCatalogo(item, tipoPrecio) <= 0) return false;
  if (item.serializable) return true;
  if (item.stockeable && Number(item.stock_disponible || 0) <= 0) return false;
  return true;
}
