import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listarCotizaciones(params = {}) {
  return apiRequest(`/cotizaciones/${buildQuery(params)}`);
}

export function obtenerCotizacion(cotizacionId) {
  return apiRequest(`/cotizaciones/${cotizacionId}`);
}

export function crearCotizacion(data) {
  return apiRequest("/cotizaciones/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function agregarItemCotizacion(cotizacionId, data) {
  return apiRequest(`/cotizaciones/${cotizacionId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function quitarItemCotizacion(cotizacionId, itemId) {
  return apiRequest(`/cotizaciones/${cotizacionId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export function cambiarEstadoCotizacion(cotizacionId, data) {
  return apiRequest(`/cotizaciones/${cotizacionId}/estado`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function generarMensajeWhatsappCotizacion(cotizacionId) {
  return apiRequest(`/cotizaciones/${cotizacionId}/mensaje-whatsapp`);
}
