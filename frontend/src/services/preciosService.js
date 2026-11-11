import { apiRequest } from "./api";
import { API_BASE_URL } from "../config/appConfig";
import { getStoredAuthToken } from "./sessionStore";

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

export function actualizarCostoReposicionVariante(idVariante, data) {
  return apiRequest(`/precios/variantes/${idVariante}/costo-reposicion`, {
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

export function corregirCargaInicialVariante(idVariante, data) {
  return apiRequest(`/precios/variantes/${idVariante}/correccion-inicial`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function ajustarPreciosProveedor(data) {
  return apiRequest("/precios/ajuste-proveedor", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarFamiliasPrecio() {
  return apiRequest("/precios/familias");
}

export function importarListaPrecios({ archivo, idProveedor, observaciones, idUsuario }) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  formData.append("id_proveedor", String(idProveedor));
  if (observaciones) formData.append("observaciones", observaciones);
  if (idUsuario) formData.append("id_usuario", String(idUsuario));
  return apiRequest("/precios/listas-lotes/importar", {
    method: "POST",
    body: formData,
  });
}

export function listarLotesPrecios(params = {}) {
  return apiRequest(`/precios/listas-lotes${buildQuery(params)}`);
}

export function listarPerfilesListaPrecios(params = {}) {
  return apiRequest(`/precios/listas-perfiles${buildQuery(params)}`);
}

export function obtenerLotePrecios(loteId) {
  return apiRequest(`/precios/listas-lotes/${loteId}`);
}

export function anularLotePrecios(loteId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/anular`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function guardarPerfilListaPrecios(loteId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/perfil`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function procesarCoincidenciasLista(loteId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/coincidencias/procesar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function vincularItemLista(loteId, itemId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/items/${itemId}/vincular`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function desvincularItemLista(loteId, itemId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/items/${itemId}/desvincular`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function generarPreviewLista(loteId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/preview`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarPreviewItemLista(loteId, itemId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/items/${itemId}/preview`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function aplicarListaPrecios(loteId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/aplicar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function revertirListaPrecios(loteId, data) {
  return apiRequest(`/precios/listas-lotes/${loteId}/revertir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function descargarInformeListaPrecios(loteId) {
  const token = getStoredAuthToken();
  const response = await fetch(`${API_BASE_URL}/precios/listas-lotes/${loteId}/informe`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = "No se pudo descargar el informe";
    try {
      const data = await response.json();
      message = data?.detail?.mensaje || data?.detail || message;
    } catch {
      // Conserva el mensaje general si la respuesta no es JSON.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Lote-precios-${loteId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
