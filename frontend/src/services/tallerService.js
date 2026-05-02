import { apiRequest } from "./api";

export function listarOrdenesTaller() {
  return apiRequest("/ordenes_taller/");
}

export function obtenerOrdenTaller(ordenId) {
  return apiRequest(`/ordenes_taller/${ordenId}`);
}

export function crearOrdenTaller(data) {
  return apiRequest("/ordenes_taller/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoOrdenTaller(ordenId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/estado`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function agregarItemOrdenTaller(ordenId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function aprobarItemOrdenTaller(ordenId, itemId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/items/${itemId}/aprobacion`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function ejecutarItemOrdenTaller(ordenId, itemId, idUsuario) {
  return apiRequest(
    `/ordenes_taller/${ordenId}/items/${itemId}/ejecutar?id_usuario=${idUsuario}`,
    {
      method: "POST",
    }
  );
}

export function revertirEjecucionItemOrdenTaller(ordenId, itemId, data) {
  return apiRequest(
    `/ordenes_taller/${ordenId}/items/${itemId}/revertir-ejecucion`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export function cancelarItemOrdenTaller(ordenId, itemId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/items/${itemId}/cancelar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
