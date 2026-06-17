import { apiRequest } from "./api";

export function listarInventariosFisicos() {
  return apiRequest("/inventarios-fisicos/");
}

export function listarDiferenciasInventario(params = {}) {
  const query = new URLSearchParams();

  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.limit) query.set("limit", params.limit);

  const qs = query.toString();
  return apiRequest(`/inventarios-fisicos/diferencias${qs ? `?${qs}` : ""}`);
}

export function crearInventarioFisico(data) {
  return apiRequest("/inventarios-fisicos/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerInventarioFisico(inventarioId) {
  return apiRequest(`/inventarios-fisicos/${inventarioId}`);
}

export function cargarConteoInventario(inventarioId, data) {
  return apiRequest(`/inventarios-fisicos/${inventarioId}/conteos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cerrarInventarioFisico(inventarioId, data) {
  return apiRequest(`/inventarios-fisicos/${inventarioId}/cerrar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cancelarInventarioFisico(inventarioId, data) {
  return apiRequest(`/inventarios-fisicos/${inventarioId}/cancelar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
