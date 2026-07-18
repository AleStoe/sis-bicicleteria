import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function listarModelosArmado(params = {}) {
  return apiRequest(`/armado/modelos${buildQuery(params)}`);
}

export function crearModeloArmado(data) {
  return apiRequest("/armado/modelos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoModeloArmado(modeloId, data) {
  return apiRequest(`/armado/modelos/${modeloId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function obtenerModeloArmadoDetalle(modeloId, params = {}) {
  return apiRequest(`/armado/modelos/${modeloId}/detalle${buildQuery(params)}`);
}

export function listarSucursalesArmado() {
  return apiRequest("/armado/sucursales");
}

export function crearVersionArmado(data) {
  return apiRequest("/armado/versiones", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function crearConfiguracionArmado(data) {
  return apiRequest("/armado/configuraciones", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerConfiguracionArmado(configuracionId) {
  return apiRequest(`/armado/configuraciones/${configuracionId}`);
}

export function agregarItemConfiguracionArmado(configuracionId, data) {
  return apiRequest(`/armado/configuraciones/${configuracionId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function eliminarItemConfiguracionArmado(configuracionId, itemId) {
  return apiRequest(`/armado/configuraciones/${configuracionId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export function duplicarConfiguracionArmado(configuracionId, data = {}) {
  return apiRequest(`/armado/configuraciones/${configuracionId}/duplicar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function activarConfiguracionArmado(configuracionId) {
  return apiRequest(`/armado/configuraciones/${configuracionId}/activar`, {
    method: "POST",
  });
}

export function archivarConfiguracionArmado(configuracionId) {
  return apiRequest(`/armado/configuraciones/${configuracionId}/archivar`, {
    method: "POST",
  });
}

export function simularConfiguracionArmado(data) {
  return apiRequest("/armado/simulador/calcular", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarOrdenesArmado(params = {}) {
  return apiRequest(`/armado/ordenes${buildQuery(params)}`);
}

export function crearOrdenArmado(data) {
  return apiRequest("/armado/ordenes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerOrdenArmado(ordenId) {
  return apiRequest(`/armado/ordenes/${ordenId}`);
}

export function editarOrdenArmado(ordenId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function agregarCostoOrdenArmado(ordenId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/costos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function sustituirItemOrdenArmado(ordenId, itemId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/items/${itemId}/sustituir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function recalcularDisponibilidadOrdenArmado(ordenId) {
  return apiRequest(`/armado/ordenes/${ordenId}/recalcular-disponibilidad`, {
    method: "POST",
  });
}

export function cambiarEstadoOrdenArmado(ordenId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function iniciarOrdenArmado(ordenId) {
  return apiRequest(`/armado/ordenes/${ordenId}/iniciar`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function cancelarOrdenArmado(ordenId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/cancelar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function pasarOrdenArmadoAControlFinal(ordenId) {
  return apiRequest(`/armado/ordenes/${ordenId}/control-final`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function volverOrdenArmadoAEnArmado(ordenId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/volver-armado`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarControlFinalOrdenArmado(ordenId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/controles`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function actualizarCostoFinalOrdenArmado(ordenId, costoId, data) {
  return apiRequest(`/armado/ordenes/${ordenId}/costos/${costoId}/final`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function finalizarOrdenArmado(ordenId) {
  return apiRequest(`/armado/ordenes/${ordenId}/finalizar`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function obtenerFichaTecnicaOrdenArmado(ordenId) {
  return apiRequest(`/armado/ordenes/${ordenId}/ficha-tecnica`);
}
