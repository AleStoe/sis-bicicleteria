import { apiRequest } from "./api";
import { API_BASE_URL } from "../config/appConfig";
import { getStoredAuthToken } from "./sessionStore";

export function listarSerializadas(params = {}) {
  const query = new URLSearchParams();

  if (params.id_variante) query.set("id_variante", params.id_variante);
  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.query) query.set("query", params.query);
  if (params.estado) query.set("estado", params.estado);
  if (params.estado_tecnico) query.set("estado_tecnico", params.estado_tecnico);
  if (params.condicion_comercial) query.set("condicion_comercial", params.condicion_comercial);
  if (params.ubicacion_fisica) query.set("ubicacion_fisica", params.ubicacion_fisica);

  const qs = query.toString();
  return apiRequest(`/bicicletas_serializadas${qs ? `?${qs}` : ""}`);
}

export function listarSerializadasDisponibles(params = {}) {
  const query = new URLSearchParams();

  if (params.id_variante) query.set("id_variante", params.id_variante);
  if (params.id_sucursal) query.set("id_sucursal", params.id_sucursal);
  if (params.query) query.set("query", params.query);

  const qs = query.toString();
  return apiRequest(`/bicicletas_serializadas/disponibles${qs ? `?${qs}` : ""}`);
}

export function crearSerializada(data) {
  return apiRequest("/bicicletas_serializadas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarFichaSerializada(idBicicletaSerializada, data) {
  return apiRequest(`/bicicletas_serializadas/${idBicicletaSerializada}/ficha`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function corregirNumeroCuadroSerializada(idBicicletaSerializada, data, params = {}) {
  const query = new URLSearchParams();

  if (params.origen_accion) query.set("origen_accion", params.origen_accion);

  const qs = query.toString();

  return apiRequest(
    `/bicicletas_serializadas/${idBicicletaSerializada}/numero-cuadro${qs ? `?${qs}` : ""}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export function listarCorreccionesNumeroCuadro(idBicicletaSerializada) {
  return apiRequest(
    `/bicicletas_serializadas/${idBicicletaSerializada}/correcciones-numero-cuadro`
  );
}

export function getEtiquetaQrBicicletaUrl(idBicicletaSerializada) {
  const token = getStoredAuthToken();
  const base = `${API_BASE_URL}/documentos/etiquetas/bicicletas/${idBicicletaSerializada}/deposito`;
  return token ? `${base}?access_token=${encodeURIComponent(token)}` : base;
}
