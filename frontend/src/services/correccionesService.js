import { apiRequest } from "./api";

const BASE = "/correcciones";

export function obtenerCorreccionesPendientes() {
  return apiRequest(`${BASE}/pendientes`);
}

export function corregirCapitalSinCaja(movimientoId, payload) {
  return apiRequest(`${BASE}/capital-sin-caja/${movimientoId}/registrar-egreso`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
