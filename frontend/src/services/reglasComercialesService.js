import { apiRequest } from "./api";

export function listarReglasComerciales(soloActivas = false) {
  return apiRequest(`/reglas-comerciales?solo_activas=${soloActivas}`);
}

export function editarReglaComercial(reglaId, data) {
  return apiRequest(`/reglas-comerciales/${reglaId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function listarTarjetaPlanes(soloActivos = false) {
  return apiRequest(
    `/reglas-comerciales/tarjeta-planes?solo_activos=${soloActivos}`
  );
}

export function crearTarjetaPlan(data) {
  return apiRequest(`/reglas-comerciales/tarjeta-planes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarTarjetaPlan(planId, data) {
  return apiRequest(`/reglas-comerciales/tarjeta-planes/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function simularReglasComerciales(data) {
  return apiRequest("/reglas-comerciales/simular", {
    method: "POST",
    body: JSON.stringify(data),
  });
}