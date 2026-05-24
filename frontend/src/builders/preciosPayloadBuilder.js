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
          motivo:
            motivo?.trim() ||
            "Recalculo manual por proveedor",
        }
      : {}),
  };
}

export function buildReglaPrecioPayload(reglaForm) {
  return {
    nombre: reglaForm.nombre.trim(),
    id_categoria: null,
    id_marca: null,
    tipo_cliente: reglaForm.tipo_cliente,
    margen_porcentaje: reglaForm.margen_porcentaje,
    redondeo_base: reglaForm.redondeo_base,
  };
}