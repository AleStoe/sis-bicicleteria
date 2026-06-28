
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:8000";

  const hostname = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";

  return `${protocol}//${hostname}:8000`;
}

function uniqueUrls(urls) {
  return urls
    .filter(Boolean)
    .map((url) => String(url).replace(/\/+$/, ""))
    .filter((url, index, array) => array.indexOf(url) === index);
}

export const API_BASE_URL = (ENV_API_BASE_URL || getRuntimeApiBaseUrl()).replace(/\/+$/, "");

export const API_BASE_URL_CANDIDATES = uniqueUrls([
  ENV_API_BASE_URL,
  getRuntimeApiBaseUrl(),
  "http://127.0.0.1:8000",
  "http://localhost:8000",
]);

