import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { simularVenta } from "../services/ventasService";
import { listarTarjetaPlanes } from "../services/reglasComercialesService";
import {
  buildPagoVentaPayload,
  buildVentaSimulacionPayload,
} from "../builders/ventasPayloadBuilder";
import {
  validarCheckoutAntesDeFinalizar,
  validarMontoPago,
  validarPlanTarjeta,
} from "../validators/ventasValidator";

function crearTempId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function useCheckoutVenta({
  clienteId,
  total,
  tipoPrecio,
  items,
  usarCreditoInicial = true,
  onEstadoCheckoutChange,
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
  const [usarCredito, setUsarCredito] = useState(usarCreditoInicial);
  const [montoCreditoAAplicar, setMontoCreditoAAplicar] = useState("");
  const simulacionSeqRef = useRef(0);

  const cantidadItems = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  }, [items]);

  const planTarjetaSeleccionado = useMemo(() => {
    return planesTarjeta.find(
      (plan) => String(plan.id) === String(planTarjetaId)
    );
  }, [planesTarjeta, planTarjetaId]);

  const simulacionActiva = previewSaldar || simulacion;
  const totalCalculado = Number(simulacionActiva?.total_final ?? total ?? 0);
  const pagado = Number(simulacion?.total_pagos_cargados ?? 0);

  const pendiente = Number(
    previewSaldar?.total_a_cobrar ??
      simulacion?.total_a_cobrar ??
      previewSaldar?.monto_sugerido_para_saldar ??
      simulacion?.saldo_estimado ??
      totalCalculado
  );

  const pagadoBase = useMemo(() => {
    return pagosDraft.reduce((acc, pago) => acc + Number(pago.monto_base || 0), 0);
  }, [pagosDraft]);

  const pagadoCliente = useMemo(() => {
    return pagosDraft.reduce(
      (acc, pago) => acc + Number(pago.monto_total_cobrado ?? pago.monto_base ?? 0),
      0
    );
  }, [pagosDraft]);

  const saldoBasePendiente = Math.max(Number(total || 0) - pagadoBase, 0);

  const getDatosFinancierosPago = useCallback(() => {
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
  }, [medioPago, planTarjetaSeleccionado]);

  const simularPagos = useCallback(
    async (pagos = pagosDraft, sugerirSaldoConMedioPago = null, mostrarError = true) => {
      if (items.length === 0) return null;

      const seq = ++simulacionSeqRef.current;

      try {
        setSimulando(true);
        if (mostrarError) setErrorLocal("");

        const data = await simularVenta(
          buildVentaSimulacionPayload({
            clienteId,
            tipoPrecio,
            items,
            pagos,
            sugerirSaldoConMedioPago,
            usarCredito,
            montoCreditoAAplicar,
          })
        );

        if (seq !== simulacionSeqRef.current) return null;

        return data;
      } catch (err) {
        if (mostrarError) {
          setErrorLocal(err.message || "No se pudo simular el total de la venta");
        }
        return null;
      } finally {
        if (seq === simulacionSeqRef.current) {
          setSimulando(false);
        }
      }
    },
    [
      clienteId,
      items,
      pagosDraft,
      tipoPrecio,
      usarCredito,
      montoCreditoAAplicar,
    ]
  );

  const recalcularSimulacion = useCallback(
    async (pagos = pagosDraft) => {
      const data = await simularPagos(pagos);
      setSimulacion(data);
      return data;
    },
    [pagosDraft, simularPagos]
  );

  const sugerirMontoParaSaldar = useCallback(async () => {
    const errorPlan = validarPlanTarjeta({
      medioPago,
      planTarjetaId,
      planesTarjeta,
    });

    if (errorPlan) {
      setErrorLocal(errorPlan);
      return;
    }

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
  }, [
    getDatosFinancierosPago,
    medioPago,
    pagosDraft,
    planTarjetaId,
    planesTarjeta,
    simularPagos,
  ]);

  const agregarPago = useCallback(async () => {
    const errorMonto = validarMontoPago(monto);
    if (errorMonto) {
      setErrorLocal(errorMonto);
      return;
    }

    const errorPlan = validarPlanTarjeta({
      medioPago,
      planTarjetaId,
      planesTarjeta,
    });

    if (errorPlan) {
      setErrorLocal(errorPlan);
      return;
    }

    const montoBaseInput = Number(monto);
    const datosFinancieros = getDatosFinancierosPago();

    const pagoDraft = {
      temp_id: crearTempId(),
      medio_pago: medioPago,
      monto_base: montoBaseInput,
      cuotas: datosFinancieros.cuotas,
      entidad: datosFinancieros.entidad,
      nota: null,
    };

    const nuevosPagos = [...pagosDraft, pagoDraft];
    const nuevaSimulacion = await simularPagos(nuevosPagos);

    if (!nuevaSimulacion) return;

    const tramoNuevo = nuevaSimulacion.tramos_pago?.[nuevaSimulacion.tramos_pago.length - 1];

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
  }, [
    getDatosFinancierosPago,
    medioPago,
    monto,
    pagosDraft,
    planTarjetaId,
    planesTarjeta,
    simularPagos,
  ]);

  const quitarPago = useCallback(
    async (tempId) => {
      const nuevosPagos = pagosDraft.filter((pago) => pago.temp_id !== tempId);
      setPagosDraft(nuevosPagos);
      setPreviewSaldar(null);
      await recalcularSimulacion(nuevosPagos);
    },
    [pagosDraft, recalcularSimulacion]
  );

  const finalizarCheckout = useCallback(() => {
    const errorCheckout = validarCheckoutAntesDeFinalizar({ items, simulando });

    if (errorCheckout) {
      setErrorLocal(errorCheckout);
      return null;
    }

    const creditoAplicadoActual = Number(simulacionActiva?.credito_aplicado ?? 0);

    return {
      pagos: pagosDraft.map(buildPagoVentaPayload),
      entregar_ahora: entregarAhora,
      usar_credito: usarCredito && creditoAplicadoActual > 0,
      monto_credito_a_aplicar:
        montoCreditoAAplicar !== null &&
        montoCreditoAAplicar !== undefined &&
        String(montoCreditoAAplicar).trim() !== ""
          ? String(montoCreditoAAplicar)
          : null,
    };
  }, [
    entregarAhora,
    items,
    pagosDraft,
    simulando,
    usarCredito,
    montoCreditoAAplicar,
    simulacionActiva,
    pendiente,
  ]);

  useEffect(() => {
    async function cargarPlanesTarjeta() {
      try {
        const data = await listarTarjetaPlanes(true);
        setPlanesTarjeta(data || []);

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
    setMontoCreditoAAplicar("");
    setUsarCredito(true);

    if (items.length > 0) {
      recalcularSimulacion([]);
    }
    // Se reinicia intencionalmente al cambiar el carrito/tipo de precio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, items, total, tipoPrecio]);

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
      if (data.monto_base_sugerido_para_saldar != null) {
        setMonto(String(data.monto_base_sugerido_para_saldar));
      }
    }

    cargarPreview();

    return () => {
      cancelado = true;
    };
  }, [getDatosFinancierosPago, items, medioPago, pagosDraft, planTarjetaId, simularPagos, tipoPrecio]);

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

      usarCredito,
      setUsarCredito,
      montoCreditoAAplicar,
      setMontoCreditoAAplicar,
      creditoDisponible: Number(simulacionActiva?.credito_disponible ?? 0),
      creditoAplicado: Number(simulacionActiva?.credito_aplicado ?? 0),
      saldoCreditoRestante: Number(simulacionActiva?.saldo_credito_restante ?? 0),
      totalACobrar: Number(simulacionActiva?.total_a_cobrar ?? pendiente),
    });
  }, [
    entregarAhora,
    medioPago,
    onEstadoCheckoutChange,
    pagadoBase,
    pagadoCliente,
    pagosDraft,
    pendiente,
    planTarjetaSeleccionado,
    quitarPago,
    saldoBasePendiente,
    simulacionActiva,
    simulando,
    total,
    totalCalculado,

    usarCredito,
    montoCreditoAAplicar,
  ]);

  return {
    pagosDraft,
    medioPago,
    setMedioPago,
    monto,
    setMonto,
    entregarAhora,
    setEntregarAhora,
    errorLocal,
    simulacion,
    simulacionActiva,
    simulando,
    previewSaldar,
    planesTarjeta,
    planTarjetaId,
    setPlanTarjetaId,
    cantidadItems,
    totalCalculado,
    pagado,
    pendiente,
    agregarPago,
    quitarPago,
    sugerirMontoParaSaldar,
    finalizarCheckout,
    pagadoBase,
    pagadoCliente,
    saldoBasePendiente,

    usarCredito,
    setUsarCredito,
    montoCreditoAAplicar,
    setMontoCreditoAAplicar,
    creditoDisponible: Number(simulacionActiva?.credito_disponible ?? 0),
    creditoAplicado: Number(simulacionActiva?.credito_aplicado ?? 0),
    saldoCreditoRestante: Number(simulacionActiva?.saldo_credito_restante ?? 0),
    totalACobrar: Number(simulacionActiva?.total_a_cobrar ?? pendiente),
  };
}
