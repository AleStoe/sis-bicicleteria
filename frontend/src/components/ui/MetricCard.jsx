import { colors, radius, shadows, spacing } from "../../theme";

const tones = {
  default: {
    value: colors.text,
    border: "transparent",
  },

  success: {
    value: "#067647",
    border: "rgba(6,118,71,.12)",
  },

  danger: {
    value: "#b42318",
    border: "rgba(180,35,24,.12)",
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
        padding: spacing.md,
        display: "grid",
        gap: 6,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 20,
          color: colors.textMuted,
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontWeight: emphasize ? 800 : 700,
          fontSize: emphasize ? 30 : 24,
          lineHeight: 1.1,
          color: current.value,
        }}
      >
        {value}
      </div>

      {footer && (
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: colors.textMuted,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
