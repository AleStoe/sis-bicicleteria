import { apiRequest } from "./api";

export function listarUsuarios(params = {}) {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.solo_activos) query.set("solo_activos", "true");

  const qs = query.toString();
  return apiRequest(`/usuarios${qs ? `?${qs}` : "/"}`);
}

export function obtenerUsuario(usuarioId) {
  return apiRequest(`/usuarios/${usuarioId}`);
}

export function crearUsuario(data) {
  return apiRequest("/usuarios/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarUsuario(usuarioId, data) {
  return apiRequest(`/usuarios/${usuarioId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function activarUsuario(usuarioId) {
  return apiRequest(`/usuarios/${usuarioId}/activar`, {
    method: "PATCH",
  });
}

export function desactivarUsuario(usuarioId) {
  return apiRequest(`/usuarios/${usuarioId}/desactivar`, {
    method: "PATCH",
  });
}

export function resetearPasswordUsuario(usuarioId, data) {
  return apiRequest(`/usuarios/${usuarioId}/password`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cambiarPasswordPropia(usuarioId, data) {
  return apiRequest(`/usuarios/${usuarioId}/password-propia`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}