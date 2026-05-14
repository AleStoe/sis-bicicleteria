import { API_BASE_URL } from "../config/appConfig";

export function getImageUrl(path) {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

// Alias temporal para no romper componentes viejos.
// Más adelante migramos todo a getImageUrl y borramos esto.
export const buildImageUrl = getImageUrl;