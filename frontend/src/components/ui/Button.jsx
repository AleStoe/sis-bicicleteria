import { colors, controls, radius, shadows, typography } from "../../theme";

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
        minWidth: 0,
        minHeight: controls.minHeight,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: radius.md,
        padding: controls.padding,
        fontSize: typography.button.fontSize,
        fontWeight: typography.button.fontWeight,
        lineHeight: typography.button.lineHeight,
        whiteSpace: "normal",
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
