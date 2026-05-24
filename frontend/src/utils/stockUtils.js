export function getEstadoStock(item) {
  const disponible = Number(item.stock_disponible || 0);
  const fisico = Number(item.stock_fisico || 0);
  const reservado = Number(item.stock_reservado || 0);
  const pendiente = Number(item.stock_vendido_pendiente_entrega || 0);

  if (disponible < 0 || fisico < reservado + pendiente) {
    return "inconsistente";
  }

  if (disponible === 0) {
    return "sin_stock";
  }

  if (disponible <= 2) {
    return "bajo";
  }

  return "ok";
}

export function calcularResumenStock(stock = []) {
  return stock.reduce(
    (acc, item) => {
      const estado = getEstadoStock(item);

      acc.variantes += 1;
      acc.stockFisico += Number(item.stock_fisico || 0);
      acc.stockReservado += Number(item.stock_reservado || 0);
      acc.stockPendiente += Number(item.stock_vendido_pendiente_entrega || 0);
      acc.stockDisponible += Number(item.stock_disponible || 0);

      if (estado === "sin_stock") acc.sinDisponible += 1;
      if (estado === "bajo") acc.reservados += 1;
      if (estado === "inconsistente") acc.inconsistentes += 1;

      return acc;
    },
    {
      variantes: 0,
      stockFisico: 0,
      stockReservado: 0,
      stockPendiente: 0,
      stockDisponible: 0,
      sinDisponible: 0,
      reservados: 0,
      inconsistentes: 0,
    }
  );
}