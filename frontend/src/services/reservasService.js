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

export function listarReservas(filtros = {}) {
  return apiRequest(`/reservas/${buildQuery(filtros)}`);
}

export function obtenerReserva(reservaId) {
  return apiRequest(`/reservas/${reservaId}`);
}

export function crearReserva(data) {
  return apiRequest("/reservas/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function vencerReserva(reservaId, data) {
  return apiRequest(`/reservas/${reservaId}/vencer`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cancelarReserva(reservaId, data) {
  return apiRequest(`/reservas/${reservaId}/cancelar`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function convertirReservaEnVenta(reservaId, data) {
  return apiRequest(`/reservas/${reservaId}/convertir-a-venta`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
