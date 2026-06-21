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

function toMoneyNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(2));
}

function normalizarMontoPago(monto) {
  const numero = Number(monto || 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero);
}

function casiIgualMonto(a, b) {
  return Math.abs(normalizarMontoPago(a) - normalizarMontoPago(b)) < 1;
}

const MEDIO_PAGO_DEFAULT = "efectivo";

function getSaldoPendienteSimulacion(data) {
  return toMoneyNumber(
    data?.total_a_cobrar ??
      data?.saldo_estimado ??
      data?.saldo_base_estimado ??
      0
  );
}

export default function useCheckoutVenta({
  clienteId,
  total,
  tipoPrecio,
  items,
  usarCreditoInicial = true,
  initialCheckoutDraft = null,
  onDraftChange,
  onEstadoCheckoutChange,
}) {
  const [pagosDraft, setPagosDraft] = useState([]);
  const [medioPago, setMedioPago] = useState(
    initialCheckoutDraft?.medioPago || MEDIO_PAGO_DEFAULT
  );
  const [monto, setMontoState] = useState(initialCheckoutDraft?.monto || "");
  const [entregarAhora, setEntregarAhora] = useState(
    Boolean(initialCheckoutDraft?.entregarAhora)
  );
  const [errorLocal, setErrorLocal] = useState("");
  const [simulacion, setSimulacion] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [previewSaldar, setPreviewSaldar] = useState(null);
  const [previewMontoActual, setPreviewMontoActual] = useState(null);
  const [planesTarjeta, setPlanesTarjeta] = useState([]);
  const [planTarjetaId, setPlanTarjetaId] = useState(
    initialCheckoutDraft?.planTarjetaId || ""
  );
  const [usarCredito, setUsarCredito] = useState(
    typeof initialCheckoutDraft?.usarCredito === "boolean"
      ? initialCheckoutDraft.usarCredito
      : usarCreditoInicial
  );
  const [montoCreditoAAplicar, setMontoCreditoAAplicar] = useState(
    initialCheckoutDraft?.montoCreditoAAplicar || ""
  );
  const simulacionSeqRef = useRef(0);
  const montoEditadoManualRef = useRef(Boolean(initialCheckoutDraft?.monto));

  const setMontoManual = useCallback((value) => {
    montoEditadoManualRef.current = true;
    setMontoState(value);
  }, []);

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

    const montoSugeridoCobrado = data.monto_sugerido_para_saldar;

    if (montoSugeridoCobrado === null || montoSugeridoCobrado === undefined) {
      setErrorLocal("No se pudo calcular el monto sugerido para saldar");
      return;
    }

    montoEditadoManualRef.current = false;
    setMontoState(String(normalizarMontoPago(montoSugeridoCobrado)));
    setErrorLocal("");
  }, [
    getDatosFinancierosPago,
    medioPago,
    pagosDraft,
    planTarjetaId,
    planesTarjeta,
    simularPagos,
  ]);

  const calcularBaseParaMontoCobrado = useCallback(
    async (montoCobradoObjetivo) => {
      const objetivo = normalizarMontoPago(montoCobradoObjetivo);

      if (objetivo <= 0) return null;

      let previewSaldarActual = previewSaldar;

      if (!previewSaldarActual) {
        previewSaldarActual = await simularPagos(
          pagosDraft,
          {
            medio_pago: medioPago,
            ...getDatosFinancierosPago(),
          },
          false
        );
      }

      const baseParaSaldar = toMoneyNumber(
        previewSaldarActual?.monto_base_sugerido_para_saldar ?? saldoBasePendiente
      );
      const cobradoParaSaldar = normalizarMontoPago(
        previewSaldarActual?.monto_sugerido_para_saldar ?? baseParaSaldar
      );

      if (baseParaSaldar <= 0) return objetivo;

      if (casiIgualMonto(objetivo, cobradoParaSaldar)) {
        return baseParaSaldar;
      }

      if (cobradoParaSaldar <= 0) {
        return Math.min(objetivo, baseParaSaldar);
      }

      const proporcion = baseParaSaldar / cobradoParaSaldar;
      let baseEstimada = toMoneyNumber(
        Math.min(Math.max(objetivo * proporcion, 0), baseParaSaldar)
      );

      const datosFinancieros = getDatosFinancierosPago();

      for (let intento = 0; intento < 3; intento += 1) {
        const pagoPrueba = {
          temp_id: "preview-base-cobrado",
          medio_pago: medioPago,
          monto_base: baseEstimada,
          cuotas: datosFinancieros.cuotas,
          entidad: datosFinancieros.entidad,
          nota: null,
        };

        const dataPrueba = await simularPagos([...pagosDraft, pagoPrueba], null, false);
        const tramoPrueba = dataPrueba?.tramos_pago?.[dataPrueba.tramos_pago.length - 1];
        const cobradoPrueba = toMoneyNumber(tramoPrueba?.monto_total_cobrado);

        if (cobradoPrueba <= 0 || casiIgualMonto(cobradoPrueba, objetivo)) {
          break;
        }

        baseEstimada = toMoneyNumber(
          Math.min(Math.max(baseEstimada * (objetivo / cobradoPrueba), 0), baseParaSaldar)
        );
      }

      return baseEstimada;
    },
    [
      getDatosFinancierosPago,
      medioPago,
      pagosDraft,
      previewSaldar,
      saldoBasePendiente,
      simularPagos,
    ]
  );

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

    const montoCobradoInput = normalizarMontoPago(monto);
    const montoBaseInput = await calcularBaseParaMontoCobrado(montoCobradoInput);

    if (!montoBaseInput || montoBaseInput <= 0) {
      setErrorLocal("No se pudo calcular cuanto saldo cubre este cobro");
      return;
    }

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
        monto_total_cobrado: normalizarMontoPago(tramoNuevo.monto_total_cobrado),
        descuento_aplicado: tramoNuevo.descuento_aplicado,
        recargo_aplicado: tramoNuevo.recargo_aplicado,
      };
    });

    const saldoPendienteLuego = getSaldoPendienteSimulacion(nuevaSimulacion);

    setPagosDraft(pagosConTramo);
    setSimulacion(nuevaSimulacion);
    setPreviewSaldar(null);
    setPreviewMontoActual(null);
    montoEditadoManualRef.current = false;
    setMontoState("");

    // Caso mixto: efectivo parcial + tarjeta 3 cuotas para completar saldo.
    // Si la venta queda cubierta, el formulario debe quedar limpio para no
    // conservar visualmente el ultimo medio/plan usado.
    if (saldoPendienteLuego <= 0) {
      setMedioPago(MEDIO_PAGO_DEFAULT);
      setPlanTarjetaId("");
    }

    setErrorLocal("");
  }, [
    calcularBaseParaMontoCobrado,
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
      setPreviewMontoActual(null);
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
        if (primerPlan && medioPago === "tarjeta" && !planTarjetaId) {
          setPlanTarjetaId(String(primerPlan.id));
        }
      } catch (err) {
        setErrorLocal(err.message || "No se pudieron cargar los planes de tarjeta");
      }
    }

    cargarPlanesTarjeta();
  }, [medioPago, planTarjetaId]);

  useEffect(() => {
    setPagosDraft([]);
    montoEditadoManualRef.current = Boolean(initialCheckoutDraft?.monto);
    setMontoState(initialCheckoutDraft?.monto || "");
    setErrorLocal("");
    setSimulacion(null);
    setPreviewSaldar(null);
    setPreviewMontoActual(null);
    setMedioPago(initialCheckoutDraft?.medioPago || MEDIO_PAGO_DEFAULT);
    setPlanTarjetaId(initialCheckoutDraft?.planTarjetaId || "");
    setEntregarAhora(Boolean(initialCheckoutDraft?.entregarAhora));
    setMontoCreditoAAplicar(initialCheckoutDraft?.montoCreditoAAplicar || "");
    setUsarCredito(
      typeof initialCheckoutDraft?.usarCredito === "boolean"
        ? initialCheckoutDraft.usarCredito
        : true
    );

    if (items.length > 0) {
      recalcularSimulacion([]);
    }
    // Se reinicia intencionalmente al cambiar el carrito/tipo de precio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, items, total, tipoPrecio]);

  useEffect(() => {
    onDraftChange?.({
      medioPago,
      planTarjetaId,
      monto,
      entregarAhora,
      usarCredito,
      montoCreditoAAplicar,
    });
  }, [
    entregarAhora,
    medioPago,
    monto,
    montoCreditoAAplicar,
    onDraftChange,
    planTarjetaId,
    usarCredito,
  ]);

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

      const saldoPendientePreview = getSaldoPendienteSimulacion(data);

      if (saldoPendientePreview <= 0) {
        setPreviewSaldar(null);
        setPreviewMontoActual(null);
        montoEditadoManualRef.current = false;
        setMontoState("");
        return;
      }

      setPreviewSaldar(data);
      if (data.monto_sugerido_para_saldar != null && !montoEditadoManualRef.current) {
        const montoSugerido = String(normalizarMontoPago(data.monto_sugerido_para_saldar));

        if (String(monto || "") !== montoSugerido) {
          setMontoState(montoSugerido);
        }
      }
    }

    cargarPreview();

    return () => {
      cancelado = true;
    };
  }, [getDatosFinancierosPago, items, medioPago, monto, pagosDraft, planTarjetaId, simularPagos, tipoPrecio]);


  useEffect(() => {
    let cancelado = false;
    const montoTexto = String(monto || "").trim();
    const montoCobradoInput = normalizarMontoPago(montoTexto);

    async function simularMontoActual() {
      if (!montoTexto || !Number.isFinite(montoCobradoInput) || montoCobradoInput <= 0) {
        setPreviewMontoActual(null);
        return;
      }

      const errorPlan = validarPlanTarjeta({
        medioPago,
        planTarjetaId,
        planesTarjeta,
      });

      if (errorPlan) {
        setPreviewMontoActual(null);
        return;
      }

      const datosFinancieros = getDatosFinancierosPago();
      const montoBaseInput = await calcularBaseParaMontoCobrado(montoCobradoInput);

      if (!montoBaseInput || montoBaseInput <= 0) {
        setPreviewMontoActual(null);
        return;
      }

      const pagoDraft = {
        temp_id: "preview-monto-actual",
        medio_pago: medioPago,
        monto_base: montoBaseInput,
        cuotas: datosFinancieros.cuotas,
        entidad: datosFinancieros.entidad,
        nota: null,
      };

      const data = await simularPagos([...pagosDraft, pagoDraft], null, false);

      if (cancelado || !data) return;

      setPreviewMontoActual(data);
    }

    const handle = setTimeout(simularMontoActual, 250);

    return () => {
      cancelado = true;
      clearTimeout(handle);
    };
  }, [
    calcularBaseParaMontoCobrado,
    getDatosFinancierosPago,
    medioPago,
    monto,
    pagosDraft,
    planTarjetaId,
    planesTarjeta,
    simularPagos,
  ]);

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
    setMonto: setMontoManual,
    entregarAhora,
    setEntregarAhora,
    errorLocal,
    simulacion,
    simulacionActiva,
    simulando,
    previewSaldar,
    previewMontoActual,
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
