export const SESSION_STORAGE_KEY = "erp_session_usuario";

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveStoredSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getStoredAuthToken() {
  return getStoredSession()?.token || null;
}
