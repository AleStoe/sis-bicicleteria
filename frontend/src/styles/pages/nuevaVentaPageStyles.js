import { colors, radius, shadows, spacing, typography } from "../../theme";

const tagBaseStyle = {
  borderRadius: radius.pill,
  padding: "3px 8px",
  fontSize: typography.small.fontSize,
  fontWeight: typography.small.fontWeight,
};

const buttonBaseStyle = {
  borderRadius: radius.md,
  fontWeight: 700,
  cursor: "pointer",
};

const pageStyle = {
  minHeight: "100vh",
  background: colors.background,
  color: colors.text,
  fontFamily: typography.fontFamily,
};

const topBarStyle = {
  minHeight: "64px",
  background: colors.topbar,
  color: colors.surface,
  display: "flex",
  alignItems: "center",
  gap: spacing.lg,
  padding: "0 20px",
  boxShadow: "0 2px 16px rgba(0,0,0,.22)",
};

const brandStyle = {
  display: "flex",
  alignItems: "center",
  gap: spacing.md,
  minWidth: "300px",
  fontSize: typography.subtitle.fontSize,
};

const bikeStyle = { fontSize: "26px" };

const topSubtleStyle = {
  fontSize: typography.small.fontSize,
  color: "#98a2b3",
  marginTop: "2px",
};

const topSearchWrapStyle = {
  position: "relative",
  flex: 1,
  maxWidth: "520px",
};

const topSearchStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#111827",
  color: colors.surface,

  border: "2px solid #2563eb",
  borderRadius: radius.md,

  padding: "11px 38px 11px 13px",

  outline: "none",

  height: "52px",
  fontSize: "15px",
  fontWeight: 800,
};

const searchIconStyle = {
  position: "absolute",
  right: spacing.md,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#d0d5dd",
};

const topRightStyle = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  color: "#e5e7eb",
  fontSize: typography.body.fontSize,
};

const topLinkStyle = {
  color: colors.surface,
  textDecoration: "none",
  border: "1px solid #475467",
  borderRadius: radius.sm,
  padding: "7px 10px",
};

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(520px, 1fr) minmax(440px, 560px)",
  gap: "14px",
  padding: "14px",
};

const leftPanelStyle = {
  background: colors.surface,
  borderRadius: radius.lg,
  padding: "14px",
  boxShadow: shadows.md,
  minWidth: 0,
};

const rightPanelStyle = {
  background: colors.surface,
  borderRadius: radius.lg,
  padding: spacing.lg,
  boxShadow: shadows.md,
  alignSelf: "start",
  position: "sticky",
  top: "14px",
};

const searchRowStyle = {
  display: "flex",
  gap: spacing.sm,
  marginBottom: spacing.md,
};

const searchStyle = {
  flex: 1,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: "11px 12px",
};

const iconButtonStyle = {
  ...buttonBaseStyle,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  padding: "0 14px",
};

const categoryRowStyle = {
  display: "flex",
  gap: spacing.sm,
  overflowX: "auto",
  paddingBottom: "10px",
  marginBottom: spacing.sm,
};

const categoryStyle = {
  ...buttonBaseStyle,
  whiteSpace: "nowrap",
  border: `1px solid ${colors.border}`,
  padding: "10px 12px",
  background: colors.surfaceMuted,
  color: "#344054",
};

const activeCategoryStyle = {
  ...categoryStyle,
  background: colors.primary,
  color: colors.surface,
  borderColor: colors.primary,
};

const catalogListStyle = {
  display: "grid",
  gap: "10px",
  maxHeight: "calc(100vh - 210px)",
  overflowY: "auto",
  paddingRight: spacing.xs,
};

const productRowStyle = {
  display: "grid",
  gridTemplateColumns: "72px 1fr 120px",
  gap: spacing.md,
  alignItems: "center",
  border: "1px solid #eaecf0",
  borderRadius: radius.md,
  padding: "8px",
  background: colors.surface,
};

