import { apiRequest } from "./api";

export function listarClientes(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.solo_activos !== undefined) {
    searchParams.set("solo_activos", String(params.solo_activos));
  }

  const query = searchParams.toString();
  return apiRequest(`/clientes/${query ? `?${query}` : ""}`);
}

export function obtenerCliente(clienteId) {
  return apiRequest(`/clientes/${clienteId}`);
}

export function crearCliente(data) {
  return apiRequest("/clientes/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarCliente(clienteId, data) {
  return apiRequest(`/clientes/${clienteId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function desactivarCliente(clienteId) {
  return apiRequest(`/clientes/${clienteId}/desactivar`, {
    method: "PATCH",
  });
}

export function activarCliente(clienteId) {
  return apiRequest(`/clientes/${clienteId}/activar`, {
    method: "PATCH",
  });
}