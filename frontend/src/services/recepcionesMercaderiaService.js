import { apiRequest } from "./api";

export function listarRecepcionesMercaderia(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return apiRequest(`/recepciones-mercaderia/${query ? `?${query}` : ""}`);
}

export function importarTablaRecepcionMercaderia(payload) {
  return apiRequest("/recepciones-mercaderia/importar-tabla", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function importarDocumentoRecepcionMercaderia(payload) {
  const form = new FormData();
  form.append("archivo", payload.archivo);
  form.append("id_proveedor", String(payload.id_proveedor));
  form.append("id_sucursal", String(payload.id_sucursal));
  if (payload.observaciones) form.append("observaciones", payload.observaciones);
  if (payload.id_usuario) form.append("id_usuario", String(payload.id_usuario));
  if (payload.recepcion_id) form.append("recepcion_id", String(payload.recepcion_id));
  return apiRequest("/recepciones-mercaderia/importar-documento", {
    method: "POST",
    body: form,
  });
}

export function reprocesarDocumentoRecepcionMercaderia(documentoId, { reemplazarLineas = false } = {}) {
  const query = reemplazarLineas ? "?reemplazar_lineas=true" : "";
  return apiRequest(`/recepciones-mercaderia/documentos/${documentoId}/reprocesar${query}`, {
    method: "POST",
  });
}

export function obtenerRecepcionMercaderia(recepcionId) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}`);
}

export function prepararAltaRecepcionMercaderia(recepcionId, itemId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/preparar-alta`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function subirImagenItemRecepcionMercaderia(recepcionId, itemId, archivo) {
  const form = new FormData();
  form.append("archivo", archivo);
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/imagen`, {
    method: "POST",
    body: form,
  });
}

export function quitarImagenItemRecepcionMercaderia(recepcionId, itemId) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/imagen`, {
    method: "DELETE",
  });
}

export function sugerirPreciosItemRecepcionMercaderia(recepcionId, itemId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/precios/sugerir`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function aceptarVinculoRecepcionMercaderia(recepcionId, itemId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/vincular`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deshacerCoincidenciaRecepcionMercaderia(recepcionId, itemId, payload = {}) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/deshacer-coincidencia`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function agregarLecturaRecepcionMercaderia(recepcionId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/lectura`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function corregirLecturaRecepcionMercaderia(recepcionId, itemId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/lectura`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function configurarCostosRecepcionMercaderia(recepcionId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/costos`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function previsualizarPreciosRecepcionMercaderia(recepcionId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/precios/previsualizar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function guardarPrecioRecepcionMercaderia(recepcionId, itemId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}/precio`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function confirmarRecepcionMercaderia(recepcionId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/confirmar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function anularRecepcionMercaderia(recepcionId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/anular`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function eliminarLineaRecepcionMercaderia(recepcionId, itemId, payload = {}) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/${itemId}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export function eliminarDocumentoRecepcionMercaderia(recepcionId, documentoId, payload = {}) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/documentos/${documentoId}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export function clasificarItemsRecepcionMercaderia(recepcionId, payload) {
  return apiRequest(`/recepciones-mercaderia/${recepcionId}/items/clasificacion-masiva`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function resolverReglaSugeridaRecepcionMercaderia(sugerenciaId, payload) {
  return apiRequest(`/recepciones-mercaderia/reglas-sugeridas/${sugerenciaId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
