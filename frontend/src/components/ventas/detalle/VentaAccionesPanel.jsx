import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Card, Badge, useBreakpoint } from "../../ui";

export default function VentaAccionesPanel({
  venta,
  procesando,
  puedeCobrar,
  puedeEntregar,
  puedeAnular,
  puedeDevolver,
  estaCerradaOperativamente,
  onEntregar,
  onAnular,
  onDevolverCompleta,
}) {
  const { isMobile } = useBreakpoint();
  const accionPrincipal = puedeCobrar
    ? {
        title: "Cobrar venta",
        description: "Hay saldo pendiente. Registrá el cobro antes de cerrar la operación.",
        label: "Cobrar ahora",
        to: `/ventas/${venta.id}/cobro`,
      }
    : puedeEntregar
      ? {
          title: "Entregar venta",
          description: "La venta está lista para marcar salida de mercadería.",
          label: "Entregar ahora",
          onClick: onEntregar,
          disabled: procesando,
        }
      : null;
  const hayAccionesPrimarias =
    puedeCobrar || puedeEntregar || puedeAnular || puedeDevolver;

  return (
    <Card
      title="Acciones operativas"
      subtitle="Operaciones disponibles según el estado operativo actual de la venta."
      actions={
        estaCerradaOperativamente ? (
          <Badge variant="success">Venta cerrada</Badge>
        ) : null
      }
    >
      {estaCerradaOperativamente && (
        <div style={{ ...closedStateStyle, ...(isMobile ? closedStateMobileStyle : {}) }}>
          <CheckCircle2 size={18} />
          <div>
            <strong>Venta cerrada operativamente</strong>
            <div style={smallMutedStyle}>
              No tiene saldo pendiente y ya fue entregada. No requiere nuevas acciones.
            </div>
          </div>
        </div>
      )}

      {accionPrincipal && (
        <div style={{ ...mainActionStyle, ...(isMobile ? mainActionMobileStyle : {}) }}>
          <div>
            <div style={mainActionLabelStyle}>Accion principal</div>
            <strong>{accionPrincipal.title}</strong>
            <p>{accionPrincipal.description}</p>
          </div>

          {accionPrincipal.to ? (
            <Link to={accionPrincipal.to} style={mainActionButtonStyle}>
              {accionPrincipal.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={accionPrincipal.onClick}
              disabled={accionPrincipal.disabled}
              style={{
                ...mainActionButtonStyle,
                opacity: accionPrincipal.disabled ? 0.55 : 1,
                cursor: accionPrincipal.disabled ? "not-allowed" : "pointer",
              }}
            >
              {accionPrincipal.label}
            </button>
          )}
        </div>
      )}

      {hayAccionesPrimarias ? (
        <div style={{ ...actionGridStyle, ...(isMobile ? actionGridMobileStyle : {}) }}>
          {puedeCobrar && (
            <Link to={`/ventas/${venta.id}/cobro`} style={{ textDecoration: "none" }}>
              <Button fullWidth>Cobrar venta</Button>
            </Link>
          )}

          {puedeEntregar && (
            <Button
              fullWidth
              variant="secondary"
              onClick={onEntregar}
              disabled={procesando}
            >
              Entregar venta
            </Button>
          )}

          {puedeAnular && (
            <Button
              fullWidth
              variant="danger"
              onClick={onAnular}
              disabled={procesando}
            >
              Anular venta
            </Button>
          )}

          {puedeDevolver && (
            <div style={dangerZoneStyle}>
              <div style={dangerZoneText}>
                <strong>Operación destructiva</strong>
                <span>Devuelve stock y genera crédito al cliente. No revierte pagos.</span>
              </div>

              <Button
                fullWidth
                variant="outline"
                onClick={onDevolverCompleta}
                disabled={procesando}
                style={dangerReturnButtonStyle}
              >
                ↩ Generar devolución completa y crédito
              </Button>
            </div>
          )}
        </div>
      ) : !estaCerradaOperativamente ? (
        <div style={{ ...emptyActionsStyle, ...(isMobile ? emptyActionsMobileStyle : {}) }}>
          <AlertCircle size={18} />
          No hay acciones operativas disponibles para el estado actual.
        </div>
      ) : null}
    </Card>
  );
}

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
  marginTop: "12px",
};

const actionGridMobileStyle = {
  gridTemplateColumns: "1fr",
};

const mainActionStyle = {
  border: "1px solid #bfdbfe",
  background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 14,
  alignItems: "center",
};

const mainActionMobileStyle = {
  gridTemplateColumns: "1fr",
};

const mainActionLabelStyle = {
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 1000,
  textTransform: "uppercase",
  marginBottom: 4,
};

const mainActionButtonStyle = {
  border: "none",
  borderRadius: 13,
  padding: "13px 16px",
  background: "#2563eb",
  color: "white",
  fontWeight: 1000,
  textDecoration: "none",
  textAlign: "center",
  boxShadow: "0 10px 22px rgba(37,99,235,.22)",
};

const closedStateStyle = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  borderRadius: 12,
  padding: 14,
};

const closedStateMobileStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
};

const emptyActionsStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  background: "#f9fafb",
  color: "#344054",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: 14,
};

const emptyActionsMobileStyle = {
  alignItems: "flex-start",
};

const smallMutedStyle = {
  marginTop: 4,
  fontSize: 13,
  color: "#067647",
};

const dangerZoneStyle = {
  border: "1px solid #fecdca",
  background: "#fef3f2",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};

const dangerZoneText = {
  display: "grid",
  gap: 3,
  color: "#b42318",
  fontSize: 13,
};

const dangerReturnButtonStyle = {
  borderColor: "#fecdca",
  color: "#b42318",
  background: "#fff",
};
