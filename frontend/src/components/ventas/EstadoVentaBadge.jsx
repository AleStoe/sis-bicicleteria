import { Badge } from "../ui";

export default function EstadoVentaBadge({ estado }) {
  return <Badge variant={getEstadoVentaVariant(estado)}>{estado}</Badge>;
}

export function getEstadoVentaVariant(estado) {
  switch (estado) {
    case "entregada":
      return "success";
    case "anulada":
      return "danger";
    case "pagada_total":
      return "default";
    case "pagada_parcial":
      return "warning";
    case "creada":
      return "primary";
    default:
      return "default";
  }
}
