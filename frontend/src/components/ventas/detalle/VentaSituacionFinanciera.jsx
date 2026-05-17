import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "../../../utils/formatters";
import { Card, MetricCard, Badge, Button } from "../../ui";

export default function VentaSituacionFinanciera({
  cubiertoNoPago,
  tieneDeuda,
  deuda,
}) {
  return (
    <Card
      title="Situación financiera"
      subtitle="Estado de deuda, crédito y cobertura financiera de la venta."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {cubiertoNoPago > 0 && (
          <div style={noteStyle}>
            <strong>Monto cubierto sin pago real registrado</strong>

            <div style={{ marginTop: "6px", fontWeight: 800 }}>
              {formatMoney(cubiertoNoPago)}
            </div>

            <div style={smallMutedStyle}>
              Corresponde a crédito aplicado, ajuste financiero o compensación manual.
            </div>
          </div>
        )}

        {tieneDeuda && deuda ? (
          <div style={warningStyle}>
            <div style={headerRowStyle}>
              <div>
                <strong>Saldo formalizado en cuenta corriente</strong>
                <div style={smallMutedStyle}>
                  Esta venta tiene una deuda asociada. El cobro debe continuar desde Deudas.
                </div>
                <div style={smallMutedStyle}>ID deuda: #{deuda.id}</div>
              </div>

              <Badge variant="warning">Deuda abierta</Badge>
            </div>

            <div style={metricsGridStyle}>
              <MetricCard
                label="Saldo actual"
                value={formatMoney(deuda.saldo_actual)}
                tone="warning"
              />

              <MetricCard label="Estado deuda" value={deuda.estado} />
            </div>

            <Link to={`/deudas/${deuda.id}`} style={{ textDecoration: "none" }}>
              <Button variant="outline">
                <span style={buttonContentStyle}>
                  Ir a deuda
                  <ArrowRight size={16} />
                </span>
              </Button>
            </Link>
          </div>
        ) : (
          <div style={successStyle}>
            <div style={headerRowStyle}>
              <div>
                <strong>Sin deuda pendiente</strong>
                <div style={smallMutedStyle}>
                  La venta no tiene deuda abierta asociada.
                </div>
              </div>

              <Badge variant="success">OK</Badge>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

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

const headerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const smallMutedStyle = {
  marginTop: "6px",
  color: "#667085",
  fontSize: "13px",
};

const buttonContentStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};