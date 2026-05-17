import { colors, radius } from "../../theme";

export default function Table({
  columns = [],
  data = [],
  emptyMessage = "Sin registros",
  renderRow,
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        background: colors.surface,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead
          style={{
            background: "#f8fafc",
          }}
        >
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  fontSize: 13,
                  color: colors.textMuted,
                  borderBottom: `1px solid ${colors.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "30px",
                  textAlign: "center",
                  color: colors.textMuted,
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={row.id || index}
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  background: index % 2 === 0 ? colors.surface : "#fbfcfe",
                  transition: "background .12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f4f7fb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    index % 2 === 0 ? colors.surface : "#fbfcfe";
                }}
              >
                {renderRow(row)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
