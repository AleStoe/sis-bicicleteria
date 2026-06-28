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

export function obtenerHistorialCliente(clienteId) {
  return apiRequest(`/clientes/${clienteId}/historial`);
}

export function obtenerTallerCliente(clienteId) {
  return apiRequest(`/clientes/${clienteId}/taller`);
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

export function listarBicicletasCliente(clienteId) {
  return apiRequest(`/clientes/${clienteId}/bicicletas`);
}

export function crearBicicletaCliente(clienteId, data) {
  return apiRequest(`/clientes/${clienteId}/bicicletas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarBicicletaCliente(clienteId, bicicletaId, data) {
  return apiRequest(`/clientes/${clienteId}/bicicletas/${bicicletaId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function obtenerHistorialBicicletaCliente(
  clienteId,
  bicicletaId
) {
  return apiRequest(
    `/clientes/${clienteId}/bicicletas/${bicicletaId}/historial`
  );
}

export function autorizarServiceVencido(clienteId, bicicletaId, data) {
  return apiRequest(
    `/clientes/${clienteId}/bicicletas/${bicicletaId}/autorizar-service-vencido`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export function crearServicePostventa(clienteId, bicicletaId, data) {
  return apiRequest(
    `/clientes/${clienteId}/bicicletas/${bicicletaId}/crear-service-postventa`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export const autorizarServiceVencidoBicicleta =
  autorizarServiceVencido;

export const crearServicePostventaBicicleta =
  crearServicePostventa;
