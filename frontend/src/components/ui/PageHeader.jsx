import { spacing, typography, colors } from "../../theme";
import useBreakpoint from "./responsive/useBreakpoint";

export default function PageHeader({
  title,
  subtitle,
  actions,
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
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 25 : typography.title.fontSize,
            fontWeight: typography.title.fontWeight,
            lineHeight: 1.1,
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
              lineHeight: 1.35,
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
