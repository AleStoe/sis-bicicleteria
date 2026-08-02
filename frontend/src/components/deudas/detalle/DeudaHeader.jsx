import { Link } from "react-router-dom";
import { Button, PageHeader } from "../../ui";
import { EstadoDeudaBadge } from "../../../pages/DeudasListPage";

export default function DeudaHeader({ deuda, onRefresh, onCopy }) {
  return (
    <PageHeader
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Deuda #{deuda.id}
          <EstadoDeudaBadge estado={deuda.estado} />
        </span>
      }
      subtitle={
        <>
          {deuda.cliente_nombre || `Cliente #${deuda.id_cliente}`}
          {deuda.cliente_dni ? ` · DNI ${deuda.cliente_dni}` : ""}
          {deuda.cliente_telefono ? ` · Tel ${deuda.cliente_telefono}` : ""}
          <div style={{ marginTop: 4, color: "#98a2b3" }}>
            Origen: {deuda.origen_tipo} #{deuda.origen_id}
          </div>
        </>
      }
      actions={
        <>
          {onCopy && (
            <Button variant="outline" onClick={onCopy}>
              Copiar deuda
            </Button>
          )}

          <Button variant="outline" onClick={onRefresh}>
            Refrescar
          </Button>

          <Link to="/deudas" style={{ textDecoration: "none" }}>
            <Button variant="outline">Volver</Button>
          </Link>
        </>
      }
    />
  );
}
