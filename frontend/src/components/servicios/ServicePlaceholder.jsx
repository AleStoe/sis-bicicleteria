import { Wrench } from "lucide-react";
import { colors, radius, typography } from "../../theme";

const sizes = {
  sm: { width: 42, height: 42, icon: 18 },
  md: { width: 58, height: 58, icon: 24 },
  lg: { width: 84, height: 84, icon: 32 },
};

export default function ServicePlaceholder({
  size = "md",
  showLabel = false,
  style = {},
}) {
  const current = sizes[size] || sizes.md;

  return (
    <div
      aria-label="Servicio de taller"
      style={{
        width: current.width,
        height: current.height,
        boxSizing: "border-box",
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        alignContent: "center",
        gap: 3,
        border: `1px solid ${colors.primaryBorder}`,
        borderRadius: radius.md,
        background: colors.primarySoft,
        color: colors.primaryHover,
        ...style,
      }}
    >
      <Wrench size={current.icon} strokeWidth={2.2} aria-hidden="true" />
      {showLabel && (
        <span
          style={{
            fontSize: 9,
            lineHeight: 1,
            fontWeight: typography.label.fontWeight,
            textTransform: "uppercase",
          }}
        >
          Servicio
        </span>
      )}
    </div>
  );
}
