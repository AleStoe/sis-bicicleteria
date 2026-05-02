import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listarDeudas(filtros = {}) {
  return apiRequest(`/deudas/${buildQuery(filtros)}`);
}

export function obtenerDeuda(deudaId) {
  return apiRequest(`/deudas/${deudaId}`);
}

export function registrarPagoDeuda(deudaId, data) {
  return apiRequest(`/deudas/${deudaId}/pagos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
