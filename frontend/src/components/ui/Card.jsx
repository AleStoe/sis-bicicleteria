import { colors, radius, shadows, spacing, typography } from "../../theme";
import useBreakpoint from "./responsive/useBreakpoint";

export default function Card({
  children,
  title,
  subtitle,
  actions,
  style = {},
  bodyStyle = {},
}) {
  const isMobile = useBreakpoint(760);

  return (
    <section
      style={{
        background: colors.surface,
        borderRadius: isMobile ? radius.md : radius.lg,
        boxShadow: shadows.sm,
        border: `1px solid ${colors.borderSoft}`,
        overflow: "hidden",
        minWidth: 0,
        ...style,
      }}
    >
      {(title || subtitle || actions) && (
        <header
          style={{
            padding: isMobile ? spacing.md : `${spacing.lg} ${spacing.lg} ${spacing.md}`,
            borderBottom: `1px solid ${colors.border}`,
            display: isMobile ? "grid" : "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: spacing.md,
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <h3 style={{
                margin: 0,
                color: colors.textStrong,
                fontFamily: typography.fontFamily,
                fontSize: isMobile ? 16 : typography.sectionTitle.fontSize,
                fontWeight: typography.sectionTitle.fontWeight,
                lineHeight: typography.sectionTitle.lineHeight,
                overflowWrap: "anywhere",
              }}>
                {title}
              </h3>
            )}

            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  color: colors.textMuted,
                  fontSize: typography.small.fontSize,
                  lineHeight: typography.small.lineHeight,
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
          padding: isMobile ? spacing.md : spacing.lg,
          minWidth: 0,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </section>
  );
}
