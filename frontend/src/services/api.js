import { API_BASE_URL, API_BASE_URL_CANDIDATES } from "../config/appConfig";
import { clearStoredSession, getStoredAuthToken } from "./sessionStore";

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = getStoredAuthToken();

  let response;

  const requestOptions = {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      ...(options.headers || {}),
    },
  };
  const method = String(requestOptions.method || "GET").toUpperCase();
  const allowFallback = method === "GET" || method === "HEAD";

  try {
    response = await fetchWithFallback(path, requestOptions, allowFallback);
  } catch (err) {
    throw new Error(
      "No se pudo conectar con el servidor. Verificá que el backend esté abierto y que la URL interna sea correcta."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const rawBody =
    response.status === 204 || response.status === 205
      ? ""
      : await response.text();
  let data = null;

  if (rawBody && contentType.includes("application/json")) {
    try {
      data = JSON.parse(rawBody);
    } catch (err) {
      if (response.ok) {
        throw new Error("El servidor devolvió una respuesta inválida.");
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") {
      clearStoredSession();
      window.dispatchEvent(new Event("session-expired"));
    }

    const detail = data?.detail;

    if (Array.isArray(detail)) {
      throw new Error(detail.map((e) => e.msg).join(" | "));
    }

    throw new Error(
      detail ||
        data?.message ||
        rawBody ||
        `Error del servidor (${response.status}). Probá refrescar y revisar el backend.`
    );
  }

  return data;
}

async function fetchWithFallback(path, options, allowFallback) {
  const candidates = API_BASE_URL_CANDIDATES?.length
    ? API_BASE_URL_CANDIDATES
    : [API_BASE_URL];
  const bases = allowFallback ? candidates : [API_BASE_URL];
  let lastError;

  for (const baseUrl of bases) {
    try {
      return await fetch(`${baseUrl}${path}`, options);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
