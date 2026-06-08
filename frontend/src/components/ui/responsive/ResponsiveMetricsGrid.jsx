import { spacing } from "../../../theme";
import useBreakpoint from "./useBreakpoint";

export default function ResponsiveMetricsGrid({ children, minWidth = 160, mobileColumns = 2, style = {}, mobileStyle = {}, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? `repeat(${mobileColumns}, minmax(0, 1fr))`
          : `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap: isMobile ? 8 : spacing.md,
        ...style,
        ...(isMobile ? mobileStyle : {}),
      }}
    >
      {children}
    </section>
  );
}
