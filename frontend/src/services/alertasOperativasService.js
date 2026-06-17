import { apiRequest } from "./api";

export function obtenerAlertasOperativas(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return apiRequest(`/alertas-operativas/${qs ? `?${qs}` : ""}`);
}
