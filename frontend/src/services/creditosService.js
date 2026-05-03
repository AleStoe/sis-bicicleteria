import { apiRequest } from "./api";

export function listarCreditosCliente(clienteId) {
  return apiRequest(`/creditos/cliente/${clienteId}`);
}

export function listarCreditosDisponiblesCliente(clienteId) {
  return apiRequest(`/creditos/cliente/${clienteId}/disponibles`);
}

export function obtenerCredito(creditoId) {
  return apiRequest(`/creditos/${creditoId}`);
}

export function reintegrarCredito(creditoId, data) {
  return apiRequest(`/creditos/${creditoId}/reintegrar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
