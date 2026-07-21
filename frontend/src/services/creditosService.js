import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function listarClientesConSaldoAFavor(params = {}) {
  return apiRequest(`/creditos/clientes-con-saldo${buildQuery(params)}`);
}

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
