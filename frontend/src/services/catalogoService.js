import { apiRequest } from "./api";

export function listarVariantes() {
  return apiRequest("/catalogo/variantes");
}
