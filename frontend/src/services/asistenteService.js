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

export function getAsistenteResumen(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/asistente/resumen${query ? `?${query}` : ""}`);
}

export function preguntarAsistente({ pregunta, id_sucursal, cliente_id, periodo = "365d" }) {
  return apiRequest("/asistente/preguntar", {
    method: "POST",
    body: JSON.stringify({ pregunta, id_sucursal, cliente_id, periodo }),
  });
}
