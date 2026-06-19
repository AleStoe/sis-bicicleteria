export function redondearComercial(monto, base = 100) {
  const numero = Number(monto || 0);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.ceil(numero / base) * base;
}

export function calcularAjusteRedondeo(totalExacto, totalRedondeado) {
  return Number(totalRedondeado || 0) - Number(totalExacto || 0);
}
