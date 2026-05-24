export function calcularMargen(costo, precio) {
  const c = Number(costo || 0);
  const p = Number(precio || 0);

  if (!c || c <= 0 || !p || p <= 0) {
    return null;
  }

  return ((p - c) / c) * 100;
}

export function calcularResumenMasivo(desfasados = []) {
  const totalSubas = desfasados
    .filter((i) => Number(i.diferencia) > 0)
    .reduce((acc, i) => acc + Number(i.diferencia), 0);

  const totalBajas = desfasados
    .filter((i) => Number(i.diferencia) < 0)
    .reduce((acc, i) => acc + Number(i.diferencia), 0);

  return {
    cantidad: desfasados.length,
    subas: totalSubas,
    bajas: totalBajas,
  };
}