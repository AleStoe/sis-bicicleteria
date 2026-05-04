import { apiRequest } from "./api";

export function listarSerializadas(params = {}) {
  const query = new URLSearchParams();

  if (params.id_variante) query.set("id_variante", params.id_variante);
  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.estado) query.set("estado", params.estado);

  const qs = query.toString();
  return apiRequest(`/bicicletas_serializadas${qs ? `?${qs}` : ""}`);
}

export function listarSerializadasDisponibles(params = {}) {
  const query = new URLSearchParams();

  if (params.id_variante) query.set("id_variante", params.id_variante);
  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);

  const qs = query.toString();
  return apiRequest(`/bicicletas_serializadas/disponibles${qs ? `?${qs}` : ""}`);
}

export function crearSerializada(data) {
  return apiRequest("/bicicletas_serializadas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}