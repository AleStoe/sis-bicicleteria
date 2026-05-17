import { spacing, typography, colors } from "../../theme";

export default function PageHeader({
  title,
  subtitle,
  actions,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "start",
        gap: spacing.lg,
        marginBottom: spacing.xl,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: typography.title.fontSize,
            fontWeight: typography.title.fontWeight,
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <div
            style={{
              marginTop: 6,
              color: colors.textMuted,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {actions && (
        <div style={{ display: "flex", gap: spacing.sm }}>
          {actions}
        </div>
      )}
    </div>
  );
}
