import { apiRequest } from "./api";

export function listarPagos(params = {}) {
  const query = new URLSearchParams();

  if (params.id_cliente) {
    query.set("id_cliente", String(params.id_cliente));
  }

  const qs = query.toString();
  return apiRequest(`/pagos/${qs ? `?${qs}` : ""}`);
}

export function listarPagosDeVenta(ventaId) {
  return apiRequest(`/pagos/ventas/${ventaId}/pagos`);
}

export function simularTramoPagoVenta(data) {
  return apiRequest("/pagos/ventas/simular-tramo", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function crearPago(data) {
  return apiRequest("/pagos/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function revertirPago(pagoId, data) {
  return apiRequest(`/pagos/${pagoId}/revertir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
