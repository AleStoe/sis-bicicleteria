import { colors, radius, shadows, spacing, typography } from "../../theme";

export const appShellStyle = {
  minHeight: "100vh",
  background: colors.background,
  color: colors.text,
  fontFamily: typography.fontFamily,
  display: "grid",
  gridTemplateColumns: "260px 1fr",
};

export const sidebarContainerStyle = {
  background: colors.sidebar,
  color: colors.surface,
  borderRight: "1px solid rgba(255,255,255,.06)",
  display: "flex",
  flexDirection: "column",
  padding: spacing.lg,
};

export const mainContainerStyle = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

export const topbarStyle = {
  height: "64px",
  background: colors.topbar,
  color: colors.surface,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  borderBottom: "1px solid rgba(255,255,255,.06)",
  boxShadow: shadows.sm,
};

export const contentStyle = {
  padding: spacing.xl,
  width: "100%",
  maxWidth: "1650px",
  margin: "0 auto",
  boxSizing: "border-box",
};

export const logoStyle = {
  fontSize: typography.subtitle.fontSize,
  fontWeight: 700,
};

export const subtleStyle = {
  color: "#98a2b3",
  fontSize: typography.small.fontSize,
};
