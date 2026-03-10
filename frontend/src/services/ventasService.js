import { apiRequest } from "./api";

export function crearVenta(payload) {
  return apiRequest("/ventas/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listarVentas() {
  return apiRequest("/ventas/");
}

export function obtenerVenta(ventaId) {
  return apiRequest(`/ventas/${ventaId}`);
}

export function anularVenta(ventaId, payload) {
  return apiRequest(`/ventas/${ventaId}/anular`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}