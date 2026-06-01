import { createContext, useCallback, useMemo, useState } from "react";

export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((actuales) => actuales.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", message, duration = 3500 }) => {
      const id = crypto.randomUUID();

      setToasts((actuales) => [
        ...actuales,
        {
          id,
          type,
          message,
        },
      ]);

      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (message, options = {}) =>
        showToast({ ...options, type: "success", message }),
      error: (message, options = {}) =>
        showToast({ ...options, type: "error", message }),
      warning: (message, options = {}) =>
        showToast({ ...options, type: "warning", message }),
      info: (message, options = {}) =>
        showToast({ ...options, type: "info", message }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div style={styles.container}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ ...styles.toast, ...styles[toast.type] }}>
            {toast.message}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              style={styles.closeButton}
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 420,
  },
  toast: {
    borderRadius: 12,
    padding: "12px 14px",
    paddingRight: 38,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
    fontSize: 14,
    lineHeight: 1.35,
    position: "relative",
    border: "1px solid transparent",
  },
  success: {
    background: "#ecfdf3",
    borderColor: "#bbf7d0",
    color: "#166534",
  },
  error: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#991b1b",
  },
  warning: {
    background: "#fffbeb",
    borderColor: "#fde68a",
    color: "#92400e",
  },
  info: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1e40af",
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 10,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    color: "inherit",
  },
};