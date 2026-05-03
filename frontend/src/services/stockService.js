import { apiRequest } from "./api";

export function listarStock() {
  return apiRequest("/stock/");
}

export function crearIngresoStock(data) {
  return apiRequest("/stock/ingresos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function crearAjusteStock(data) {
  return apiRequest("/stock/ajustes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
