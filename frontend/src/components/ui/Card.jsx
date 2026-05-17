import { colors, radius, shadows, spacing } from "../../theme";

export default function Card({
  children,
  title,
  subtitle,
  actions,
  style = {},
  bodyStyle = {},
}) {
  return (
    <section
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: "0 2px 10px rgba(16,24,40,.04)",
        border: `1px solid rgba(16,24,40,.06)`,
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || subtitle || actions) && (
        <header
          style={{
            padding: `${spacing.lg} ${spacing.lg} ${spacing.md}`,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: spacing.md,
          }}
        >
          <div>
            {title && (
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {title}
              </h3>
            )}

            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  color: colors.textMuted,
                  fontSize: 13,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {actions}
        </header>
      )}

      <div
        style={{
          padding: spacing.lg,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </section>
  );
}
