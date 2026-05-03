import { apiRequest } from "./api";

export function listarAuditoriaEventos(limit = 100) {
  return apiRequest(`/auditoria/?limit=${limit}`);
}

export function obtenerAuditoriaEvento(eventoId) {
  return apiRequest(`/auditoria/${eventoId}`);
}
