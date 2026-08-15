import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listarPedidosCliente(params = {}) {
  return apiRequest(`/pedidos-cliente/${buildQuery(params)}`);
}

export function crearPedidoCliente(data) {
  return apiRequest("/pedidos-cliente/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerPedidoCliente(pedidoId) {
  return apiRequest(`/pedidos-cliente/${pedidoId}`);
}

export function agregarItemPedidoCliente(pedidoId, data) {
  return apiRequest(`/pedidos-cliente/${pedidoId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarItemPedidoCliente(pedidoId, itemId, data) {
  return apiRequest(`/pedidos-cliente/${pedidoId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function quitarItemPedidoCliente(pedidoId, itemId) {
  return apiRequest(`/pedidos-cliente/${pedidoId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export function cancelarPedidoCliente(pedidoId, data = {}) {
  return apiRequest(`/pedidos-cliente/${pedidoId}/cancelar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function convertirPedidoCliente(pedidoId, data) {
  return apiRequest(`/pedidos-cliente/${pedidoId}/convertir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
