import { colors, radius } from "../../theme";

const variants = {
  default: {
    background: "#eef4ff",
    color: colors.secondary,
  },

  success: {
    background: "#ecfdf3",
    color: "#067647",
  },

  warning: {
    background: "#fff8e1",
    color: "#8a6d00",
  },

  danger: {
    background: "#fee4e2",
    color: "#b42318",
  },

  primary: {
    background: colors.primary,
    color: colors.surface,
  },
};

export default function Badge({
  children,
  variant = "default",
  style = {},
}) {
  const current = variants[variant] || variants.default;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: radius.pill,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        ...current,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
