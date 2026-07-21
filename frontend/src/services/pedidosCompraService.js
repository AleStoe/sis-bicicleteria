import { apiRequest } from "./api";

function cleanParams(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, value);
    }
  });
  return search.toString();
}

export function listarPedidosCompra(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/pedidos-compra/${query ? `?${query}` : ""}`);
}

export function obtenerPedidoCompra(pedidoId) {
  return apiRequest(`/pedidos-compra/${pedidoId}`);
}

export function crearPedidoCompra(data) {
  return apiRequest("/pedidos-compra/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoPedidoCompra(pedidoId, data) {
  return apiRequest(`/pedidos-compra/${pedidoId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function recibirPedidoCompra(pedidoId, data) {
  return apiRequest(`/pedidos-compra/${pedidoId}/recepciones`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
