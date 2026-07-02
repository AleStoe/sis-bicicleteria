import { spacing, typography, colors } from "../../theme";
import useBreakpoint from "./responsive/useBreakpoint";

export default function PageHeader({
  title,
  subtitle,
  actions,
  style = {},
}) {
  const isMobile = useBreakpoint(760);

  return (
    <div
      style={{
        display: isMobile ? "grid" : "flex",
        justifyContent: "space-between",
        alignItems: "start",
        gap: isMobile ? spacing.md : spacing.lg,
        marginBottom: isMobile ? spacing.md : spacing.xl,
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            color: colors.textStrong,
            fontFamily: typography.fontFamily,
            fontSize: isMobile ? 24 : typography.title.fontSize,
            fontWeight: typography.title.fontWeight,
            lineHeight: typography.title.lineHeight,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <div
            style={{
              marginTop: 6,
              color: colors.textMuted,
              fontSize: typography.body.fontSize,
              lineHeight: typography.body.lineHeight,
              overflowWrap: "anywhere",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {actions && (
        <div
          style={{
            display: isMobile ? "grid" : "flex",
            gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
            gap: spacing.sm,
            width: isMobile ? "100%" : undefined,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
