export function ConfirmModal({
  open,
  title = "Confirmar acción",
  message = "¿Confirmás esta operación?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const variantStyle = styles.variants[variant] ?? styles.variants.danger;

  return (
    <div style={styles.backdrop} role="presentation" onClick={onCancel}>
      <div
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...styles.icon, ...variantStyle.icon }}>
          {variant === "warning" ? "!" : "×"}
        </div>

        <div>
          <h2 id="confirm-modal-title" style={styles.title}>
            {title}
          </h2>

          <p style={styles.message}>{message}</p>
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            {cancelText}
          </button>

          <button
            type="button"
            style={{ ...styles.confirmButton, ...variantStyle.button }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    background: "white",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.32)",
    border: "1px solid #e2e8f0",
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
    fontSize: 24,
    marginBottom: 14,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  message: {
    whiteSpace: "pre-line",
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 650,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#334155",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  confirmButton: {
    border: "none",
    color: "white",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 950,
    cursor: "pointer",
  },
  variants: {
    danger: {
      icon: {
        background: "#fef2f2",
        color: "#dc2626",
      },
      button: {
        background: "#dc2626",
      },
    },
    warning: {
      icon: {
        background: "#fffbeb",
        color: "#d97706",
      },
      button: {
        background: "#d97706",
      },
    },
    info: {
      icon: {
        background: "#eff6ff",
        color: "#2563eb",
      },
      button: {
        background: "#2563eb",
      },
    },
  },
};