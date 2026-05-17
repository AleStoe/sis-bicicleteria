import { colors, radius, shadows } from "../../theme";

const variants = {
  primary: {
    background: colors.primary,
    color: colors.surface,
    border: "none",
  },

  secondary: {
    background: colors.secondary,
    color: colors.surface,
    border: "none",
  },

  outline: {
    background: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
  },

  danger: {
    background: colors.danger,
    color: colors.surface,
    border: "none",
  },
};

export default function Button({
  children,
  variant = "primary",
  disabled = false,
  fullWidth = false,
  style = {},
  ...props
}) {
  const current = variants[variant] || variants.primary;

  return (
    <button
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : undefined,
        borderRadius: radius.md,
        padding: "10px 14px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: disabled ? "none" : shadows.sm,
        transition: "all .15s ease",
        filter: disabled ? "grayscale(.2)" : "none",
        ...current,
        ...(disabled
          ? {
              background: "#e5e7eb",
              color: "#6b7280",
              border: "1px solid #d1d5db",
            }
          : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
