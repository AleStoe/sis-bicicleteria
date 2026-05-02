import { apiRequest } from "./api";

export function listarPagos() {
  return apiRequest("/pagos/");
}

export function listarPagosDeVenta(ventaId) {
  return apiRequest(`/pagos/ventas/${ventaId}/pagos`);
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
