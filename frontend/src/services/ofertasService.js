import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listarOfertas(params = {}) {
  return apiRequest(`/ofertas${buildQuery(params)}`);
}

export function crearOferta(data) {
  return apiRequest("/ofertas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarOferta(ofertaId, data) {
  return apiRequest(`/ofertas/${ofertaId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoOferta(ofertaId, data) {
  return apiRequest(`/ofertas/${ofertaId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
