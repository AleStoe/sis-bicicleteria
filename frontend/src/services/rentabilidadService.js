import { API_BASE_URL } from "../config/appConfig";
import { apiRequest } from "./api";
import { clearStoredSession, getStoredAuthToken } from "./sessionStore";

function cleanParams(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, value);
    }
  });

  return search.toString();
}

export function getRentabilidadMensual(params) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/mensual${query ? `?${query}` : ""}`);
}

export function getRentabilidadComparacion(params) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/mensual/comparacion${query ? `?${query}` : ""}`);
}

export function getRentabilidadDiaria(params) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/diaria${query ? `?${query}` : ""}`);
}

export function getBonificacionesGarantias(params) {
  const query = cleanParams(params);
  return apiRequest(
    `/rentabilidad/bonificaciones-garantias${query ? `?${query}` : ""}`
  );
}

export function getReglasRentabilidad(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/reglas${query ? `?${query}` : ""}`);
}

export function crearReglaRentabilidad(payload) {
  return apiRequest("/rentabilidad/reglas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cambiarEstadoReglaRentabilidad(reglaId, activa) {
  return apiRequest(`/rentabilidad/reglas/${reglaId}/estado?activa=${activa}`, {
    method: "PATCH",
  });
}

export function crearCierreRentabilidad(payload) {
  return apiRequest("/rentabilidad/cierres", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function anularCierreRentabilidad(cierreId, payload) {
  return apiRequest(`/rentabilidad/cierres/${cierreId}/anular`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCierresRentabilidad(params = {}) {
  const query = cleanParams(params);
  return apiRequest(`/rentabilidad/cierres${query ? `?${query}` : ""}`);
}

export function getCierreRentabilidad(cierreId) {
  return apiRequest(`/rentabilidad/cierres/${cierreId}`);
}

function filenameFromDisposition(disposition, fallback) {
  const match = String(disposition || "").match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

function fechaDescargaLocal() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resultadoDistribuibleFallbackName(params = {}) {
  const periodo = String(params.periodo_mes || "").slice(0, 7) || "Periodo";
  return `Resultado-Distribuible-${periodo}-${fechaDescargaLocal()}.pdf`;
}

export async function descargarResultadoDistribuiblePdf(params = {}) {
  const query = cleanParams(params);
  const token = getStoredAuthToken();
  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/rentabilidad/resultado-distribuible/pdf${query ? `?${query}` : ""}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
  } catch {
    throw new Error("No se pudo conectar con el servidor para descargar el informe.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
      window.dispatchEvent(new Event("session-expired"));
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    throw new Error(
      data?.detail || `No se pudo descargar el informe (${response.status}).`,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(
    response.headers.get("content-disposition"),
    resultadoDistribuibleFallbackName(params),
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
