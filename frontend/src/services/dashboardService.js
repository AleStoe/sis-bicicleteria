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

export function getDashboardResumen(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/dashboard/resumen${query ? `?${query}` : ""}`);
}
