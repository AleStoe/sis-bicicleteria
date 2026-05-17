import { colors, radius, spacing } from "../../theme";

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
        fontWeight: 600,
        color: colors.text,
        ...style,
      }}
    >
      {label && <span>{label}</span>}

      <input
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${error ? colors.danger : colors.border}`,
          borderRadius: radius.md,
          padding: "10px 12px",
          outline: "none",
          background: colors.surface,
          color: colors.text,
          fontSize: 14,
          ...inputStyle,
        }}
        {...props}
      />

      {error && (
        <span
          style={{
            color: colors.danger,
            fontSize: 12,
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}
