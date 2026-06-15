import { API_BASE_URL } from "../config/appConfig";
import { clearStoredSession, getStoredAuthToken } from "./sessionStore";

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = getStoredAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      ...(options.headers || {}),
    },
    ...options,
  });

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

    throw new Error(detail || data?.message || "Error en la API");
  }

  return data;
}
