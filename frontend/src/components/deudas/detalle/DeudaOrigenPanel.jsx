import { Link } from "react-router-dom";
import { formatMoney } from "../../../pages/DeudasListPage";

export default function DeudaOrigenPanel({ origen }) {
  if (!origen) {
    return null;
  }

  const venta = origen.venta;
  const items = origen.items || [];

  if (origen.tipo !== "venta" || !venta) {
    return null;
  }

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Origen de la deuda</h2>
          <p style={mutedStyle}>
            Esta deuda viene de la venta #{venta.id}
          </p>
        </div>

        <Link to={`/ventas/${venta.id}`} style={linkBtnStyle}>
          Ver venta
        </Link>
      </div>

      <div style={summaryGridStyle}>
        <Info label="Estado venta" value={venta.estado} />
        <Info label="Total venta" value={formatMoney(venta.total_final)} />
        <Info label="Saldo venta" value={formatMoney(venta.saldo_pendiente)} />
        <Info label="Sucursal" value={venta.sucursal_nombre || "-"} />
      </div>

      <div style={itemsHeaderStyle}>
        <h3 style={{ margin: 0, fontSize: "17px" }}>
          Items comprados
        </h3>
      </div>

      {items.length === 0 ? (
        <div style={emptyStyle}>No hay items asociados al origen.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle} cellPadding="10">
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={thStyle}>Producto</th>
                <th style={thStyle}>Cantidad</th>
                <th style={thStyle}>Precio</th>
                <th style={thStyle}>Subtotal</th>
                <th style={thStyle}>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={tdStyle}>
                    <strong>{item.descripcion_snapshot}</strong>

                    {item.id_bicicleta_serializada && (
                      <div style={mutedSmallStyle}>
                        Bicicleta serializada #{item.id_bicicleta_serializada}
                      </div>
                    )}
                  </td>

                  <td style={tdStyle}>{Number(item.cantidad)}</td>

                  <td style={tdStyle}>
                    {formatMoney(item.precio_final)}
                  </td>

                  <td style={tdStyle}>
                    <strong>{formatMoney(item.subtotal)}</strong>
                  </td>

                  <td style={tdStyle}>
                    {item.bonificado ? (
                      <span style={badgeSoftStyle}>Bonificado</span>
                    ) : item.motivo_precio_manual ? (
                      <span style={badgeSoftStyle}>Precio manual</span>
                    ) : (
                      "-"
                    )}

                    {item.motivo_bonificacion && (
                      <div style={mutedSmallStyle}>
                        {item.motivo_bonificacion}
                      </div>
                    )}

                    {item.motivo_precio_manual && (
                      <div style={mutedSmallStyle}>
                        {item.motivo_precio_manual}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoBoxStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
  marginBottom: "16px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const titleStyle = {
  margin: 0,
  fontSize: "20px",
};

const mutedStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const mutedSmallStyle = {
  marginTop: "4px",
  color: "#667085",
  fontSize: "13px",
};

const linkBtnStyle = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  color: "#111827",
  background: "white",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const infoBoxStyle = {
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "12px",
};

const infoLabelStyle = {
  fontSize: "13px",
  color: "#667085",
  marginBottom: "6px",
};

const infoValueStyle = {
  fontWeight: 700,
};

const itemsHeaderStyle = {
  borderTop: "1px solid #eee",
  paddingTop: "14px",
  marginBottom: "8px",
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

const emptyStyle = {
  padding: "12px",
  background: "#f9fafb",
  borderRadius: "10px",
  color: "#667085",
};

const badgeSoftStyle = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  background: "#f2f4f7",
  color: "#344054",
  fontSize: "12px",
  fontWeight: 700,
};