import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PagoVentaPanel from "../components/pagos/PagoVentaPanel";
import { obtenerVenta } from "../services/ventasService";
import { formatDateTime } from "../utils/formatters";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "../components/ui";
import { puedeCobrarVenta } from "../rules/ventaDetalleActionRules";

export default function VentaCobroPage() {
  const { ventaId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarTodo();
  }, [ventaId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");

      const ventaData = await obtenerVenta(ventaId);
      setData(ventaData);
    } catch (err) {
      setError(err.message || "No se pudo cargar el cobro");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <EmptyState title="Cargando cobro..." description="Actualizando pagos y saldo de la venta." />;
  }

  if (!data) {
    return <EmptyState title="No se encontró la venta" description="Volvé al listado e intentá nuevamente." />;
  }

  const { venta, situacion_financiera } = data;

  const tieneDeuda = situacion_financiera?.tiene_deuda;
  const deuda = situacion_financiera?.deuda_abierta;

  const cobroDirectoBloqueadoPorDeuda = Boolean(tieneDeuda && deuda);
  const puedeCobrarDirecto = puedeCobrarVenta(venta, situacion_financiera);

  return (
    <div style={pageStyle}>
      <PageHeader
        title={`Cobro venta #${venta.id}`}
        subtitle={`${formatDateTime(venta.fecha)} · ${
          venta.cliente_nombre || "-"
        } · ${venta.sucursal_nombre || "-"}`}
        actions={
          <>
            <Button variant="outline" onClick={cargarTodo}>
              Refrescar
            </Button>

            <Link to={`/ventas/${venta.id}`} style={{ textDecoration: "none" }}>
              <Button variant="outline">Volver al detalle</Button>
            </Link>
          </>
        }
      />

      {error && <div style={alertStyle}>Error: {error}</div>}

      {cobroDirectoBloqueadoPorDeuda ? (
        <Card
          title="Cobro derivado a cuenta corriente"
          subtitle="Esta venta tiene una deuda formalizada. El cobro debe continuar desde Deudas."
        >
          <div style={blockedBoxStyle}>
            <div>
              <strong>Saldo formalizado en deuda #{deuda.id}</strong>
              <div style={mutedStyle}>
                Para mantener consistente caja, deuda y venta, no se registran pagos directos desde esta pantalla.
              </div>
            </div>

            <Link to={`/deudas/${deuda.id}`} style={{ textDecoration: "none" }}>
              <Button>
                <span style={buttonContentStyle}>
                  Ir a deuda
                  <ArrowRight size={16} />
                </span>
              </Button>
            </Link>
          </div>
        </Card>
      ) : puedeCobrarDirecto ? (
        <PagoVentaPanel
          ventaId={venta.id}
          venta={venta}
          situacionFinanciera={situacion_financiera}
          saldoPendiente={venta.saldo_pendiente}
          estadoVenta={venta.estado}
          autoFocusPago
          onPagoCambiado={cargarTodo}
        />
      ) : (
        <Card
          title="Sin cobro pendiente"
          subtitle="La venta no tiene saldo pendiente para cobrar desde este flujo."
        >
          <div style={okBoxStyle}>
            No hay acciones de cobro disponibles para esta venta.
          </div>
        </Card>
      )}
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "16px",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #f4c7c3",
};

const blockedBoxStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  background: "#fff8e1",
  border: "1px solid #f3dc97",
  borderRadius: "12px",
  padding: "14px",
  color: "#8a6d00",
};

const okBoxStyle = {
  background: "#ecfdf3",
  border: "1px solid #abefc6",
  color: "#067647",
  borderRadius: "12px",
  padding: "14px",
  fontWeight: 700,
};

const mutedStyle = {
  marginTop: "6px",
  color: "#667085",
  fontSize: "13px",
};

const buttonContentStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};
