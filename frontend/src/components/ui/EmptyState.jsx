import { Inbox } from "lucide-react";
import { colors, radius, spacing, typography } from "../../theme";

export default function EmptyState({
  title = "Sin información",
  description,
  icon: Icon = Inbox,
  action,
  compact = false,
  style = {},
}) {
  return (
    <div
      style={{
        minHeight: compact ? 120 : 180,
        display: "grid",
        placeItems: "center",
        padding: compact ? spacing.lg : spacing.xl,
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.lg,
        background: colors.surfaceMuted,
        textAlign: "center",
        ...style,
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: spacing.sm }}>
        <Icon size={compact ? 24 : 30} color={colors.textSubtle} aria-hidden="true" />
        <strong
          style={{
            color: colors.textStrong,
            fontSize: typography.body.fontSize,
          }}
        >
          {title}
        </strong>
        {description ? (
          <span
            style={{
              maxWidth: 420,
              color: colors.textMuted,
              fontSize: typography.small.fontSize,
              lineHeight: typography.small.lineHeight,
            }}
          >
            {description}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}
