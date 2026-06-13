import { apiRequest } from "./api";

export function listarTurnosAgenda(params = {}) {
  const query = new URLSearchParams();

  if (params.fecha_desde) query.set("fecha_desde", params.fecha_desde);
  if (params.fecha_hasta) query.set("fecha_hasta", params.fecha_hasta);

  const qs = query.toString();
  return apiRequest(`/agenda-taller/${qs ? `?${qs}` : ""}`);
}

export function crearTurnoAgenda(data) {
  return apiRequest("/agenda-taller/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerTurnoAgenda(turnoId) {
  return apiRequest(`/agenda-taller/${turnoId}`);
}

export function editarTurnoAgenda(turnoId, data) {
  return apiRequest(`/agenda-taller/${turnoId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoTurnoAgenda(turnoId, data) {
  return apiRequest(`/agenda-taller/${turnoId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}