import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import VentaHeader from "../components/ventas/detalle/VentaHeader";
import VentaResumenCards from "../components/ventas/detalle/VentaResumenCards";
import VentaLecturaRapida from "../components/ventas/detalle/VentaLecturaRapida";
import VentaDocumentosPanel from "../components/ventas/detalle/VentaDocumentosPanel";
import VentaPagosPanel from "../components/ventas/detalle/VentaPagosPanel";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { PromptModal } from "../components/ui/PromptModal";

import {
  obtenerVenta,
  anularVenta,
  entregarVenta,
  devolverVentaSerializada,
  devolverVenta,
  devolverItemsVenta,
} from "../services/ventasService";
import VentaItemsVendidos from "../components/ventas/detalle/VentaItemsVendidos";
import { listarPagosDeVenta, revertirPago } from "../services/pagosService";
import { useSession } from "../context/SessionContext";
import { formatMoney } from "../utils/formatters";
import VentaAccionesPanel from "../components/ventas/detalle/VentaAccionesPanel";
import VentaSituacionFinanciera from "../components/ventas/detalle/VentaSituacionFinanciera";
import {
  pageStyle,
  alertStyle,
  successStyle,
} from "../styles/pages/ventaDetallePageStyles";
import { obtenerAccionesVentaDetalle } from "../rules/ventaDetalleActionRules";
import { puedeRevertirPago } from "../rules/ventaDetalleActionRules";

