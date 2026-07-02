import { colors, controls, radius, typography } from "../../theme";

export default function Input({
  label,
  error,
  style = {},
  inputStyle = {},
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

      <input
        style={{
          width: "100%",
          minWidth: 0,
          minHeight: controls.minHeight,
          boxSizing: "border-box",
          border: `1px solid ${error ? colors.danger : colors.border}`,
          borderRadius: radius.md,
          padding: controls.padding,
          outline: "none",
          background: colors.surface,
          color: colors.text,
          fontSize: typography.body.fontSize,
          ...inputStyle,
        }}
        {...props}
      />

      {error && (
        <span
          style={{
            color: colors.danger,
            fontSize: typography.small.fontSize,
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}
