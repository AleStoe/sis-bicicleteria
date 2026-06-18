import { apiRequest } from "./api";

export function obtenerConfiguracionNegocio() {
  return apiRequest("/configuracion-negocio");
}

export function actualizarConfiguracionNegocio(data) {
  return apiRequest("/configuracion-negocio", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
