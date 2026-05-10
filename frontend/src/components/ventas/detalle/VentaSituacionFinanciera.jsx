import { Link } from "react-router-dom";
import { formatMoney } from "../../../pages/VentasListPage";

export default function VentaSituacionFinanciera({
  cubiertoNoPago,
  tieneDeuda,
  deuda,
}) {
  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Situación financiera</h2>

          <p style={subtitleStyle}>
            Estado de deuda, crédito y cobertura financiera de la venta.
          </p>
        </div>
      </div>

      <div style={contentStyle}>
        {cubiertoNoPago > 0 && (
          <div style={noteStyle}>
            <strong>Monto cubierto sin pago real registrado</strong>

            <div style={{ marginTop: "6px" }}>
              {formatMoney(cubiertoNoPago)}
            </div>

            <div style={smallMutedStyle}>
              Probablemente corresponde a crédito aplicado,
              ajuste financiero o compensación manual.
            </div>
          </div>
        )}

        {tieneDeuda ? (
          <div style={warningStyle}>
            <div>
              <strong>Venta con deuda abierta</strong>

              <div style={metaStyle}>
                ID deuda: #{deuda.id}
              </div>
            </div>

            <div style={deudaGridStyle}>
              <Info
                label="Saldo actual"
                value={formatMoney(deuda.saldo_actual)}
              />

              <Info
                label="Estado"
                value={deuda.estado}
              />
            </div>

            <Link
              to={`/deudas/${deuda.id}`}
              style={detailLinkStyle}
            >
              Ver deuda
            </Link>
          </div>
        ) : (
          <div style={successStyle}>
            <strong>Sin deuda pendiente</strong>

            <div style={smallMutedStyle}>
              La venta no tiene deuda abierta asociada.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoCardStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong>{value}</strong>
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
  marginBottom: "14px",
};

const titleStyle = {
  margin: 0,
  fontSize: "20px",
};

const subtitleStyle = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const contentStyle = {
  display: "grid",
  gap: "12px",
};

const noteStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #f3dc97",
};

const warningStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #f3dc97",
  display: "grid",
  gap: "12px",
};

const successStyle = {
  background: "#ecfdf3",
  color: "#067647",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #abefc6",
};

const deudaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const infoCardStyle = {
  background: "white",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "10px",
  padding: "10px",
  display: "grid",
  gap: "4px",
};

const infoLabelStyle = {
  fontSize: "12px",
  color: "#667085",
};

const detailLinkStyle = {
  display: "inline-block",
  textDecoration: "none",
  fontWeight: 800,
  color: "#175cd3",
};

const metaStyle = {
  marginTop: "4px",
  fontSize: "13px",
};

const smallMutedStyle = {
  marginTop: "6px",
  color: "#667085",
  fontSize: "13px",
};