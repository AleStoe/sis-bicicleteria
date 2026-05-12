export function generarNombreBicicleta({
  marcaNombre = "",
  tipo_bicicleta = "",
  modelo = "",
  rodado = "",
  material_cuadro = "",
  transmision = "",
}) {
  return [
    "BICICLETA",
    tipo_bicicleta,
    marcaNombre,
    modelo,
    rodado ? `R${rodado}` : "",
    material_cuadro,
    transmision,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function generarNombreVarianteBicicleta({ talle = "", color = "" }) {
  return `Talle ${talle.trim()} - ${color.trim()}`.trim();
}