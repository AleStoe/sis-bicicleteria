import { useEffect, useState } from "react";

export function PromptModal({
  open,
  title = "Ingresar dato",
  message = "",
  label = "Valor",
  defaultValue = "",
  placeholder = "",
  inputType = "text",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  minLength = 0,
  required = false,
  validate,
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue(defaultValue ?? "");
      setError("");
    }
  }, [open, defaultValue]);

  if (!open) return null;

  function handleConfirm() {
    const texto = String(value ?? "").trim();

    if (required && !texto) {
      setError("Este campo es obligatorio");
      return;
    }

    if (minLength > 0 && texto.length < minLength) {
      setError(`Debe tener al menos ${minLength} caracteres`);
      return;
    }

    if (typeof validate === "function") {
      const validationError = validate(texto);

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    onConfirm?.(texto);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      handleConfirm();
    }

    if (e.key === "Escape") {
      onCancel?.();
    }
  }

  return (
    <div style={styles.backdrop} role="presentation" onClick={onCancel}>
      <div
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="prompt-modal-title" style={styles.title}>
          {title}
        </h2>

        {message ? <p style={styles.message}>{message}</p> : null}

        <label style={styles.label}>
          {label}
          <input
            autoFocus
            type={inputType}
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            style={styles.input}
          />
        </label>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.actions}>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            {cancelText}
          </button>

          <button type="button" style={styles.confirmButton} onClick={handleConfirm}>
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
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  message: {
    whiteSpace: "pre-line",
    margin: "10px 0 14px",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 650,
  },
  label: {
    display: "grid",
    gap: 8,
    color: "#334155",
    fontWeight: 850,
    fontSize: 14,
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    fontSize: 15,
    outline: "none",
  },
  error: {
    marginTop: 10,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 750,
    fontSize: 13,
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
    background: "#2563eb",
    color: "white",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 950,
    cursor: "pointer",
  },
};