import { apiRequest } from "./api";

export function listarProveedores(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value).trim());
    }
  });

  const qs = searchParams.toString();
  return apiRequest(`/proveedores/${qs ? `?${qs}` : ""}`);
}

export function crearProveedor(data) {
  return apiRequest("/proveedores/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarProveedor(id, data) {
  return apiRequest(`/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function activarProveedor(id) {
  return apiRequest(`/proveedores/${id}/activar`, {
    method: "PATCH",
  });
}

export function desactivarProveedor(id) {
  return apiRequest(`/proveedores/${id}/desactivar`, {
    method: "PATCH",
  });
}
