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

export function listarStock(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/stock/${query ? `?${query}` : ""}`);
}

export function obtenerResumenStock(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/stock/resumen${query ? `?${query}` : ""}`);
}

export function obtenerPedidoCompraSugerido(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/stock/pedido-sugerido${query ? `?${query}` : ""}`);
}

export function obtenerAnalisisDemanda(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/stock/demanda${query ? `?${query}` : ""}`);
}

export function crearIngresoStock(data) {
  return apiRequest("/stock/ingresos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function crearAjusteStock(data) {
  return apiRequest("/stock/ajustes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
