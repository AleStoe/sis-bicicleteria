import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "../../../utils/formatters";
import { Card, MetricCard, Badge, Button, useBreakpoint } from "../../ui";

export default function VentaSituacionFinanciera({
  venta,
  coberturaNoCobrada = 0,
  creditoAplicadoReal = 0,
  creditoGeneradoDevolucion = 0,
  deudaCanceladaPorDevolucion = 0,
  tieneDeuda,
  deuda,
}) {
  const { isMobile } = useBreakpoint();
  const estado = venta?.estado;
  const esDevuelta = estado === "devuelta" || estado === "devuelta_parcial";

  const mostrarDeudaCancelada =
    esDevuelta && deudaCanceladaPorDevolucion > 0;

  const mostrarCreditoAplicado =
    creditoAplicadoReal > 0;

  const mostrarCreditoGenerado =
    esDevuelta && creditoGeneradoDevolucion > 0;

  const mostrarCoberturaGenerica =
    coberturaNoCobrada > 0 &&
    !mostrarDeudaCancelada &&
    !mostrarCreditoAplicado &&
    !mostrarCreditoGenerado;

  return (
    <Card
      title="Situación financiera"
      subtitle="Estado de deuda, crédito y cobertura financiera de la venta."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {mostrarDeudaCancelada && (
          <div style={devolucionStyle}>
            <strong>Deuda cancelada por devolución</strong>

            <div style={{ marginTop: "6px", fontWeight: 800 }}>
              {formatMoney(deudaCanceladaPorDevolucion)}
            </div>

            <div style={smallMutedStyle}>
              La venta fue devuelta. Este importe no fue cobrado ni generado como crédito:
              corresponde a deuda pendiente que se canceló por la devolución.
            </div>
          </div>
        )}

        {mostrarCreditoAplicado && (
          <div style={noteStyle}>
            <strong>Crédito aplicado a esta venta</strong>

            <div style={{ marginTop: "6px", fontWeight: 800 }}>
              {formatMoney(creditoAplicadoReal)}
            </div>

            <div style={smallMutedStyle}>
              El cliente usó crédito disponible para cubrir parte o la totalidad de esta venta.
              No representa ingreso de caja.
            </div>
          </div>
        )}

        {mostrarCreditoGenerado && (
          <div style={noteStyle}>
            <strong>Crédito generado por devolución</strong>

            <div style={{ marginTop: "6px", fontWeight: 800 }}>
              {formatMoney(creditoGeneradoDevolucion)}
            </div>

            <div style={smallMutedStyle}>
              La devolución generó saldo a favor porque existían pagos reales o crédito previo aplicado.
            </div>
          </div>
        )}

        {mostrarCoberturaGenerica && (
          <div style={neutralStyle}>
            <strong>Cobertura financiera no cobrada</strong>

            <div style={{ marginTop: "6px", fontWeight: 800 }}>
              {formatMoney(coberturaNoCobrada)}
            </div>

            <div style={smallMutedStyle}>
              Este importe no representa ingreso de caja. Revisar pagos, deuda o ajustes asociados.
            </div>
          </div>
        )}

        {tieneDeuda && deuda ? (
          <div style={warningStyle}>
            <div style={{ ...headerRowStyle, ...(isMobile ? headerRowMobileStyle : {}) }}>
              <div>
                <strong>Saldo formalizado en cuenta corriente</strong>
                <div style={smallMutedStyle}>
                  Esta venta tiene una deuda asociada. El cobro debe continuar desde Deudas.
                </div>
                <div style={smallMutedStyle}>ID deuda: #{deuda.id}</div>
              </div>

              <Badge variant="warning">Deuda abierta</Badge>
            </div>

            <div style={{ ...metricsGridStyle, ...(isMobile ? metricsGridMobileStyle : {}) }}>
              <MetricCard
                label="Saldo actual"
                value={formatMoney(deuda.saldo_actual)}
                tone="warning"
              />

              <MetricCard label="Estado deuda" value={deuda.estado} />
            </div>

            <Link to={`/deudas/${deuda.id}`} style={{ textDecoration: "none" }}>
              <Button variant="outline" fullWidth={isMobile}>
                <span style={buttonContentStyle}>
                  Ir a deuda
                  <ArrowRight size={16} />
                </span>
              </Button>
            </Link>
          </div>
        ) : (
          <div style={successStyle}>
            <div style={{ ...headerRowStyle, ...(isMobile ? headerRowMobileStyle : {}) }}>
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
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #bfdbfe",
};

const devolucionStyle = {
  background: "#fff7ed",
  color: "#9a3412",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #fed7aa",
};

const neutralStyle = {
  background: "#f8fafc",
  color: "#334155",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
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

const headerRowMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const metricsGridMobileStyle = {
  gridTemplateColumns: "1fr 1fr",
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
