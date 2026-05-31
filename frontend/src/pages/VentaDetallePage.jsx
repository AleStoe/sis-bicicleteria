import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import VentaHeader from "../components/ventas/detalle/VentaHeader";
import VentaResumenCards from "../components/ventas/detalle/VentaResumenCards";
import VentaDocumentosPanel from "../components/ventas/detalle/VentaDocumentosPanel";
import VentaPagosPanel from "../components/ventas/detalle/VentaPagosPanel";

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

  function calcularFactorDevolucionActual() {
    const subtotalBase = Number(data?.venta?.subtotal_base || 0);
    const totalFinalVenta = Number(data?.venta?.total_final || 0);

    if (!Number.isFinite(subtotalBase) || subtotalBase <= 0) return 1;
    if (!Number.isFinite(totalFinalVenta) || totalFinalVenta < 0) return 1;

    return totalFinalVenta / subtotalBase;
  }

  function calcularCreditoEstimadoItem(item, cantidad) {
    const factor = calcularFactorDevolucionActual();
    const precioUnitario = Number(
      item?.precio_unitario_final ?? item?.precio_final ?? 0
    );
    const cantidadNumerica = Number(cantidad || 0);

    if (!Number.isFinite(precioUnitario) || !Number.isFinite(cantidadNumerica)) {
      return 0;
    }

    return Math.round(precioUnitario * cantidadNumerica * factor * 100) / 100;
  }

  async function handleDevolverVentaCompleta() {
    const totalEstimadoCredito = Number(data?.venta?.total_final || 0);

    const motivo = window.prompt(
      `Motivo de devolución total de la venta. Se generará crédito estimado por ${formatMoney(totalEstimadoCredito)}, no devolución de efectivo:`
    );

    if (!motivo || motivo.trim().length < 3) return;

    const confirmar = window.confirm(
      `¿Confirmás la devolución TOTAL de esta venta? Se devolverá stock y se generará crédito estimado por ${formatMoney(totalEstimadoCredito)}.`
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

  function getCantidadDisponibleDevolucion(item) {
    const cantidadVendida = Number(item?.cantidad || 0);
    const cantidadDevuelta = Number(
      item?.cantidad_devuelta ??
        item?.cantidad_devuelta_total ??
        item?.cantidad_ya_devuelta ??
        item?.devuelto_cantidad ??
        0
    );

    const cantidadDisponibleBackend = item?.cantidad_disponible_devolucion;

    if (cantidadDisponibleBackend !== undefined && cantidadDisponibleBackend !== null) {
      const disponible = Number(cantidadDisponibleBackend);
      return Number.isFinite(disponible) ? Math.max(disponible, 0) : 0;
    }

    if (!Number.isFinite(cantidadVendida)) return 0;
    if (!Number.isFinite(cantidadDevuelta)) return Math.max(cantidadVendida, 0);

    return Math.max(cantidadVendida - cantidadDevuelta, 0);
  }

  async function handleDevolverItem(item) {
    const cantidadMaxima = getCantidadDisponibleDevolucion(item);

    if (cantidadMaxima <= 0) {
      setError("Este item no tiene cantidad disponible para devolver");
      return;
    }

    const cantidadRaw = window.prompt(
      `Cantidad a devolver del item #${item.id}. Disponible para devolver: ${cantidadMaxima}`
    );

    if (!cantidadRaw) return;

    const cantidad = Number(cantidadRaw);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setError("La cantidad a devolver debe ser mayor a 0");
      return;
    }

    if (cantidad > cantidadMaxima) {
      setError("La cantidad a devolver no puede superar la cantidad disponible para devolución");
      return;
    }

    const motivo = window.prompt(
      "Motivo de devolución parcial. Se generará crédito al cliente:"
    );

    if (!motivo || motivo.trim().length < 3) return;

    const creditoEstimado = calcularCreditoEstimadoItem(item, cantidad);

    const confirmar = window.confirm(
      `¿Confirmás devolver ${cantidad} unidad(es) del item #${item.id}?\n\nCrédito estimado: ${formatMoney(creditoEstimado)}`
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

    const creditoEstimado = calcularCreditoEstimadoItem(item, 1);

    const motivo = window.prompt(
      `Motivo de devolución de bicicleta serializada. Crédito estimado: ${formatMoney(creditoEstimado)}`
    );

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

      setMensaje(
        `Devolución registrada. ID devolución: ${result.devolucion_id}. El crédito se calcula según el total real de la venta.`
      );
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
  const subtotalBase = Number(venta.subtotal_base || 0);
  const factorDevolucion = subtotalBase > 0 ? totalFinal / subtotalBase : 1;
  const saldoPendiente = Number(venta.saldo_pendiente || 0);
  const cubiertoNoPago = Math.max(
    totalFinal - totalPagadoReal - saldoPendiente,
    0
  );

const estadosFinales = ["anulada", "devuelta"];
const estadosAnulables = ["creada", "pagada_parcial", "pagada_total"];
const estadosEntregables = ["creada", "pagada_parcial", "pagada_total"];
const estadosCobrables = ["creada", "pagada_parcial", "pagada_total"];
const estadosDevolvibles = ["entregada", "devuelta_parcial"];

const tieneDeuda = situacion_financiera?.tiene_deuda;
const deuda = situacion_financiera?.deuda_abierta;
const resumenFinanciero = situacion_financiera?.resumen || {};

const deudaCanceladaPorDevolucion = Number(
  resumenFinanciero.deuda_cancelada_por_devolucion ?? 0
);

const creditoAplicadoReal = Number(
  resumenFinanciero.credito_aplicado_real ?? 0
);

const creditoGeneradoDevolucion = Number(
  resumenFinanciero.credito_generado_devolucion ?? 0
);


const coberturaNoCobrada = Number(
  resumenFinanciero.cobertura_no_cobrada ?? cubiertoNoPago
);
const puedeAnular = estadosAnulables.includes(venta.estado);

const puedeEntregar = estadosEntregables.includes(venta.estado);

const puedeDevolver = estadosDevolvibles.includes(venta.estado);

const puedeCobrar =
  saldoPendiente > 0 &&
  !tieneDeuda &&
  estadosCobrables.includes(venta.estado);

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
        venta={venta}
        coberturaNoCobrada={coberturaNoCobrada}
        creditoAplicadoReal={creditoAplicadoReal}
        creditoGeneradoDevolucion={creditoGeneradoDevolucion}
        deudaCanceladaPorDevolucion={deudaCanceladaPorDevolucion}
        tieneDeuda={tieneDeuda}
        deuda={deuda}
      />

      <VentaPagosPanel pagos={pagos} formatMoney={formatMoney} />

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
        factorDevolucion={factorDevolucion}
        procesando={procesando}
        onDevolverItem={handleDevolverItem}
        onDevolverSerializada={handleDevolverSerializada}
      />
    </div>
  );
}

