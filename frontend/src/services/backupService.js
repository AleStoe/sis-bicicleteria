import { API_BASE_URL } from "../config/appConfig";
import { apiRequest } from "./api";
import { clearStoredSession, getStoredAuthToken } from "./sessionStore";


export function listarBackups() {
  return apiRequest("/backups/");
}


export function generarBackup(incluirUploads = false) {
  return apiRequest("/backups/", {
    method: "POST",
    body: JSON.stringify({ incluir_uploads: incluirUploads }),
  });
}


export async function descargarBackup(nombre) {
  const token = getStoredAuthToken();
  let response;
  try {
    response = await fetch(
      `${API_BASE_URL}/backups/${encodeURIComponent(nombre)}/descargar`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor para descargar el backup.",
    );
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
      data?.detail || `No se pudo descargar el backup (${response.status}).`,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
