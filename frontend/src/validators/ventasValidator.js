export function validarClienteVenta(clienteId) {
  if (!clienteId) {
    return "Seleccioná un cliente";
  }

  return null;
}

export function validarItemsVenta(items = []) {
  if (!items.length) {
    return "Agregá al menos un item";
  }

  return null;
}

export function validarCantidadItem(cantidad) {
  const cantidadNumerica = Number(cantidad);

  if (!Number.isFinite(cantidadNumerica) || cantidadNumerica <= 0) {
    return "La cantidad debe ser mayor a cero";
  }

  return null;
}

export function validarSerializadasSeleccionadas(items = []) {
  const serializadaSinCuadro = items.find(
    (item) =>
      item.serializable &&
      item.modo_venta_serializada === "serializada" &&
      !item.id_bicicleta_serializada
  );

  if (serializadaSinCuadro) {
    return `Seleccioná número de cuadro para: ${serializadaSinCuadro.descripcion}`;
  }

  return null;
}

export function validarSerializadasDuplicadas(items = []) {
  const serializadasElegidas = items
    .filter((item) => item.id_bicicleta_serializada)
    .map((item) => Number(item.id_bicicleta_serializada));

  if (new Set(serializadasElegidas).size !== serializadasElegidas.length) {
    return "No podés vender dos veces la misma bicicleta serializada";
  }

  return null;
}

export function validarMontoPago(monto) {
  const montoNumerico = Number(monto);

  if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
    return "El monto base debe ser mayor a cero";
  }

  return null;
}

export function validarPlanTarjeta({ medioPago, planTarjetaId, planesTarjeta = [] }) {
  if (medioPago !== "tarjeta") return null;

  if (!planesTarjeta.length) {
    return "No hay planes de tarjeta activos";
  }

  if (!planTarjetaId) {
    return "Seleccioná un plan de tarjeta";
  }

  return null;
}

export function validarCheckoutAntesDeFinalizar({ items = [], simulando }) {
  if (!items.length) {
    return "Agregá al menos un item";
  }

  if (simulando) {
    return "Esperá a que termine la simulación antes de finalizar";
  }

  return null;
}

export function validarVentaBasica({ clienteId, items }) {
  return validarClienteVenta(clienteId) || validarItemsVenta(items);
}

export function validarVentaAntesDeCrear({ clienteId, items }) {
  return (
    validarClienteVenta(clienteId) ||
    validarItemsVenta(items) ||
    validarSerializadasSeleccionadas(items) ||
    validarSerializadasDuplicadas(items)
  );
}
