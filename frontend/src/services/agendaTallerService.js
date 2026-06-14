import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listarTurnosAgenda(params = {}) {
  return apiRequest(`/agenda-taller/${buildQuery(params)}`);
}

export function listarTurnosAgendaParaManana(params = {}) {
  return apiRequest(`/agenda-taller/para-manana${buildQuery(params)}`);
}

export function listarTurnosAgendaAtrasados(params = {}) {
  return apiRequest(`/agenda-taller/atrasadas${buildQuery(params)}`);
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

export function obtenerHistorialTurnoAgenda(turnoId) {
  return apiRequest(`/agenda-taller/${turnoId}/historial`);
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

export function convertirTurnoAOrden(turnoId, data) {
  return apiRequest(`/agenda-taller/${turnoId}/convertir-orden`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function marcarRecordatorioEnviado(turnoId) {
  return apiRequest(`/agenda-taller/${turnoId}/recordatorio-enviado`, {
    method: "PATCH",
  });
}

export function marcarClienteAvisado(turnoId, data = {}) {
  return apiRequest(`/agenda-taller/${turnoId}/cliente-avisado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
