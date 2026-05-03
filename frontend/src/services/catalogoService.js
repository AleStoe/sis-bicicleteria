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

export function listarCategorias() {
  return apiRequest("/catalogo/categorias");
}

export function listarVariantes() {
  return apiRequest("/catalogo/variantes");
}

export function listarCatalogoPOS(params = {}) {
  return apiRequest(`/catalogo/pos${buildQuery(params)}`);
}
