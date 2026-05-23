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
  total,
  tipoPrecio,
  items,
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
            tipoPrecio,
            items,
            pagos,
            sugerirSaldoConMedioPago,
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
    [items, pagosDraft, tipoPrecio]
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

    return {
      pagos: pagosDraft.map(buildPagoVentaPayload),
      entregar_ahora: entregarAhora,
    };
  }, [entregarAhora, items, pagosDraft, simulando]);

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

    if (items.length > 0) {
      recalcularSimulacion([]);
    }
    // Se reinicia intencionalmente al cambiar el carrito/tipo de precio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  };
}
