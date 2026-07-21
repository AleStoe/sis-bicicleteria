import { Link } from "react-router-dom";
import EstadoVentaBadge from "../EstadoVentaBadge";
import { Button, PageHeader } from "../../ui";

export default function VentaHeader({
  venta,
  procesando,
  onRefrescar,
}) {
  const clienteContenido = venta.id_cliente ? (
    <Link to={`/clientes/${venta.id_cliente}`} style={styles.clienteLink}>
      {venta.cliente_nombre || `Cliente #${venta.id_cliente}`}
    </Link>
  ) : (
    <span>{venta.cliente_nombre || "-"}</span>
  );

  return (
    <PageHeader
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Venta #{venta.id}
          <EstadoVentaBadge estado={venta.estado} />
        </span>
      }
      subtitle={
        <span style={styles.subtitle}>
          {clienteContenido}
          <span>-</span>
          <span>{venta.sucursal_nombre || "-"}</span>
        </span>
      }
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

const styles = {
  subtitle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  clienteLink: {
    color: "#1d4ed8",
    fontWeight: 800,
    textDecoration: "none",
  },
};
