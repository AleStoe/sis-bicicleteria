import { apiRequest } from "./api";

export function listarVentas() {
  return apiRequest("/ventas/");
}

export function obtenerVenta(ventaId) {
  return apiRequest(`/ventas/${ventaId}`);
}

export function crearVenta(data) {
  return apiRequest("/ventas/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function entregarVenta(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/entregar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function anularVenta(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/anular`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function corregirClienteVenta(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/corregir-cliente`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function asignarBicicletaSerializadaVenta(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/asignar-bicicleta-serializada`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function devolverVentaSerializada(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/devolver-serializada`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function devolverVenta(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/devolver`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function devolverItemsVenta(ventaId, data) {
  return apiRequest(`/ventas/${ventaId}/devolver-items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function simularVenta(data) {
  return apiRequest("/ventas/simular", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
