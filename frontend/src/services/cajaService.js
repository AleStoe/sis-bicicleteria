import { apiRequest } from "./api";

export function abrirCaja(data) {
  return apiRequest("/cajas/abrir", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerCajaAbierta(idSucursal) {
  return apiRequest(`/cajas/abierta?id_sucursal=${idSucursal}`);
}

export function obtenerCajaDetalle(cajaId) {
  return apiRequest(`/cajas/${cajaId}`);
}

export function registrarEgresoCaja(cajaId, data) {
  return apiRequest(`/cajas/${cajaId}/egresos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cerrarCaja(cajaId, data) {
  return apiRequest(`/cajas/${cajaId}/cerrar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function registrarAjusteCaja(cajaId, data) {
  return apiRequest(`/cajas/${cajaId}/ajustes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}