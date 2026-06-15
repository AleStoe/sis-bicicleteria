import { colors, radius, shadows, spacing } from "../../theme";
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
        boxShadow: "0 2px 10px rgba(16,24,40,.04)",
        border: `1px solid rgba(16,24,40,.06)`,
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
              <h3 style={{ margin: 0, fontSize: isMobile ? 16 : 18, lineHeight: 1.2, overflowWrap: "anywhere" }}>
                {title}
              </h3>
            )}

            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  color: colors.textMuted,
                  fontSize: 13,
                  lineHeight: 1.35,
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
