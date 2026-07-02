import { colors, controls, radius, typography } from "../../theme";

export default function Select({
  label,
  children,
  style = {},
  selectStyle = {},
  ...props
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        fontSize: typography.label.fontSize,
        fontWeight: typography.label.fontWeight,
        lineHeight: typography.label.lineHeight,
        color: colors.text,
        minWidth: 0,
        ...style,
      }}
    >
      {label && <span>{label}</span>}

      <select
        style={{
          width: "100%",
          minWidth: 0,
          minHeight: controls.minHeight,
          boxSizing: "border-box",
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: controls.padding,
          outline: "none",
          background: colors.surface,
          color: colors.text,
          fontSize: typography.body.fontSize,
          ...selectStyle,
        }}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
