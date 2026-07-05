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

export function getRentabilidadMensual(params) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/mensual${query ? `?${query}` : ""}`);
}

export function getRentabilidadDiaria(params) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/diaria${query ? `?${query}` : ""}`);
}

export function getBonificacionesGarantias(params) {
  const query = cleanParams(params);
  return apiRequest(
    `/rentabilidad/bonificaciones-garantias${query ? `?${query}` : ""}`
  );
}

export function getReglasRentabilidad(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/reglas${query ? `?${query}` : ""}`);
}

export function crearReglaRentabilidad(payload) {
  return apiRequest("/rentabilidad/reglas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cambiarEstadoReglaRentabilidad(reglaId, activa) {
  return apiRequest(`/rentabilidad/reglas/${reglaId}/estado?activa=${activa}`, {
    method: "PATCH",
  });
}

export function crearCierreRentabilidad(payload) {
  return apiRequest("/rentabilidad/cierres", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCierresRentabilidad(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/cierres${query ? `?${query}` : ""}`);
}

export function getCierreRentabilidad(cierreId) {
  return apiRequest(`/rentabilidad/cierres/${cierreId}`);
}
