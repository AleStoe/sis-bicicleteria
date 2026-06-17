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

export function listarHistorialCajas(params = {}) {
  const query = new URLSearchParams();

  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.fecha_desde) query.set("fecha_desde", params.fecha_desde);
  if (params.fecha_hasta) query.set("fecha_hasta", params.fecha_hasta);
  if (params.estado) query.set("estado", params.estado);
  if (params.limit) query.set("limit", params.limit);
  if (params.offset) query.set("offset", params.offset);

  const qs = query.toString();
  return apiRequest(`/cajas/historial${qs ? `?${qs}` : ""}`);
}

export function obtenerResumenDiarioCaja(params = {}) {
  const query = new URLSearchParams();

  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.fecha) query.set("fecha", params.fecha);

  const qs = query.toString();
  return apiRequest(`/cajas/resumen-diario${qs ? `?${qs}` : ""}`);
}