const productRowBlockedStyle = {
  ...productRowStyle,
  opacity: 0.62,
  background: colors.surfaceMuted,
};

const imageBoxStyle = {
  width: "72px",
  height: "62px",
  borderRadius: radius.md,
  background: "#f2f4f7",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
};

const imageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const productInfoStyle = {
  minWidth: 0,
  display: "grid",
  gap: spacing.xs,
};

const mutedStyle = {
  color: colors.textMuted,
  fontSize: "13px",
};

const tagRowStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  marginTop: "2px",
};

const tagStyle = {
  ...tagBaseStyle,
  background: "#eef4ff",
  color: colors.secondary,
};

const stockTagStyle = {
  ...tagBaseStyle,
  background: "#ecfdf3",
  color: "#067647",
};

const serializableTagStyle = {
  ...tagBaseStyle,
  background: "#fff8e1",
  color: "#8a6d00",
};

const serviceTagStyle = {
  ...tagBaseStyle,
  background: "#fef7c3",
  color: "#854a0e",
};

const dangerTagStyle = {
  ...tagBaseStyle,
  background: "#fee4e2",
  color: "#b42318",
};

const productPriceStyle = {
  display: "grid",
  gap: spacing.sm,
  justifyItems: "end",
  fontSize: typography.subtitle.fontSize,
};

const addBtnStyle = {
  ...buttonBaseStyle,
  width: "42px",
  height: "34px",
  border: "none",
  background: colors.primary,
  color: colors.surface,
  fontSize: "22px",
};

const addBtnDisabledStyle = {
  ...addBtnStyle,
  background: "#d0d5dd",
  cursor: "not-allowed",
};

const saleTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: spacing.md,
  alignItems: "center",
  marginBottom: spacing.md,
};

const clientLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: spacing.sm,
  fontWeight: 700,
};

const clientSelectStyle = {
  minWidth: "230px",
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: "10px",
};

const fieldStyle = {
  display: "grid",
  gap: "6px",
  marginBottom: "10px",
  fontWeight: 700,
};

const textareaStyle = {
  minHeight: "56px",
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  padding: "9px",
  resize: "vertical",
};

const checkStyle = {
  display: "flex",
  alignItems: "center",
  gap: spacing.sm,
  marginBottom: spacing.md,
  color: "#344054",
};

const alertStyle = {
  margin: "12px 14px 0",
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #fecdca",
  padding: "10px 12px",
  borderRadius: radius.md,
};

const successStyle = {
  margin: "12px 14px 0",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  padding: "10px 12px",
  borderRadius: radius.md,
};

const emptyStyle = {
  padding: "40px",
  textAlign: "center",
  color: colors.textMuted,
};

const posMessageStyle = {
  margin: "12px 14px 0",
  background: colors.topbar,
  color: colors.surface,
  padding: "12px 14px",
  borderRadius: radius.md,
  fontWeight: 700,
  boxShadow: shadows.lg,
};

export {
  pageStyle,
  topBarStyle,
  brandStyle,
  bikeStyle,
  topSubtleStyle,
  topSearchWrapStyle,
  topSearchStyle,
  searchIconStyle,
  topRightStyle,
  topLinkStyle,
  layoutStyle,
  leftPanelStyle,
  rightPanelStyle,
  searchRowStyle,
  searchStyle,
  iconButtonStyle,
  categoryRowStyle,
  categoryStyle,
  activeCategoryStyle,
  catalogListStyle,
  productRowStyle,
  productRowBlockedStyle,
  imageBoxStyle,
  imageStyle,
  productInfoStyle,
  mutedStyle,
  tagRowStyle,
  tagStyle,
  stockTagStyle,
  serializableTagStyle,
  serviceTagStyle,
  dangerTagStyle,
  productPriceStyle,
  addBtnStyle,
  addBtnDisabledStyle,
  saleTopStyle,
  clientLabelStyle,
  clientSelectStyle,
  fieldStyle,
  textareaStyle,
  checkStyle,
  alertStyle,
  successStyle,
  emptyStyle,
  posMessageStyle,
};
