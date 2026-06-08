import { colors, shadows, spacing, typography } from "../../theme";

export const appShellStyle = (isMobile = false) => ({
  minHeight: "100vh",
  background: colors.background,
  color: colors.text,
  fontFamily: typography.fontFamily,
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
});

export const sidebarContainerStyle = {
  height: "100%",
  background: colors.sidebar,
  color: colors.surface,
  borderRight: "1px solid rgba(255,255,255,.06)",
  display: "flex",
  flexDirection: "column",
  padding: spacing.lg,
  overflow: "hidden",
};

export const mainContainerStyle = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

export const topbarStyle = (isMobile = false) => ({
  minHeight: isMobile ? "56px" : "64px",
  background: colors.topbar,
  color: colors.surface,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: isMobile ? "0 12px" : "0 20px",
  borderBottom: "1px solid rgba(255,255,255,.06)",
  boxShadow: shadows.sm,
  position: "sticky",
  top: 0,
  zIndex: 40,
});

export const contentStyle = (isMobile = false) => ({
  padding: isMobile ? "12px" : spacing.xl,
  width: "100%",
  maxWidth: "1650px",
  margin: "0 auto",
  boxSizing: "border-box",
  minWidth: 0,
});

export const logoStyle = (isMobile = false) => ({
  fontSize: isMobile ? 15 : typography.subtitle.fontSize,
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const subtleStyle = {
  color: "#98a2b3",
  fontSize: typography.small.fontSize,
};

export const mobileMenuButtonStyle = {
  width: 42,
  height: 42,
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 12,
  background: "rgba(255,255,255,.08)",
  color: "white",
  cursor: "pointer",
  flexShrink: 0,
};

export const mobileOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, .58)",
  display: "flex",
};

export const mobileSidebarPanelStyle = {
  width: "min(84vw, 320px)",
  height: "100vh",
  boxShadow: "18px 0 42px rgba(15,23,42,.28)",
};
