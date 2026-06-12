function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}

export function buildRecalculoProveedorPayload({
  idProveedor,
  tipoCliente,
  aplicar = false,
  usuarioId = null,
  motivo = "",
}) {
  return {
    id_proveedor: Number(idProveedor),
    tipo_cliente: tipoCliente,
    aplicar,

    ...(aplicar
      ? {
          id_usuario: usuarioId,
          motivo: motivo?.trim() || "Recalculo manual por proveedor",
        }
      : {}),
  };
}

export function buildReglaPrecioPayload(reglaForm) {
  return {
    nombre: reglaForm.nombre.trim(),
    id_categoria: optionalNumber(reglaForm.id_categoria),
    id_marca: optionalNumber(reglaForm.id_marca),
    id_familia_precio: optionalNumber(reglaForm.id_familia_precio),
    id_proveedor: optionalNumber(reglaForm.id_proveedor),
    tipo_cliente: reglaForm.tipo_cliente,
    margen_porcentaje: reglaForm.margen_porcentaje,
    descuento_base_porcentaje: reglaForm.descuento_base_porcentaje || "0",
    margen_minimo_porcentaje: reglaForm.margen_minimo_porcentaje || "0",
    redondeo_base: reglaForm.redondeo_base,
  };
}