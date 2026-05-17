import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Card, Badge } from "../../ui";

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
        <div style={closedStateStyle}>
          <CheckCircle2 size={18} />
          <div>
            <strong>Venta cerrada operativamente</strong>
            <div style={smallMutedStyle}>
              No tiene saldo pendiente y ya fue entregada. No requiere nuevas acciones.
            </div>
          </div>
        </div>
      )}

      {hayAccionesPrimarias ? (
        <div style={actionGridStyle}>
          {puedeCobrar && (
            <Link to={`/ventas/${venta.id}/cobro`} style={{ textDecoration: "none" }}>
              <Button fullWidth> Cobrar venta </Button>
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
            <Button
              fullWidth
              variant="outline"
              onClick={onDevolverCompleta}
              disabled={procesando}
              style={{
                borderColor: "#f3dc97",
                color: "#8a6d00",
                background: "#fff8e1",
              }}
            >
              Devolver venta completa
            </Button>
          )}
        </div>
      ) : !estaCerradaOperativamente ? (
        <div style={emptyActionsStyle}>
          <AlertCircle size={18} />
          No hay acciones operativas disponibles para el estado actual.
        </div>
      ) : null}

      {puedeDevolver && (
        <div style={smallNoteStyle}>
          Las devoluciones no revierten pagos: devuelven stock y generan crédito al cliente.
        </div>
      )}
    </Card>
  );
}

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
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

const smallNoteStyle = {
  marginTop: "12px",
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "12px",
  borderRadius: "8px",
  color: "#344054",
};

const smallMutedStyle = {
  marginTop: 4,
  fontSize: 13,
  color: "#067647",
};
