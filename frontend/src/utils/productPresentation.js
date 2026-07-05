export function esVarianteUnica(nombreVariante) {
  const nombreNormalizado = String(nombreVariante || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return nombreNormalizado === "UNICA";
}

export function formatProductoVariante(nombreProducto, nombreVariante) {
  const producto = String(nombreProducto || "").trim();
  const variante = String(nombreVariante || "").trim();

  if (!variante || esVarianteUnica(variante)) return producto;
  if (!producto) return variante;

  return `${producto} - ${variante}`;
}
