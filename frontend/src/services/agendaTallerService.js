import { apiRequest } from "./api";

export function listarTurnosAgenda(params = {}) {
  const query = new URLSearchParams();

  if (params.fecha_desde) query.set("fecha_desde", params.fecha_desde);
  if (params.fecha_hasta) query.set("fecha_hasta", params.fecha_hasta);
  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.estado) query.set("estado", params.estado);
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