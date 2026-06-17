import { OperationalStatusBadge } from "../ui";

export default function EstadoVentaBadge({ estado }) {
  return <OperationalStatusBadge domain="venta" status={estado} />;
}
