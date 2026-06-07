import { apiRequest } from "./api";

const BASE = "/capital-retiros";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function getParticipantesCapital(params = {}) {
  return apiRequest(`${BASE}/participantes${buildQuery(params)}`);
}

export function getPerfilParticipanteCapital(participanteId) {
  return apiRequest(`${BASE}/participantes/${participanteId}/perfil`);
}

export function crearParticipanteCapital(payload) {
  return apiRequest(`${BASE}/participantes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function editarParticipanteCapital(participanteId, payload) {
  return apiRequest(`${BASE}/participantes/${participanteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function cambiarEstadoParticipanteCapital(participanteId, activo) {
  return apiRequest(`${BASE}/participantes/${participanteId}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
}

export function getMovimientosCapital(params = {}) {
  return apiRequest(`${BASE}/movimientos${buildQuery(params)}`);
}

export function getMovimientoCapitalDetalle(movimientoId) {
  return apiRequest(`${BASE}/movimientos/${movimientoId}`);
}

export function crearMovimientoCapital(payload) {
  return apiRequest(`${BASE}/movimientos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function anularMovimientoCapital(movimientoId, payload) {
  return apiRequest(`${BASE}/movimientos/${movimientoId}/anular`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getResumenCapital(params = {}) {
  return apiRequest(`${BASE}/resumen${buildQuery(params)}`);
}
