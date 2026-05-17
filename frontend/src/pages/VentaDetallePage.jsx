import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import VentaHeader from "../components/ventas/detalle/VentaHeader";
import VentaResumenCards from "../components/ventas/detalle/VentaResumenCards";
import VentaDocumentosPanel from "../components/ventas/detalle/VentaDocumentosPanel";
import {
  obtenerVenta,
  anularVenta,
  entregarVenta,
  devolverVentaSerializada,
  devolverVenta,
  devolverItemsVenta,
} from "../services/ventasService";
import VentaItemsVendidos from "../components/ventas/detalle/VentaItemsVendidos";
import { listarPagosDeVenta } from "../services/pagosService";
import { CURRENT_USER_ID } from "../config/appConfig";
import { formatMoney } from "../utils/formatters";
import VentaAccionesPanel from "../components/ventas/detalle/VentaAccionesPanel";
import VentaSituacionFinanciera from "../components/ventas/detalle/VentaSituacionFinanciera";
import {
  pageStyle,
  alertStyle,
  successStyle,
} from "../styles/pages/ventaDetallePageStyles";

export default function VentaDetallePage() {
  const params = useParams();
  const ventaId = params.ventaId || params.id;

  const [data, setData] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, [ventaId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");
      
      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la venta");
    } finally {
      setLoading(false);
    }
  
  }

  async function cargarVenta() {
    try {
      setError("");

      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData || []);
    } catch (err) {
      setError(err.message || "No se pudo refrescar la venta");
    }
  }

  async function handleEntregarVenta() {
    const confirmar = window.confirm(
      "¿Confirmás la entrega de esta venta? Si tiene saldo pendiente, el backend exigirá permiso y creará deuda."
    );

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await entregarVenta(ventaId, { id_usuario: CURRENT_USER_ID });
      await cargarVenta();

      setMensaje("Venta entregada correctamente");
    } catch (err) {
      setError(err.message || "No se pudo entregar la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleAnularVenta() {
    const motivo = window.prompt("Motivo de anulación de la venta:");

    if (!motivo || motivo.trim().length < 3) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await anularVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(
        result.credito_generado
          ? `Venta anulada. Crédito generado: ${formatMoney(result.monto_credito)}`
          : "Venta anulada correctamente"
      );
    } catch (err) {
      setError(err.message || "No se pudo anular la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverVentaCompleta() {
    const motivo = window.prompt(
      "Motivo de devolución total de la venta. Se generará crédito al cliente, no devolución de efectivo:"
    );

    if (!motivo || motivo.trim().length < 3) return;

    const confirmar = window.confirm(
      "¿Confirmás la devolución TOTAL de esta venta? Se devolverá stock y se generará crédito al cliente."
    );

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(
        `Venta devuelta correctamente. Crédito generado: ${formatMoney(result.credito_generado)}`
      );
    } catch (err) {
      setError(err.message || "No se pudo devolver la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverItem(item) {
    const cantidadMaxima = Number(item.cantidad || 0);

    const cantidadRaw = window.prompt(
      `Cantidad a devolver del item #${item.id}. Máximo: ${cantidadMaxima}`
    );

    if (!cantidadRaw) return;

    const cantidad = Number(cantidadRaw);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setError("La cantidad a devolver debe ser mayor a 0");
      return;
    }

    if (cantidad > cantidadMaxima) {
      setError("La cantidad a devolver no puede superar la cantidad vendida");
      return;
    }

    const motivo = window.prompt(
      "Motivo de devolución parcial. Se generará crédito al cliente:"
    );

    if (!motivo || motivo.trim().length < 3) return;

    const confirmar = window.confirm(
      `¿Confirmás devolver ${cantidad} unidad(es) del item #${item.id}?`
    );

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverItemsVenta(ventaId, {
        items: [
          {
            id_venta_item: Number(item.id),
            cantidad: String(cantidad),
          },
        ],
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(
        `Devolución parcial registrada. Crédito generado: ${formatMoney(result.credito_generado)}`
      );
    } catch (err) {
      setError(err.message || "No se pudo devolver el item");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverSerializada(item) {
    if (!item.id_bicicleta_serializada) return;

    const motivo = window.prompt("Motivo de devolución de bicicleta serializada:");

    if (!motivo || motivo.trim().length < 3) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverVentaSerializada(ventaId, {
        id_bicicleta_serializada: Number(item.id_bicicleta_serializada),
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(`Devolución registrada. ID devolución: ${result.devolucion_id}`);
    } catch (err) {
      setError(err.message || "No se pudo registrar la devolución serializada");
    } finally {
      setProcesando(false);
    }
  }

  const totalPagadoReal = useMemo(() => {
    return pagos
      .filter((pago) => pago.estado === "confirmado")
      .reduce((acc, pago) => acc + Number(pago.monto_total_cobrado || 0), 0);
  }, [pagos]);

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando detalle de venta...</p>;
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={alertStyle}>Error: {error}</div>
      </div>
    );
  }

  
  if (!data) {
    return <p style={{ padding: "24px" }}>No se encontró la venta.</p>;
  }

  const { venta, items = [], situacion_financiera } = data;

  const totalFinal = Number(venta.total_final || 0);
  const saldoPendiente = Number(venta.saldo_pendiente || 0);
  const cubiertoNoPago = Math.max(
    totalFinal - totalPagadoReal - saldoPendiente,
    0
  );

const estadosFinales = ["anulada", "devuelta", "devuelta_parcial"];

const tieneDeuda = situacion_financiera?.tiene_deuda;
const deuda = situacion_financiera?.deuda_abierta;

const puedeAnular = ["creada", "pagada_parcial", "pagada_total"].includes(
  venta.estado
);

const puedeEntregar = !["entregada", ...estadosFinales].includes(
  venta.estado
);

const puedeDevolver = ["entregada", "devuelta_parcial"].includes(
  venta.estado
);

const puedeCobrar =
  saldoPendiente > 0 &&
  !tieneDeuda &&
  !["anulada", "devuelta"].includes(venta.estado);

const estaCerradaOperativamente =
  saldoPendiente <= 0 && venta.estado === "entregada";

  return (
    <div style={pageStyle}>
      <VentaHeader
        venta={venta}
        procesando={procesando}
        onRefrescar={cargarVenta}
      />

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <VentaResumenCards
        venta={venta}
        totalFinal={totalFinal}
        totalPagadoReal={totalPagadoReal}
        cubiertoNoPago={cubiertoNoPago}
        saldoPendiente={saldoPendiente}
        formatMoney={formatMoney}
      />

      <VentaSituacionFinanciera
        cubiertoNoPago={cubiertoNoPago}
        tieneDeuda={tieneDeuda}
        deuda={deuda}
      />

      <VentaAccionesPanel
        venta={venta}
        procesando={procesando}
        puedeCobrar={puedeCobrar}
        puedeEntregar={puedeEntregar}
        puedeAnular={puedeAnular}
        puedeDevolver={puedeDevolver}
        estaCerradaOperativamente={estaCerradaOperativamente}
        onEntregar={handleEntregarVenta}
        onAnular={handleAnularVenta}
        onDevolverCompleta={handleDevolverVentaCompleta}
      />

      <VentaDocumentosPanel ventaId={venta.id} />

      <VentaItemsVendidos
        venta={venta}
        items={items}
        procesando={procesando}
        onDevolverItem={handleDevolverItem}
        onDevolverSerializada={handleDevolverSerializada}
      />
    </div>
  );
}

