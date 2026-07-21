import { apiRequest } from "./api";
import { getPresupuestoTallerUrl as buildPresupuestoTallerUrl } from "./documentosService";

export function listarOrdenesTaller(params = {}) {
  const query = new URLSearchParams();

  if (params.vista) query.set("vista", params.vista);
  if (params.estado) query.set("estado", params.estado);
  if (params.solo_pendientes !== undefined) {
    query.set("solo_pendientes", String(params.solo_pendientes));
  }

  const qs = query.toString();
  return apiRequest(`/ordenes_taller/${qs ? `?${qs}` : ""}`);
}

export function obtenerDashboardTaller() {
  return apiRequest("/ordenes_taller/dashboard/resumen");
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

export function actualizarCantidadItemBorradorOrdenTaller(ordenId, itemId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/items/${itemId}/cantidad`, {
    method: "PATCH",
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

export function quitarItemBorradorOrdenTaller(ordenId, itemId, idUsuario) {
  const qs = idUsuario ? `?id_usuario=${idUsuario}` : "";
  return apiRequest(`/ordenes_taller/${ordenId}/items/${itemId}${qs}`, {
    method: "DELETE",
  });
}


export function generarVentaDesdeOrdenTaller(ordenId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/generar-venta`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}


export function getPresupuestoTallerUrl(ordenId) {
  return buildPresupuestoTallerUrl(ordenId);
}

export function actualizarOperativoOrdenTaller(ordenId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/operativo`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function generarMensajeListaRetiroOrdenTaller(ordenId) {
  return apiRequest(`/ordenes_taller/${ordenId}/mensaje-lista-retiro`);
}

export function marcarAvisoRetiroOrdenTaller(ordenId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/aviso-retiro`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function crearNotaOrdenTaller(ordenId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/notas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarNotaOrdenTaller(ordenId, notaId, data) {
  return apiRequest(`/ordenes_taller/${ordenId}/notas/${notaId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
