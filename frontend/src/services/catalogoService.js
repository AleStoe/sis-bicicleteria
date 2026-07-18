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

function withAccessToken(url) {
  const token = getStoredAuthToken();
  if (!token) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}

export function listarCategorias(params = {}) {
  return apiRequest(`/catalogo/categorias${buildQuery(params)}`);
}

export function crearCategoria(data) {
  return apiRequest("/catalogo/categorias", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarCategoria(categoriaId, data) {
  return apiRequest(`/catalogo/categorias/${categoriaId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoCategoria(categoriaId, data) {
  return apiRequest(`/catalogo/categorias/${categoriaId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function listarMarcas(params = {}) {
  return apiRequest(`/catalogo/marcas${buildQuery(params)}`);
}

export function crearMarca(data) {
  return apiRequest("/catalogo/marcas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarMarca(marcaId, data) {
  return apiRequest(`/catalogo/marcas/${marcaId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoMarca(marcaId, data) {
  return apiRequest(`/catalogo/marcas/${marcaId}/estado`, {
    method: "PATCH",
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

export function cambiarReponerStockVariante(varianteId, data) {
  return apiRequest(`/catalogo/variantes/${varianteId}/reponer-stock`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cambiarReponerStockVariantesMasivo(data) {
  return apiRequest("/catalogo/variantes/reponer-stock-masivo", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listarCatalogoPOS(params = {}) {
  return apiRequest(`/catalogo/pos${buildQuery(params)}`);
}

export function getCatalogoMayoristaPdfUrl(params = {}) {
  return withAccessToken(`${API_BASE_URL}/catalogo/pdf/mayorista${buildQuery(params)}`);
}

export function getCatalogoBicicletasPdfUrl(params = {}) {
  return withAccessToken(`${API_BASE_URL}/catalogo/pdf/bicicletas${buildQuery(params)}`);
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

export function subirImagenCatalogo({
  archivo,
  id_producto = null,
  id_variante = null,
  es_principal = true,
  orden = 0,
}) {
  const formData = new FormData();

  formData.append("archivo", archivo);

  if (id_producto !== null && id_producto !== undefined) {
    formData.append("id_producto", String(id_producto));
  }

  if (id_variante !== null && id_variante !== undefined) {
    formData.append("id_variante", String(id_variante));
  }

  formData.append("es_principal", String(es_principal));
  formData.append("orden", String(orden));

  return apiRequest("/catalogo/imagenes/upload", {
    method: "POST",
    body: formData,
  });
}

export function obtenerFichaTecnicaProducto(productoId) {
  return apiRequest(`/catalogo/productos/${productoId}/ficha-tecnica`);
}

export function reemplazarFichaTecnicaProducto(productoId, data) {
  return apiRequest(`/catalogo/productos/${productoId}/ficha-tecnica`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
