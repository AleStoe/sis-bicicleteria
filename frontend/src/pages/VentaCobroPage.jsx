import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PagoVentaPanel from "../components/pagos/PagoVentaPanel";
import { entregarVenta, obtenerVenta } from "../services/ventasService";
import { finalizarRetiroOrdenTaller } from "../services/tallerService";
import { useSession } from "../context/SessionContext";
import {
  buildEntregaVentaPayload,
  esBicicletaSerializableEnCaja,
} from "../builders/ventasPayloadBuilder";
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
  const navigate = useNavigate();
  const { usuarioId } = useSession();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesandoEntrega, setProcesandoEntrega] = useState(false);

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

  async function finalizarRetiroTaller(destino) {
    const ordenId = data?.venta?.id_orden_taller;
    if (!ordenId || !usuarioId) return;

    if (
      destino === "retirada" &&
      !window.confirm("¿El cliente se lleva la bicicleta ahora? Se entregará la venta y se cerrará la OT.")
    ) {
      return;
    }

    try {
      setProcesandoEntrega(true);
      setError("");
      const resultado = await finalizarRetiroOrdenTaller(ordenId, {
        destino,
        id_usuario: usuarioId,
      });
      navigate(`/taller/${ordenId}`, {
        state: {
          mensaje:
            resultado.estado_orden === "retirada"
              ? "Cobro, entrega y retiro cerrados correctamente."
              : "Cobro registrado. Bicicleta lista para retirar.",
        },
      });
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo finalizar el retiro");
    } finally {
      setProcesandoEntrega(false);
    }
  }

  async function entregarVentaComun() {
    const ventaActual = data?.venta;
    const items = data?.items || [];
    if (!ventaActual || !usuarioId) return;

    const entregaEnCaja = items.some(esBicicletaSerializableEnCaja);
    const detalle = entregaEnCaja
      ? "La venta incluye una bicicleta sin número de cuadro asignado y se entregará en caja."
      : "Se marcará la mercadería como entregada.";
    if (!window.confirm(`${detalle}\n\n¿Confirmás la entrega ahora?`)) return;

    try {
      setProcesandoEntrega(true);
      setError("");
      setMensaje("");
      await entregarVenta(
        ventaActual.id,
        buildEntregaVentaPayload({
          usuarioId,
          items,
          condicionEntregaBicicleta: entregaEnCaja ? "en_caja" : "armada",
        }),
      );
      await cargarTodo();
      setMensaje("Venta cobrada y entregada correctamente.");
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo entregar la venta");
    } finally {
      setProcesandoEntrega(false);
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
  const ventaSaldada = Number(venta.saldo_pendiente || 0) <= 0;
  const esVentaTaller = Boolean(venta.id_orden_taller);

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
      {mensaje && <div style={successAlertStyle}>{mensaje}</div>}

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
      ) : ventaSaldada && venta.estado !== "entregada" ? (
        <Card
          title="Cobro completado"
          subtitle={
            esVentaTaller
              ? `Venta de la OT #${venta.id_orden_taller}. Elegí qué sucede con la bicicleta.`
              : "La venta quedó saldada. Podés completar la entrega sin volver al detalle."
          }
        >
          <div style={completionBoxStyle}>
            <div>
              <strong>Saldo pendiente: $0</strong>
              <div style={mutedStyle}>
                {esVentaTaller
                  ? "Venta y Taller se actualizarán juntos."
                  : "El cobro ya está registrado; sólo falta confirmar la entrega."}
              </div>
            </div>
            <div style={completionActionsStyle}>
              {esVentaTaller ? (
                <>
                  <Button
                    variant="outline"
                    disabled={procesandoEntrega}
                    onClick={() => finalizarRetiroTaller("lista_para_retirar")}
                  >
                    Dejar lista para retirar
                  </Button>
                  <Button
                    disabled={procesandoEntrega}
                    onClick={() => finalizarRetiroTaller("retirada")}
                  >
                    Entregar y cerrar retiro
                  </Button>
                </>
              ) : (
                <Button disabled={procesandoEntrega} onClick={entregarVentaComun}>
                  Entregar ahora
                </Button>
              )}
            </div>
          </div>
        </Card>
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

const successAlertStyle = {
  background: "#ecfdf3",
  color: "#067647",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #abefc6",
};

const completionBoxStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  flexWrap: "wrap",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: "12px",
  padding: "16px",
};

const completionActionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
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
