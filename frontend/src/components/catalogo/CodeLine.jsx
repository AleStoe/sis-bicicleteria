export default function CodeLine({ label, value }) {
  return (
    <div style={styles.line}>
      <span style={styles.label}>{label}:</span> {value || "-"}
    </div>
  );
}

const styles = {
  line: {
    fontSize: "13px",
    marginBottom: "3px",
    whiteSpace: "nowrap",
  },
  label: {
    color: "#667085",
  },
};