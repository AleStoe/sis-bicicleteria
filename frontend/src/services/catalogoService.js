import { apiRequest } from "./api";

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

export function listarCategorias() {
  return apiRequest("/catalogo/categorias");
}

export function listarMarcas() {
  return apiRequest("/catalogo/marcas");
}

export function crearMarca(data) {
  return apiRequest("/catalogo/marcas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarProductos() {
  return apiRequest("/catalogo/productos");
}

export function obtenerProducto(productoId) {
  return apiRequest(`/catalogo/productos/${productoId}`);
}

export function crearProducto(data) {
  return apiRequest("/catalogo/productos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarProducto(productoId, data) {
  return apiRequest(`/catalogo/productos/${productoId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoProducto(productoId, data) {
  return apiRequest(`/catalogo/productos/${productoId}/estado`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarVariantes() {
  return apiRequest("/catalogo/variantes");
}

export function obtenerVariante(varianteId) {
  return apiRequest(`/catalogo/variantes/${varianteId}`);
}

export function crearVariante(data) {
  return apiRequest("/catalogo/variantes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarVariante(varianteId, data) {
  return apiRequest(`/catalogo/variantes/${varianteId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoVariante(varianteId, data) {
  return apiRequest(`/catalogo/variantes/${varianteId}/estado`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarCatalogoPOS(params = {}) {
  return apiRequest(`/catalogo/pos${buildQuery(params)}`);
}

export function crearImagenCatalogo(data) {
  return apiRequest("/catalogo/imagenes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarImagenesProducto(productoId) {
  return apiRequest(`/catalogo/productos/${productoId}/imagenes`);
}

export function listarImagenesVariante(varianteId) {
  return apiRequest(`/catalogo/variantes/${varianteId}/imagenes`);
}

export function editarImagenCatalogo(imagenId, data) {
  return apiRequest(`/catalogo/imagenes/${imagenId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function eliminarImagenCatalogo(imagenId) {
  return apiRequest(`/catalogo/imagenes/${imagenId}`, {
    method: "DELETE",
  });
}

export function buscarCatalogoPOSExacto(params = {}) {
  return apiRequest(`/catalogo/pos/buscar-exacto${buildQuery(params)}`);
}