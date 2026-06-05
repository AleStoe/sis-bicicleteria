import { apiRequest } from "./api";

export function listarServiciosTaller(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });

  const qs = searchParams.toString();
  return apiRequest(`/servicios_taller/${qs ? `?${qs}` : ""}`);
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
