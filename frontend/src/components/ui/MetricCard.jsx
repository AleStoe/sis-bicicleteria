import { colors, radius, shadows, spacing, typography } from "../../theme";

const tones = {
  default: {
    value: colors.text,
    border: "transparent",
  },

  success: {
    value: colors.successDark,
    border: "rgba(6,118,71,.12)",
  },

  danger: {
    value: colors.dangerDark,
    border: "rgba(180,35,24,.12)",
  },

  warning: {
    value: colors.warningDark,
    border: "rgba(217,119,6,.16)",
  },

  primary: {
    value: colors.primary,
    border: "rgba(255,106,0,.12)",
  },
};

export default function MetricCard({
  label,
  value,
  tone = "default",
  emphasize = false,
  footer,
  style = {},
}) {
  const current = tones[tone] || tones.default;

  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px solid ${current.border}`,
        boxShadow: shadows.sm,
        minWidth: 0,
        padding: spacing.md,
        display: "grid",
        alignContent: "start",
        gap: spacing.xs,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: typography.label.fontSize,
          color: colors.textMuted,
          fontWeight: typography.label.fontWeight,
          lineHeight: typography.label.lineHeight,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontWeight: typography.metric.fontWeight,
          fontSize: emphasize ? 28 : typography.metric.fontSize,
          lineHeight: typography.metric.lineHeight,
          color: current.value,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>

      {footer && (
        <div
          style={{
            marginTop: 2,
            fontSize: typography.small.fontSize,
            color: colors.textMuted,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
