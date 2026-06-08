import { colors, radius, shadows, spacing } from "../../../theme";
import useBreakpoint from "./useBreakpoint";

export default function ResponsiveDrawer({ open, title, onClose, children, width = 420, style = {}, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.38)",
        display: "flex",
        justifyContent: isMobile ? "stretch" : "flex-end",
      }}
      onMouseDown={onClose}
    >
      <aside
        style={{
          width: isMobile ? "100%" : width,
          height: "100%",
          background: colors.surface,
          boxShadow: shadows.lg || "0 20px 45px rgba(15, 23, 42, 0.24)",
          borderTopLeftRadius: isMobile ? 0 : radius.lg,
          borderBottomLeftRadius: isMobile ? 0 : radius.lg,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          overflow: "hidden",
          ...style,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header
          style={{
            padding: spacing.lg,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <strong style={{ fontSize: 18 }}>{title}</strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              borderRadius: radius.md,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Cerrar
          </button>
        </header>

        <div style={{ padding: spacing.lg, overflowY: "auto" }}>{children}</div>
      </aside>
    </div>
  );
}
