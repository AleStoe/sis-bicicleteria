export function buildIngresoStockPayload({
  ingresoForm,
  usuarioId,
}) {
  return {
    id_sucursal: Number(ingresoForm.id_sucursal),
    id_variante: Number(ingresoForm.id_variante),
    id_proveedor: Number(ingresoForm.id_proveedor),
    cantidad_ingresada: Number(ingresoForm.cantidad_ingresada),
    costo_productos: Number(ingresoForm.costo_productos),
    gastos_adicionales: Number(ingresoForm.gastos_adicionales || 0),
    origen_ingreso: "manual",
    observacion: ingresoForm.observacion?.trim() || null,
    id_usuario: usuarioId,
  };
}

export function buildAjusteStockPayload({
  ajusteForm,
  usuarioId,
}) {
  return {
    id_sucursal: Number(ajusteForm.id_sucursal),
    id_variante: Number(ajusteForm.id_variante),
    cantidad: Number(ajusteForm.cantidad),
    nota: ajusteForm.nota.trim(),
    id_usuario: usuarioId,
  };
}