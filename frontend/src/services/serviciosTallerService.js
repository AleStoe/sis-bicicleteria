import { apiRequest } from "./api";

export function listarServiciosTaller(incluirInactivos = false) {
  const qs = incluirInactivos ? "?incluir_inactivos=true" : "";
  return apiRequest(`/servicios_taller/${qs}`);
}

export function obtenerServicioTaller(servicioId) {
  return apiRequest(`/servicios_taller/${servicioId}`);
}

export function crearServicioTaller(data) {
  return apiRequest("/servicios_taller/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarServicioTaller(servicioId, data) {
  return apiRequest(`/servicios_taller/${servicioId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function activarServicioTaller(servicioId) {
  return apiRequest(`/servicios_taller/${servicioId}/activar`, {
    method: "PATCH",
  });
}

export function desactivarServicioTaller(servicioId) {
  return apiRequest(`/servicios_taller/${servicioId}/desactivar`, {
    method: "PATCH",
  });
}
