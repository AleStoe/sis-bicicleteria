import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function listarPreciosDesfasados(params = {}) {
  return apiRequest(`/precios/desfasados${buildQuery(params)}`);
}

export function obtenerPrecioVariante(idVariante) {
  return apiRequest(`/precios/variantes/${idVariante}`);
}

export function actualizarPrecioVariante(idVariante, data) {
  return apiRequest(`/precios/variantes/${idVariante}/actualizar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function obtenerHistorialPrecioVariante(idVariante) {
  return apiRequest(`/precios/variantes/${idVariante}/historial`);
}

export function sugerirPrecioVariante(idVariante, data) {
  return apiRequest(`/precios/variantes/${idVariante}/sugerir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarReglasPrecio(params = {}) {
  return apiRequest(`/precios/reglas${buildQuery(params)}`);
}

export function crearReglaPrecio(data) {
  return apiRequest("/precios/reglas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function desactivarReglaPrecio(reglaId, data) {
  return apiRequest(`/precios/reglas/${reglaId}/desactivar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function recalcularPreciosProveedor(data) {
  return apiRequest("/precios/recalcular-proveedor", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarFamiliasPrecio() {
  return apiRequest("/precios/familias");
}