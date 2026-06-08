import { spacing, typography, colors } from "../../../theme";
import useBreakpoint from "./useBreakpoint";
import ResponsiveActions from "./ResponsiveActions";

export default function ResponsiveHeader({ title, subtitle, beforeTitle, badges, actions, actionsColumns = 2, style = {}, mobileStyle = {}, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  return (
    <header
      style={{
        display: isMobile ? "grid" : "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: isMobile ? spacing.md : spacing.lg,
        minWidth: 0,
        ...style,
        ...(isMobile ? mobileStyle : {}),
      }}
    >
      <div style={{ minWidth: 0 }}>
        {beforeTitle}
        <div
          style={{
            display: "flex",
            gap: spacing.sm,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 25 : typography.title.fontSize,
              fontWeight: typography.title.fontWeight,
              lineHeight: 1.1,
              minWidth: isMobile ? "100%" : 0,
              wordBreak: "break-word",
            }}
          >
            {title}
          </h1>
          {badges}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: 6,
              color: colors.textMuted,
              fontSize: isMobile ? 13 : undefined,
              lineHeight: 1.35,
              fontWeight: 600,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {actions && <ResponsiveActions columns={actionsColumns}>{actions}</ResponsiveActions>}
    </header>
  );
}
