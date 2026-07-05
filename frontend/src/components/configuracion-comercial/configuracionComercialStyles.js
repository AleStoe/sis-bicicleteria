export const styles = {
  page: {
    padding: 20,
    display: "grid",
    gap: 24,
  },

  header: {
    display: "grid",
    gap: 6,
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#111827",
  },

  subtitle: {
    margin: 0,
    color: "#667085",
  },

  section: {
    border: "1px solid #eaecf0",
    borderRadius: 16,
    background: "white",
    overflow: "hidden",
  },

  sectionTitle: {
    padding: 16,
    borderBottom: "1px solid #eaecf0",
    fontWeight: 900,
    color: "#344054",
  },

  table: {
    display: "grid",
    minWidth: 1180,
  },

  tableScroll: {
    overflowX: "auto",
  },

  tableHeadReglas: {
    display: "grid",
    gridTemplateColumns: "minmax(190px, 2fr) repeat(7, minmax(90px, 1fr)) minmax(180px, 1.4fr)",
    gap: 12,
    padding: 14,
    background: "#f9fafb",
    fontWeight: 700,
    color: "#667085",
    fontSize: 13,
  },

  rowReglas: {
    display: "grid",
    gridTemplateColumns: "minmax(190px, 2fr) repeat(7, minmax(90px, 1fr)) minmax(180px, 1.4fr)",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #f2f4f7",
    alignItems: "center",
    fontSize: 14,
  },

  rowReglasActiva: {
    display: "grid",
    gridTemplateColumns: "minmax(190px, 2fr) repeat(7, minmax(90px, 1fr)) minmax(180px, 1.4fr)",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #fed7aa",
    alignItems: "center",
    fontSize: 14,
    background: "#fff7ed",
  },

  tableHeadPlanes: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 0.7fr 1fr 1fr 1.7fr",
    gap: 12,
    padding: 14,
    background: "#f9fafb",
    fontWeight: 700,
    color: "#667085",
    fontSize: 13,
  },

  rowPlanes: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 0.7fr 1fr 1fr 1.7fr",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #f2f4f7",
    alignItems: "center",
    fontSize: 14,
  },

  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    width: "fit-content",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d0d5dd",
    borderRadius: 8,
    padding: "8px 9px",
    fontSize: 13,
    background: "white",
  },

  inlineForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    padding: 16,
    borderBottom: "1px solid #eaecf0",
    alignItems: "center",
  },

  actionsCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#344054",
  },

  editBtn: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 8,
    padding: "6px 9px",
    fontWeight: 800,
    cursor: "pointer",
  },

  saveBtn: {
    border: "none",
    background: "#12a15f",
    color: "white",
    borderRadius: 8,
    padding: "6px 9px",
    fontWeight: 800,
    cursor: "pointer",
  },

  cancelBtn: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 8,
    padding: "6px 9px",
    fontWeight: 800,
    cursor: "pointer",
  },

  activateBtn: {
    border: "1px solid #86efac",
    background: "#ecfdf3",
    color: "#067647",
    borderRadius: 8,
    padding: "6px 9px",
    fontWeight: 800,
    cursor: "pointer",
  },

  deactivateBtn: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 8,
    padding: "6px 9px",
    fontWeight: 800,
    cursor: "pointer",
  },

  badgeActivo: {
    background: "#ecfdf3",
    color: "#067647",
  },

  badgeInactivo: {
    background: "#f2f4f7",
    color: "#667085",
  },

  helpBox: {
    margin: 16,
    padding: 12,
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.4,
  },

  errorBox: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },

  successBox: {
    border: "1px solid #86efac",
    background: "#ecfdf3",
    color: "#067647",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },

  loading: {
    color: "#667085",
    fontSize: 14,
  },
};

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}
