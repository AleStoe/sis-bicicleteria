import { API_BASE_URL } from "../config/appConfig";
import { clearStoredSession, getStoredAuthToken } from "./sessionStore";

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = getStoredAuthToken();

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
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
    });
  } catch (err) {
    throw new Error(
      "No se pudo conectar con el servidor. Verificá que el backend esté abierto y que la URL interna sea correcta."
    );
  }

  const contentType = response.headers.get("content-type") || "";

  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

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
        `Error del servidor (${response.status}). Probá refrescar y revisar el backend.`
    );
  }

  return data;
}
