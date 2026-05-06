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

export function recalcularPreciosProveedor(data) {
  return apiRequest("/precios/recalcular-proveedor", {
    method: "POST",
    body: JSON.stringify(data),
  });
}