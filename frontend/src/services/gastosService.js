import { apiRequest } from "./api";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "todos") return;
    query.append(key, String(value));
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listarCategoriasGasto({ incluir_inactivas = false } = {}) {
  const qs = incluir_inactivas ? "?incluir_inactivas=true" : "";
  return apiRequest(`/gastos/categorias${qs}`);
}

export function crearCategoriaGasto(data) {
  return apiRequest("/gastos/categorias", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarCategoriaGasto(categoriaId, data) {
  return apiRequest(`/gastos/categorias/${categoriaId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function cambiarEstadoCategoriaGasto(categoriaId, activa) {
  return apiRequest(`/gastos/categorias/${categoriaId}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activa }),
  });
}

export function listarGastos(filtros = {}) {
  return apiRequest(`/gastos/${buildQuery(filtros)}`);
}

export function obtenerResumenGastos(filtros = {}) {
  const { limit, offset, ...rest } = filtros;
  return apiRequest(`/gastos/resumen${buildQuery(rest)}`);
}

export function obtenerGasto(gastoId) {
  return apiRequest(`/gastos/${gastoId}`);
}

export function crearGasto(data) {
  return apiRequest("/gastos/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function corregirGasto(gastoId, data) {
  return apiRequest(`/gastos/${gastoId}/corregir`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function anularGasto(gastoId, data) {
  return apiRequest(`/gastos/${gastoId}/anular`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
