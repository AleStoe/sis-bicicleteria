import { API_BASE_URL } from "../config/appConfig";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const detail = data?.detail;

    if (Array.isArray(detail)) {
      throw new Error(detail.map((e) => e.msg).join(" | "));
    }

    throw new Error(detail || data?.message || "Error en la API");
  }

  return data;
}