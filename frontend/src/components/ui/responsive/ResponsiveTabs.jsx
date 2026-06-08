import { colors, radius, spacing } from "../../../theme";
import useBreakpoint from "./useBreakpoint";

export default function ResponsiveTabs({ tabs = [], activeTab, onChange, getLabel = (tab) => tab.label, getId = (tab) => tab.id, style = {}, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  return (
    <nav
      style={{
        display: "flex",
        gap: spacing.sm,
        flexWrap: isMobile ? "nowrap" : "wrap",
        overflowX: isMobile ? "auto" : undefined,
        paddingBottom: isMobile ? 4 : 0,
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const id = getId(tab);
        const active = id === activeTab;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              border: `1px solid ${active ? colors.primary || "#2563eb" : colors.border}`,
              background: active ? colors.primary || "#2563eb" : colors.surface,
              color: active ? colors.surface : colors.text,
              borderRadius: radius.md,
              padding: "11px 14px",
              fontWeight: 800,
              cursor: "pointer",
              flex: "0 0 auto",
              whiteSpace: "nowrap",
            }}
          >
            {getLabel(tab)}
          </button>
        );
      })}
    </nav>
  );
}