export default function VentaDetallePage() {
  const params = useParams();
  const location = useLocation();
  const ventaId = params.ventaId || params.id;
  const { usuarioId, usuarioActual } = useSession();

  const [data, setData] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [promptConfig, setPromptConfig] = useState(null);

  function pedirConfirmacion(config) {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        },
      });
    });
  }

  function pedirPrompt(config) {
    return new Promise((resolve) => {
      setPromptConfig({
        ...config,
        onConfirm: (value) => {
          setPromptConfig(null);
          resolve(value);
        },
        onCancel: () => {
          setPromptConfig(null);
          resolve(null);
        },
      });
    });
  }
  useEffect(() => {
    cargarVenta({ mostrarCarga: true, limpiarMensaje: true });
  }, [ventaId]);

  useEffect(() => {
    if (location.state?.scrollToTop || location.state?.ventaFinalizadaDesdeCheckout) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [location.state]);

  async function cargarVenta({
    mostrarCarga = false,
    limpiarMensaje = false,
  } = {}) {
    try {
      if (mostrarCarga) setLoading(true);
      setError("");
      if (limpiarMensaje) setMensaje("");

      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData || []);
    } catch (err) {
      setError(
        err.message ||
          (mostrarCarga
            ? "No se pudo cargar la venta"
            : "No se pudo refrescar la venta")
      );
    } finally {
      if (mostrarCarga) setLoading(false);
    }
  }

  async function handleEntregarVenta() {
    const venta = data?.venta;
    const saldo = Number(venta?.saldo_pendiente || 0);
    const tieneDeudaFormal = Boolean(
      data?.situacion_financiera?.tiene_deuda ||
        data?.situacion_financiera?.deuda_abierta ||
        data?.situacion_financiera?.deuda_formal
    );

    if (saldo > 0 && !tieneDeudaFormal) {
      setError("No se puede entregar una venta con saldo pendiente sin deuda formal asociada.");
      return;
    }

    const confirmar = await pedirConfirmacion({
      title: "Entregar venta",
      message:
        saldo > 0
          ? "Esta venta tiene saldo pendiente, pero cuenta con deuda formal asociada.\n¿Confirmás la entrega?"
          : "¿Confirmás la entrega de esta venta? Revisá que el cobro esté correcto antes de entregar la mercadería.",
      confirmText: "Entregar venta",
      cancelText: "Cancelar",
      variant: "warning",
    });

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await entregarVenta(ventaId, { id_usuario: usuarioId });
      await cargarVenta();

      setMensaje("Venta entregada correctamente");
    } catch (err) {
      setError(err.message || "No se pudo entregar la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleRevertirPago(pago) {
    if (!puedeRevertirPago(pago, usuarioActual)) {
      setError("No tenes permiso para revertir este pago o el pago no esta confirmado.");
      return;
    }

    const motivo = await pedirPrompt({
      title: "Revertir pago",
      message: `Se revertirá este pago y se actualizarán los saldos asociados.\n\nPago #${pago.id}. ¿Querés continuar?`,
      label: "Motivo de reversion",
      required: true,
      minLength: 3,
      confirmText: "Revertir pago",
      cancelText: "Cancelar",
    });

    if (!motivo || !motivo.trim()) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await revertirPago(pago.id, {
        motivo: motivo.trim(),
        id_usuario: usuarioId,
      });

      await cargarVenta();
      setMensaje(`Pago #${pago.id} revertido correctamente`);
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setProcesando(false);
    }
  }

  async function handleAnularVenta() {
    const confirmarAnulacion = await pedirConfirmacion({
      title: "Anular venta",
      message:
        "Esta acción anulará la venta y puede impactar en stock, pagos, deudas o créditos asociados.\n¿Confirmás la anulación?",
      confirmText: "Continuar",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmarAnulacion) return;

    const motivo = await pedirPrompt({
      title: "Anular venta",
      label: "Motivo de anulación",
      required: true,
      minLength: 3,
      confirmText: "Anular venta",
    });

    if (!motivo || motivo.trim().length < 3) return;

    if (!motivo || motivo.trim().length < 3) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await anularVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: usuarioId,
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
    let modoDevolucion = "credito_comercial";

    if (tienePagosExternosConfirmados()) {
      const pagoExternoCancelado = await pedirConfirmacion({
        title: "Confirmar cancelación externa",
        message:
          "La venta tiene pagos con tarjeta o MercadoPago.\n\n" +
          "Continuá únicamente si ya cancelaste esos importes en la terminal o plataforma.\n\n" +
          "El sistema generará crédito sólo por efectivo/transferencia y restaurará cualquier crédito usado.",
        confirmText: "Ya lo cancelé",
        cancelText: "Volver",
        variant: "warning",
      });

      if (!pagoExternoCancelado) return;
      modoDevolucion = "reversion_pago_externo";
    }
    const motivo = await pedirPrompt({
      title: "Devolución total",
      label: "Motivo de devolución",
      message:
        modoDevolucion === "reversion_pago_externo"
          ? "No se generará crédito comercial. Los pagos externos confirmados se marcarán como devueltos."
          : `Se generará crédito estimado por ${formatMoney(totalEstimadoCredito)}, no devolución de efectivo.`,
      required: true,
      minLength: 3,
      confirmText: "Continuar",
    });

    if (!motivo || motivo.trim().length < 3) return;

    const confirmar = await pedirConfirmacion({
      title: "Confirmar devolución total",
      message:
        modoDevolucion === "reversion_pago_externo"
          ? "¿Confirmás la devolución TOTAL de esta venta? Se devolverá stock y los pagos externos se marcarán como devueltos. No se generará crédito ni egreso de caja."
          : `¿Confirmás la devolución TOTAL de esta venta? Se devolverá stock y se generará crédito estimado por ${formatMoney(totalEstimadoCredito)}.`,
      confirmText: "Devolver venta",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: usuarioId,
        modo_devolucion: modoDevolucion,
      });

      await cargarVenta();

      setMensaje(
        modoDevolucion === "reversion_pago_externo"
          ? `Venta devuelta correctamente. Pago externo marcado como devuelto. Crédito por efectivo/transferencia: ${formatMoney(result.credito_generado)}.`
          : `Venta devuelta correctamente. Crédito generado: ${formatMoney(result.credito_generado)}`
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
    if (tienePagosExternosConfirmados()) {
      setError(
        "No se puede hacer una devolución parcial mientras existan pagos confirmados con tarjeta o Mercado Pago. Hacé una devolución total o resolvé primero el pago externo."
      );
      return;
    }

    const cantidadMaxima = getCantidadDisponibleDevolucion(item);

    if (cantidadMaxima <= 0) {
      setError("Este item no tiene cantidad disponible para devolver");
      return;
    }

    const cantidadRaw = await pedirPrompt({
      title: "Devolver item",
      label: "Cantidad a devolver",
      message: `Item #${item.id}. Disponible para devolver: ${cantidadMaxima}`,
      inputType: "number",
      required: true,
      confirmText: "Continuar",
      validate: (value) => {
        const cantidad = Number(value);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          return "La cantidad a devolver debe ser mayor a 0";
        }

        if (cantidad > cantidadMaxima) {
          return "La cantidad a devolver no puede superar la cantidad disponible";
        }

        return "";
      },
    });

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

    const motivo = await pedirPrompt({
      title: "Motivo de devolución parcial",
      label: "Motivo",
      message: "Se generará crédito al cliente.",
      required: true,
      minLength: 3,
      confirmText: "Continuar",
    });

    if (!motivo || motivo.trim().length < 3) return;

    const creditoEstimado = calcularCreditoEstimadoItem(item, cantidad);

    const confirmar = await pedirConfirmacion({
      title: "Confirmar devolución parcial",
      message: `¿Confirmás devolver ${cantidad} unidad(es) del item #${item.id}?

    Crédito estimado: ${formatMoney(creditoEstimado)}`,
      confirmText: "Devolver item",
      cancelText: "Cancelar",
      variant: "warning",
    });

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
        id_usuario: usuarioId,
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

    let modoDevolucion = "credito_comercial";

    if (tienePagosExternosConfirmados()) {
      const pagoExternoCancelado = await pedirConfirmacion({
        title: "Confirmar cancelación externa",
        message:
          "Esta venta tiene pagos con tarjeta o MercadoPago.\n\n" +
          "Continuá únicamente si ya cancelaste el pago en Posnet, banco o Mercado Pago.\n\n" +
          "El sistema no generará crédito comercial por esa parte electrónica.",
        confirmText: "Ya lo cancelé",
        cancelText: "Volver",
        variant: "warning",
      });

      if (!pagoExternoCancelado) return;
      modoDevolucion = "reversion_pago_externo";
    }

    const mensajeMotivo =
      modoDevolucion === "reversion_pago_externo"
        ? "No se generará crédito comercial. El pago externo se marcará como devuelto."
        : `Crédito estimado: ${formatMoney(creditoEstimado)}`;

    const motivo = await pedirPrompt({
      title: "Devolución serializada",
      label: "Motivo",
      message: mensajeMotivo,
      required: true,
      minLength: 3,
      confirmText: "Registrar devolución",
    });

    if (!motivo || motivo.trim().length < 3) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverVentaSerializada(ventaId, {
        id_bicicleta_serializada: Number(item.id_bicicleta_serializada),
        motivo: motivo.trim(),
        id_usuario: usuarioId,
        modo_devolucion: modoDevolucion,
      });

      await cargarVenta();

      setMensaje(
        modoDevolucion === "reversion_pago_externo"
          ? `Devolución registrada. ID devolución: ${result.devolucion_id}. Pago externo marcado como devuelto.`
          : `Devolución registrada. ID devolución: ${result.devolucion_id}. El crédito se calcula según el total real de la venta.`
      );
    } catch (err) {
      setError(err.message || "No se pudo registrar la devolución serializada");
    } finally {
      setProcesando(false);
    }
  }
  const totalPagadoReal = useMemo(() => {
    return Number(
      data?.situacion_financiera?.total_pagado_confirmado ??
        pagos
          .filter((pago) => pago.estado === "confirmado")
          .reduce((acc, pago) => acc + Number(pago.monto_total_cobrado || 0), 0)
    );
  }, [data, pagos]);
  const resumenLiquidacion = useMemo(() => {
    return pagos
      .filter((pago) => pago.estado === "confirmado")
      .reduce(
        (acc, pago) => {
          const bruto = Number(pago.monto_total_cobrado || 0);
          const neto = Number(pago.monto_neto_liquidado ?? bruto);
          acc.neto += Number.isFinite(neto) ? neto : 0;
          acc.costo += Number.isFinite(bruto - neto)
            ? Math.max(bruto - neto, 0)
            : 0;
          return acc;
        },
        { neto: 0, costo: 0 }
      );
  }, [pagos]);
  function tienePagosExternosConfirmados() {
    return (pagos ?? []).some(
      (p) =>
        p.estado === "confirmado" &&
        ["tarjeta", "mercadopago"].includes(p.medio_pago)
    );
  }
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
  const cubiertoNoPago = Number(
    situacion_financiera?.monto_cubierto_sin_pago_real ?? 0
  );

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
const {
  puedeCobrar,
  puedeEntregar,
  puedeAnular,
  puedeDevolver,
  estaCerradaOperativamente,
} = obtenerAccionesVentaDetalle(venta, situacion_financiera);

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
        situacionFinanciera={situacion_financiera}
        totalFinal={totalFinal}
        totalPagadoReal={totalPagadoReal}
        totalNetoLiquidado={resumenLiquidacion.neto}
        totalCostoFinanciero={resumenLiquidacion.costo}
        cubiertoNoPago={cubiertoNoPago}
        saldoPendiente={saldoPendiente}
        formatMoney={formatMoney}
      />

      <VentaLecturaRapida
        venta={venta}
        items={items}
        situacionFinanciera={situacion_financiera}
        totalFinal={totalFinal}
        totalPagadoReal={totalPagadoReal}
        saldoPendiente={saldoPendiente}
        formatMoney={formatMoney}
      />

      {venta.id_reserva_origen && (
          <section style={reservaOrigenStyle}>
            <div>
              <strong>Venta generada desde reserva #{venta.id_reserva_origen}</strong>
              <div style={reservaOrigenTextStyle}>
                Esta venta proviene de una reserva. La seña previa puede explicar parte de la cobertura financiera no cobrada.
              </div>
            </div>

            <a
              href={`/reservas/${venta.id_reserva_origen}`}
              style={reservaOrigenLinkStyle}
            >
              Ver reserva
            </a>
          </section>
        )}

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

      <VentaSituacionFinanciera
        venta={venta}
        coberturaNoCobrada={coberturaNoCobrada}
        creditoAplicadoReal={creditoAplicadoReal}
        creditoGeneradoDevolucion={creditoGeneradoDevolucion}
        deudaCanceladaPorDevolucion={deudaCanceladaPorDevolucion}
        tieneDeuda={tieneDeuda}
        deuda={deuda}
      />

      <VentaPagosPanel
        pagos={pagos}
        formatMoney={formatMoney}
        procesando={procesando}
        canRevertirPago={(pago) => puedeRevertirPago(pago, usuarioActual)}
        onRevertirPago={handleRevertirPago}
      />

      <VentaItemsVendidos
        venta={venta}
        items={items}
        factorDevolucion={factorDevolucion}
        procesando={procesando}
        onDevolverItem={handleDevolverItem}
        onDevolverSerializada={handleDevolverSerializada}
      />

      <ConfirmModal
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText}
        variant={confirmConfig?.variant}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={confirmConfig?.onCancel}
      />

      <PromptModal
        open={Boolean(promptConfig)}
        title={promptConfig?.title}
        message={promptConfig?.message}
        label={promptConfig?.label}
        defaultValue={promptConfig?.defaultValue}
        placeholder={promptConfig?.placeholder}
        inputType={promptConfig?.inputType}
        confirmText={promptConfig?.confirmText}
        cancelText={promptConfig?.cancelText}
        required={promptConfig?.required}
        minLength={promptConfig?.minLength}
        validate={promptConfig?.validate}
        onConfirm={promptConfig?.onConfirm}
        onCancel={promptConfig?.onCancel}
      />
    </div>
  );
}

const reservaOrigenStyle = {
  background: "#eef4ff",
  border: "1px solid #c7d7fe",
  color: "#175cd3",
  borderRadius: "14px",
  padding: "14px 16px",
  margin: "12px 0",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const reservaOrigenTextStyle = {
  marginTop: "4px",
  fontSize: "13px",
  color: "#344054",
};

const reservaOrigenLinkStyle = {
  textDecoration: "none",
  background: "white",
  color: "#175cd3",
  border: "1px solid #c7d7fe",
  borderRadius: "10px",
  padding: "8px 12px",
  fontWeight: 800,
};
