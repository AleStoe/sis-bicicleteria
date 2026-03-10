import { apiRequest } from "./api";

export function listarStock() {
  return apiRequest("/stock/");
}
