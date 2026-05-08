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

export function listarVariantes() {
  return apiRequest("/catalogo/variantes");
}

export function listarCatalogoPOS(params = {}) {
  return apiRequest(`/catalogo/pos${buildQuery(params)}`);
}

export function crearProducto(data) {
  return apiRequest("/catalogo/productos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function crearVariante(data) {
  return apiRequest("/catalogo/variantes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function crearImagenCatalogo(data) {
  return apiRequest("/catalogo/imagenes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}