import { colors, radius, spacing } from "../../../theme";
import useBreakpoint from "./useBreakpoint";
import Table from "../Table";

export default function ResponsiveTableCards({ columns = [], data = [], emptyMessage = "Sin registros", renderRow, renderCard, cardKey, breakpoint = 760 }) {
  const isMobile = useBreakpoint(breakpoint);

  if (!data.length) {
    return (
      <div
        style={{
          color: colors.textMuted,
          padding: spacing.lg,
          borderRadius: radius.md,
          background: "#f8fafc",
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: spacing.sm }}>
        {data.map((row, index) => (
          <article
            key={cardKey ? cardKey(row, index) : row.id || index}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: spacing.md,
              background: colors.surface,
              display: "grid",
              gap: spacing.sm,
              minWidth: 0,
            }}
          >
            {renderCard(row, index)}
          </article>
        ))}
      </div>
    );
  }

  return <Table columns={columns} data={data} emptyMessage={emptyMessage} renderRow={renderRow} />;
}
