import { colors, radius } from "../../theme";

const variants = {
  default: {
    background: colors.secondarySoft,
    color: colors.secondary,
  },

  success: {
    background: colors.successSoft,
    color: colors.successDark,
  },

  warning: {
    background: colors.warningSoft,
    color: colors.warningDark,
  },

  danger: {
    background: colors.dangerSoft,
    color: colors.dangerDark,
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
