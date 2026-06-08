import { colors, spacing } from "../../../theme";
import useBreakpoint from "./useBreakpoint";

export default function ResponsivePage({ children, style = {}, mobileStyle = {}, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.background || "#f1f5f9",
        color: colors.text,
        padding: isMobile ? 10 : spacing.xl,
        display: "grid",
        gap: isMobile ? 12 : spacing.lg,
        boxSizing: "border-box",
        overflowX: "hidden",
        ...style,
        ...(isMobile ? mobileStyle : {}),
      }}
    >
      {children}
    </main>
  );
}
