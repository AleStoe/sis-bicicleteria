import { colors, radius } from "../../theme";

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
        fontWeight: 600,
        color: colors.text,
        ...style,
      }}
    >
      {label && <span>{label}</span>}

      <select
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: "10px 12px",
          outline: "none",
          background: colors.surface,
          color: colors.text,
          fontSize: 14,
          ...selectStyle,
        }}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
