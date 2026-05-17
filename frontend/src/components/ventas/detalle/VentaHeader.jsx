import { Link } from "react-router-dom";
import EstadoVentaBadge from "../EstadoVentaBadge";
import { Button, PageHeader } from "../../ui";

export default function VentaHeader({
  venta,
  procesando,
  onRefrescar,
}) {
  return (
    <PageHeader
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Venta #{venta.id}
          <EstadoVentaBadge estado={venta.estado} />
        </span>
      }
      subtitle={`${venta.cliente_nombre || "-"} · ${venta.sucursal_nombre || "-"}`}
      actions={
        <>
          <Button variant="outline" onClick={onRefrescar} disabled={procesando}>
            Refrescar
          </Button>

          <Link to="/ventas" style={{ textDecoration: "none" }}>
            <Button variant="outline">Volver</Button>
          </Link>
        </>
      }
    />
  );
}
