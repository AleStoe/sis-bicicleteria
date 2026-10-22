import { apiRequest } from "./api";

export function listarAcondicionamientosBicicleta(bicicletaId) {
  return apiRequest(`/acondicionamientos/bicicleta/${bicicletaId}`);
}

export function crearAcondicionamiento(data) {
  return apiRequest("/acondicionamientos/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function agregarItemAcondicionamiento(acondicionamientoId, data) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function quitarItemAcondicionamiento(acondicionamientoId, itemId, usuarioId) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/items/${itemId}?id_usuario=${usuarioId}`, {
    method: "DELETE",
  });
}

export function resolverPiezaRetiradaAcondicionamiento(acondicionamientoId, itemId, data) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/items/${itemId}/pieza-retirada`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function agregarCostoAcondicionamiento(acondicionamientoId, data) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/costos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function quitarCostoAcondicionamiento(acondicionamientoId, costoId, usuarioId) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/costos/${costoId}?id_usuario=${usuarioId}`, {
    method: "DELETE",
  });
}

export function agregarRecuperoAcondicionamiento(acondicionamientoId, data) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/recuperos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function quitarRecuperoAcondicionamiento(acondicionamientoId, recuperoId, usuarioId) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/recuperos/${recuperoId}?id_usuario=${usuarioId}`, {
    method: "DELETE",
  });
}

export function confirmarAcondicionamiento(acondicionamientoId, data = {}) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/confirmar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function aplicarAcondicionamiento(acondicionamientoId, data = {}) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/aplicar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function revertirAcondicionamiento(acondicionamientoId, data) {
  return apiRequest(`/acondicionamientos/${acondicionamientoId}/revertir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
