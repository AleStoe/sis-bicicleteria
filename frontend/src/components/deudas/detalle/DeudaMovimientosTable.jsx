import { formatMoney } from "../../../utils/formatters";

export default function DeudaMovimientosTable({ movimientos }) {
  return (
    <section style={cardTableStyle}>
      <div style={tableHeaderStyle}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>Movimientos</h2>
      </div>

      {movimientos.length === 0 ? (
        <div style={{ padding: "18px" }}>No hay movimientos registrados.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table cellPadding="10" style={tableStyle}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Monto</th>
                <th style={thStyle}>Origen</th>
                <th style={thStyle}>Nota</th>
                <th style={thStyle}>Usuario</th>
              </tr>
            </thead>

            <tbody>
              {movimientos.map((mov) => (
                <tr key={mov.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={tdStyle}>#{mov.id}</td>
                  <td style={tdStyle}>{mov.tipo_movimiento}</td>
                  <td style={tdStyle}>
                    <strong>{formatMoney(mov.monto)}</strong>
                  </td>
                  <td style={tdStyle}>
                    {mov.origen_tipo
                      ? `${mov.origen_tipo} #${mov.origen_id}`
                      : "-"}
                  </td>
                  <td style={tdStyle}>{mov.nota || "-"}</td>
                  <td style={tdStyle}>#{mov.id_usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cardTableStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: 0,
  overflow: "hidden",
};

const tableHeaderStyle = {
  padding: "16px 18px",
  borderBottom: "1px solid #eee",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "850px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
  verticalAlign: "top",
};