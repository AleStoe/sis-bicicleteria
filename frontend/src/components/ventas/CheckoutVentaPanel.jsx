import { useEffect, useMemo, useState } from "react";
import CheckoutResumenPago from "./checkout/CheckoutResumenPago";
import CheckoutAgregarPago from "./checkout/CheckoutAgregarPago";
import CheckoutPagosList from "./checkout/CheckoutPagosList";
import CheckoutTotalesSimulacion from "./checkout/CheckoutTotalesSimulacion";
import { simularVenta } from "../../services/ventasService";
import { listarTarjetaPlanes } from "../../services/reglasComercialesService";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export default function CheckoutVentaPanel({
  total,
  tipoPrecio,
  items,
  guardando,
  onVaciar,
  onFinalizar,
  onEstadoCheckoutChange,
  mostrarPagosCargados = true,
}) {
  const [pagosDraft, setPagosDraft] = useState([]);
  const [medioPago, setMedioPago] = useState("efectivo");
  const [monto, setMonto] = useState("");
  const [entregarAhora, setEntregarAhora] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");
  const [simulacion, setSimulacion] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [previewSaldar, setPreviewSaldar] = useState(null);
  const [planesTarjeta, setPlanesTarjeta] = useState([]);
  const [planTarjetaId, setPlanTarjetaId] = useState("");

  const cantidadItems = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  }, [items]);

  const simulacionActiva = previewSaldar || simulacion;

  const totalCalculado = Number(simulacionActiva?.total_final ?? total ?? 0);
  const pagado = Number(simulacion?.total_pagos_cargados ?? 0);

  const pendiente = Number(
    previewSaldar?.monto_sugerido_para_saldar ??
      simulacion?.saldo_estimado ??
      totalCalculado
  );

  const pagadoBase = pagosDraft.reduce(
    (acc, pago) => acc + Number(pago.monto_base || 0),
    0
  );

  const pagadoCliente = pagosDraft.reduce(
    (acc, pago) =>
      acc + Number(pago.monto_total_cobrado ?? pago.monto_base ?? 0),
    0
  );

  const saldoBasePendiente = Math.max(Number(total || 0) - pagadoBase, 0);

  const planTarjetaSeleccionado = useMemo(() => {
    return planesTarjeta.find(
      (plan) => String(plan.id) === String(planTarjetaId)
    );
  }, [planesTarjeta, planTarjetaId]);

  function getDatosFinancierosPago() {
    if (medioPago !== "tarjeta") {
      return {
        cuotas: null,
        entidad: null,
      };
    }

    return {
      cuotas: planTarjetaSeleccionado?.cuotas || 1,
      entidad: planTarjetaSeleccionado?.entidad || null,
    };
  }

  function buildPayloadSimulacion(
    pagos = pagosDraft,
    sugerirSaldoConMedioPago = null
  ) {
    return {
      tipo_precio: tipoPrecio || "minorista",
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: String(item.cantidad),
        id_bicicleta_serializada:
          item.modo_venta_serializada === "serializada" &&
          item.id_bicicleta_serializada
            ? Number(item.id_bicicleta_serializada)
            : null,
        precio_unitario_manual: item.precio_unitario_manual
          ? String(item.precio_unitario_manual)
          : null,
        bonificado: Boolean(item.bonificado),
        motivo_precio_manual: item.motivo_precio_manual || null,
        motivo_bonificacion: item.motivo_bonificacion || null,
      })),
      pagos: pagos.map((pago) => ({
        medio_pago: pago.medio_pago,
        monto_base: String(pago.monto_base),
        cuotas: pago.cuotas || null,
        entidad: pago.entidad || null,
        nota: pago.nota || null,
      })),
      sugerir_saldo_con_medio_pago: sugerirSaldoConMedioPago,
    };
  }

  async function simularPagos(
    pagos = pagosDraft,
    sugerirSaldoConMedioPago = null,
    mostrarError = true
  ) {
    if (items.length === 0) return null;

    try {
      setSimulando(true);
      if (mostrarError) setErrorLocal("");

      return await simularVenta(
        buildPayloadSimulacion(pagos, sugerirSaldoConMedioPago)
      );
    } catch (err) {
      if (mostrarError) {
        setErrorLocal(err.message || "No se pudo simular el total de la venta");
      }
      return null;
    } finally {
      setSimulando(false);
    }
  }

  async function recalcularSimulacion(pagos = pagosDraft) {
    const data = await simularPagos(pagos);
    setSimulacion(data);
    return data;
  }

  async function sugerirMontoParaSaldar() {
    const data = await simularPagos(pagosDraft, {
      medio_pago: medioPago,
      ...getDatosFinancierosPago(),
    });

    if (!data) return;

    setPreviewSaldar(data);
    setSimulacion(data);

    const baseSugerida = data.monto_base_sugerido_para_saldar;

    if (baseSugerida === null || baseSugerida === undefined) {
      setErrorLocal("No se pudo calcular el monto base sugerido para saldar");
      return;
    }

    setMonto(String(Number(baseSugerida).toFixed(2)));
    setErrorLocal("");
  }

  async function agregarPago() {
    const montoBaseInput = Number(monto);

    if (!Number.isFinite(montoBaseInput) || montoBaseInput <= 0) {
      setErrorLocal("El monto base debe ser mayor a cero");
      return;
    }

    const datosFinancieros = getDatosFinancierosPago();

    const pagoDraft = {
      temp_id: crypto.randomUUID(),
      medio_pago: medioPago,
      monto_base: montoBaseInput,
      cuotas: datosFinancieros.cuotas,
      entidad: datosFinancieros.entidad,
      nota: null,
    };

    const nuevosPagos = [...pagosDraft, pagoDraft];

    const nuevaSimulacion = await simularPagos(nuevosPagos);

    if (!nuevaSimulacion) return;

    const tramoNuevo =
      nuevaSimulacion.tramos_pago?.[nuevaSimulacion.tramos_pago.length - 1];

    const pagosConTramo = nuevosPagos.map((pago) => {
      if (pago.temp_id !== pagoDraft.temp_id || !tramoNuevo) return pago;

      return {
        ...pago,
        monto_total_cobrado: tramoNuevo.monto_total_cobrado,
        descuento_aplicado: tramoNuevo.descuento_aplicado,
        recargo_aplicado: tramoNuevo.recargo_aplicado,
      };
    });

    setPagosDraft(pagosConTramo);
    setSimulacion(nuevaSimulacion);
    setPreviewSaldar(null);
    setMonto("");
    setErrorLocal("");
  }

  async function quitarPago(tempId) {
    const nuevosPagos = pagosDraft.filter((pago) => pago.temp_id !== tempId);
    setPagosDraft(nuevosPagos);
    setPreviewSaldar(null);
    await recalcularSimulacion(nuevosPagos);
  }

  useEffect(() => {
    async function cargarPlanesTarjeta() {
      try {
        const data = await listarTarjetaPlanes(true);
        setPlanesTarjeta(data);

        const primerPlan = data?.[0];
        if (primerPlan) setPlanTarjetaId(String(primerPlan.id));
      } catch (err) {
        setErrorLocal(err.message || "No se pudieron cargar los planes de tarjeta");
      }
    }

    cargarPlanesTarjeta();
  }, []);

  useEffect(() => {
    setPagosDraft([]);
    setMonto("");
    setErrorLocal("");
    setSimulacion(null);
    setPreviewSaldar(null);

    if (items.length > 0) {
      recalcularSimulacion([]);
    }
  }, [items, total, tipoPrecio]);

  useEffect(() => {
    let cancelado = false;

    async function cargarPreview() {
      if (items.length === 0) {
        setPreviewSaldar(null);
        return;
      }

      const data = await simularPagos(
        pagosDraft,
        {
          medio_pago: medioPago,
          ...getDatosFinancierosPago(),
        },
        false
      );

      if (cancelado || !data) return;

      setPreviewSaldar(data);
    }

    cargarPreview();

    return () => {
      cancelado = true;
    };
  }, [medioPago, planTarjetaId, pagosDraft, items, tipoPrecio]);

  useEffect(() => {
    onEstadoCheckoutChange?.({
      pagosDraft,
      simulacion: simulacionActiva,
      precioLista: Number(total || 0),
      totalCalculado,
      pagadoBase,
      pagadoCliente,
      saldoBasePendiente,
      pendienteActual: pendiente,
      medioPago,
      planTarjeta: planTarjetaSeleccionado || null,
      entregarAhora,
      simulando,
      quitarPago,
    });
  }, [
    onEstadoCheckoutChange,
    pagosDraft,
    simulacionActiva,
    total,
    totalCalculado,
    pagadoBase,
    pagadoCliente,
    saldoBasePendiente,
    pendiente,
    medioPago,
    planTarjetaSeleccionado,
    entregarAhora,
    simulando,
    quitarPago,
  ]);

  function finalizar() {
    onFinalizar?.({
      pagos: pagosDraft.map((pago) => ({
        medio_pago: pago.medio_pago,
        monto_base: String(pago.monto_base),
        cuotas: pago.cuotas || null,
        entidad: pago.entidad || null,
        nota: pago.nota || null,
      })),
      entregar_ahora: entregarAhora,
    });
  }

  return (
    <section style={styles.card}>
      <CheckoutResumenPago
        total={totalCalculado}
        pagado={pagado}
        pendiente={pendiente}
        cantidadItems={cantidadItems}
        formatMoney={formatMoney}
      />

      <CheckoutTotalesSimulacion
        simulacion={simulacionActiva}
        formatMoney={formatMoney}
        simulando={simulando}
      />

      <CheckoutAgregarPago
        medioPago={medioPago}
        setMedioPago={setMedioPago}
        monto={monto}
        setMonto={setMonto}
        agregarPago={agregarPago}
        sugerirMontoParaSaldar={sugerirMontoParaSaldar}
        previewSaldar={previewSaldar}
        formatMoney={formatMoney}
        errorLocal={errorLocal}
        simulando={simulando}
        planesTarjeta={planesTarjeta}
        planTarjetaId={planTarjetaId}
        setPlanTarjetaId={setPlanTarjetaId}
      />

      {mostrarPagosCargados && (
        <CheckoutPagosList
          pagosDraft={pagosDraft}
          quitarPago={quitarPago}
          formatMoney={formatMoney}
        />
      )}

      <label style={styles.checkRow}>
        <input
          type="checkbox"
          checked={entregarAhora}
          onChange={(e) => setEntregarAhora(e.target.checked)}
        />
        Entregar ahora
      </label>

      <div style={styles.actions}>
        <button type="button" onClick={onVaciar} style={styles.clear}>
          Vaciar
        </button>

        <button
          type="button"
          onClick={finalizar}
          disabled={guardando || items.length === 0 || simulando}
          style={styles.primary}
        >
          {guardando ? "Procesando..." : "Finalizar venta"}
        </button>
      </div>
    </section>
  );
}

const styles = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    background: "#ffffff",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#344054",
    marginBottom: 12,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: 10,
  },
  clear: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 12,
    padding: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  primary: {
    border: "none",
    background: "#12a15f",
    color: "white",
    borderRadius: 12,
    padding: 13,
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  },
};