import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listarCasosPostventa(params = {}) {
  return apiRequest(`/postventa/casos${buildQuery(params)}`);
}

export function crearCasoPostventa(data) {
  return apiRequest("/postventa/casos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerCasoPostventa(casoId) {
  return apiRequest(`/postventa/casos/${casoId}`);
}

export function actualizarCasoPostventa(casoId, data) {
  return apiRequest(`/postventa/casos/${casoId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoCasoPostventa(casoId, data) {
  return apiRequest(`/postventa/casos/${casoId}/estado`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cerrarCasoPostventa(casoId, data) {
  return apiRequest(`/postventa/casos/${casoId}/cerrar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reabrirCasoPostventa(casoId, data) {
  return apiRequest(`/postventa/casos/${casoId}/reabrir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarOrdenesTallerCasoPostventa(casoId) {
  return apiRequest(`/postventa/casos/${casoId}/ordenes_taller`);
}

export function vincularOrdenTallerCasoPostventa(casoId, data) {
  return apiRequest(`/postventa/casos/${casoId}/ordenes_taller`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function crearOrdenTallerDesdeCasoPostventa(casoId, data) {
  return apiRequest(`/postventa/casos/${casoId}/ordenes_taller/crear`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
