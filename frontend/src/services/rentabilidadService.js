const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function cleanParams(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, value);
    }
  });
  return search.toString();
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.detail || "Error en módulo Rentabilidad");
  }

  return data;
}

export function getRentabilidadMensual(params) {
  const query = cleanParams(params);
  return request(`/rentabilidad/mensual?${query}`);
}

export function getReglasRentabilidad(params = {}) {
  const query = cleanParams(params);
  return request(`/rentabilidad/reglas${query ? `?${query}` : ""}`);
}

export function crearReglaRentabilidad(payload) {
  return request("/rentabilidad/reglas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cambiarEstadoReglaRentabilidad(reglaId, activa) {
  return request(`/rentabilidad/reglas/${reglaId}/estado?activa=${activa}`, {
    method: "PATCH",
  });
}

export function crearCierreRentabilidad(payload) {
  return request("/rentabilidad/cierres", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCierresRentabilidad(params = {}) {
  const query = cleanParams(params);
  return request(`/rentabilidad/cierres${query ? `?${query}` : ""}`);
}

export function getCierreRentabilidad(cierreId) {
  return request(`/rentabilidad/cierres/${cierreId}`);
}
