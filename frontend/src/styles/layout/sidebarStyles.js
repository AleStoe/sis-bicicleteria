import { colors, radius, spacing } from "../../theme";

export const sidebarHeaderStyle = {
  marginBottom: spacing.xl,
};

export const navSectionStyle = {
  display: "grid",
  gap: spacing.md,
  overflowY: "auto",
  paddingRight: 2,
};

export const navGroupTitleStyle = {
  color: "#98a2b3",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  margin: "10px 8px 2px",
};

export const navItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: spacing.md,
  padding: "11px 12px",
  borderRadius: radius.md,
  color: "#d0d5dd",
  textDecoration: "none",
  transition: "all .15s ease",
  border: "1px solid transparent",
};

export const navItemActiveStyle = {
  ...navItemStyle,
  background: colors.primary,
  color: colors.surface,
  fontWeight: 800,
  boxShadow: "0 8px 18px rgba(255,106,0,.22)",
};

export const navIconStyle = {
  flexShrink: 0,
};

export const navItemLabelStyle = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
