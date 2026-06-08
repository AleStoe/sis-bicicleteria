import { spacing } from "../../../theme";
import useBreakpoint from "./useBreakpoint";

export default function ResponsiveActions({ children, columns = 2, style = {}, mobileStyle = {}, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  return (
    <div
      style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
        gap: spacing.sm,
        flexWrap: "wrap",
        justifyContent: isMobile ? "stretch" : "flex-end",
        width: isMobile ? "100%" : undefined,
        ...style,
        ...(isMobile ? mobileStyle : {}),
      }}
    >
      {children}
    </div>
  );
}
