import { apiRequest } from "./api";

function cleanParams(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

export function listarClientes(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.solo_activos !== undefined) {
    searchParams.set("solo_activos", String(params.solo_activos));
  }

  if (params.orden) {
    searchParams.set("orden", params.orden);
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

export function obtenerAnalisisCliente(clienteId, periodo = "365d") {
  const params = new URLSearchParams({ periodo });
  return apiRequest(`/clientes/${clienteId}/analisis?${params.toString()}`);
}

export function obtenerPanelCrmClientes(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return apiRequest(`/clientes/crm/panel?${searchParams.toString()}`);
}

export function listarResponsablesCrm() {
  return apiRequest("/clientes/crm/responsables");
}

export function listarAgendaCrm(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return apiRequest(`/clientes/crm/seguimientos?${searchParams.toString()}`);
}

export function listarOportunidadesCrm(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return apiRequest(`/clientes/crm/oportunidades?${searchParams.toString()}`);
}

export function listarOportunidadesCliente(clienteId, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return apiRequest(`/clientes/${clienteId}/oportunidades?${searchParams.toString()}`);
}

export function listarComunicacionesCrm(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/clientes/crm/comunicaciones${query ? `?${query}` : ""}`);
}

export function listarComunicacionesCliente(clienteId, params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/clientes/${clienteId}/comunicaciones${query ? `?${query}` : ""}`);
}

export function registrarComunicacionCliente(clienteId, payload) {
  return apiRequest(`/clientes/${clienteId}/comunicaciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actualizarPreferenciaContacto(clienteId, payload) {
  return apiRequest(`/clientes/${clienteId}/preferencia-contacto`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listarSeguimientosCliente(clienteId, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return apiRequest(`/clientes/${clienteId}/seguimientos?${searchParams.toString()}`);
}

export function crearSeguimientoCliente(clienteId, data) {
  return apiRequest(`/clientes/${clienteId}/seguimientos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reprogramarSeguimientoCliente(clienteId, seguimientoId, data) {
  return apiRequest(`/clientes/${clienteId}/seguimientos/${seguimientoId}/reprogramar`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cerrarSeguimientoCliente(clienteId, seguimientoId, data) {
  return apiRequest(`/clientes/${clienteId}/seguimientos/${seguimientoId}/cerrar`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function listarEventosSeguimientoCliente(clienteId, seguimientoId) {
  return apiRequest(`/clientes/${clienteId}/seguimientos/${seguimientoId}/eventos`);
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
