import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
  obtenerDeuda,
  registrarPagoDeuda,
  simularPagoDeuda,
} from "../services/deudasService";
import DeudaHeader from "../components/deudas/detalle/DeudaHeader";
import DeudaResumenPanel from "../components/deudas/detalle/DeudaResumenPanel";
import DeudaPagoPanel from "../components/deudas/detalle/DeudaPagoPanel";
import DeudaMovimientosTable from "../components/deudas/detalle/DeudaMovimientosTable";
import DeudaOrigenPanel from "../components/deudas/detalle/DeudaOrigenPanel";
import { useSession } from "../context/SessionContext";
const MOBILE_BREAKPOINT = 760;

const PAGO_FORM_INICIAL = {
  monto_cliente: "",
  medio_pago: "efectivo",
  cuotas: "1",
  entidad: "",
  nota: "",
};

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => setIsMobile(event.matches);

    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);

    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

function normalizarMonto(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero;
}

function buildPagoPayload(pagoForm, usuarioId) {
  const montoCliente = normalizarMonto(pagoForm.monto_cliente);

  return {
    monto_cobrado_objetivo: montoCliente,
    medio_pago: pagoForm.medio_pago,
    cuotas:
      pagoForm.medio_pago === "tarjeta"
        ? Number(pagoForm.cuotas || 1)
        : null,
    entidad:
      pagoForm.medio_pago === "tarjeta" && pagoForm.entidad.trim()
        ? pagoForm.entidad.trim()
        : null,
    nota: pagoForm.nota.trim() || null,
    id_usuario: usuarioId,
  };
}

function buildPagoRegistroPayload(pagoForm, usuarioId, previewPago) {
  return {
    monto_base: normalizarMonto(previewPago?.monto_base_aplicado),
    medio_pago: pagoForm.medio_pago,
    cuotas:
      pagoForm.medio_pago === "tarjeta"
        ? Number(pagoForm.cuotas || 1)
        : null,
    entidad:
      pagoForm.medio_pago === "tarjeta" && pagoForm.entidad.trim()
        ? pagoForm.entidad.trim()
        : null,
    nota: pagoForm.nota.trim() || null,
    id_usuario: usuarioId,
  };
}

export default function DeudaDetallePage() {
  const { deudaId } = useParams();
  const isMobile = useIsMobile();

  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [previewPago, setPreviewPago] = useState(null);
  const preservarPreviewRef = useRef(false);
  const { usuarioId } = useSession();
  const [pagoForm, setPagoForm] = useState(PAGO_FORM_INICIAL);

  useEffect(() => {
    cargarDetalle();
  }, [deudaId]);

  useEffect(() => {
    if (preservarPreviewRef.current) {
      preservarPreviewRef.current = false;
      setMensaje("");
      return;
    }

    setPreviewPago(null);
    setMensaje("");
  }, [
    pagoForm.monto_cliente,
    pagoForm.medio_pago,
    pagoForm.cuotas,
    pagoForm.entidad,
  ]);

  async function cargarDetalle() {
    try {
      setLoading(true);
      setError("");

      const data = await obtenerDeuda(deudaId);
      setDetalle(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la deuda");
    } finally {
      setLoading(false);
    }
  }

  function validarPagoLocal() {
    const montoCliente = normalizarMonto(pagoForm.monto_cliente);

    if (!montoCliente || montoCliente <= 0) {
      return "El importe que paga el cliente debe ser mayor a cero";
    }

    if (pagoForm.medio_pago === "tarjeta" && Number(pagoForm.cuotas || 0) <= 0) {
      return "Las cuotas deben ser mayores a cero";
    }

    return "";
  }

  async function previsualizarPago() {
    const errorValidacion = validarPagoLocal();

    if (errorValidacion) {
      setError(errorValidacion);
      setPreviewPago(null);
      return;
    }

    try {
      setSimulando(true);
      setError("");
      setMensaje("");

      const payload = buildPagoPayload(pagoForm, usuarioId);
      const preview = await simularPagoDeuda(deudaId, payload);

      setPreviewPago(preview);
    } catch (err) {
      setPreviewPago(null);
      setError(err.message || "No se pudo simular el pago");
    } finally {
      setSimulando(false);
    }
  }

  async function completarSaldo() {
    const saldo = normalizarMonto(detalle?.deuda?.saldo_actual);

    if (!saldo || saldo <= 0) {
      setError("La deuda no tiene saldo pendiente");
      return;
    }

    if (pagoForm.medio_pago === "tarjeta" && Number(pagoForm.cuotas || 0) <= 0) {
      setError("Las cuotas deben ser mayores a cero");
      return;
    }

    try {
      setSimulando(true);
      setError("");
      setMensaje("");

      const payload = {
        ...buildPagoPayload({ ...pagoForm, monto_cliente: String(saldo) }, usuarioId),
        monto_cobrado_objetivo: undefined,
        monto_base: saldo,
      };
      const preview = await simularPagoDeuda(deudaId, payload);

      preservarPreviewRef.current = true;
      setPagoForm((prev) => ({
        ...prev,
        monto_cliente: String(Math.round(Number(preview.monto_total_cobrado || 0))),
      }));
      setPreviewPago(preview);
    } catch (err) {
      setPreviewPago(null);
      setError(err.message || "No se pudo calcular el importe para saldar");
    } finally {
      setSimulando(false);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();

    const errorValidacion = validarPagoLocal();

    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    if (!previewPago) {
      setError("Primero generá el preview del backend antes de confirmar el pago");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const payload = buildPagoRegistroPayload(pagoForm, usuarioId, previewPago);

      await registrarPagoDeuda(deudaId, payload);

      setPagoForm(PAGO_FORM_INICIAL);
      setPreviewPago(null);

      await cargarDetalle();

      setMensaje("Pago registrado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando deuda...</p>;
  }

  if (!detalle) {
    return <p style={{ padding: "24px" }}>No se encontró la deuda.</p>;
  }

  const deuda = detalle.deuda;
  const movimientos = detalle.movimientos || [];

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <DeudaHeader deuda={deuda} onRefresh={cargarDetalle} />

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={isMobile ? gridMobileStyle : gridStyle}>
        <DeudaResumenPanel deuda={deuda} />

        <DeudaPagoPanel
          deuda={deuda}
          pagoForm={pagoForm}
          setPagoForm={setPagoForm}
          previewPago={previewPago}
          previsualizarPago={previsualizarPago}
          completarSaldo={completarSaldo}
          registrarPago={registrarPago}
          guardando={guardando}
          simulando={simulando}
        />
      </section>

      <DeudaOrigenPanel origen={detalle.origen} />

      <div style={isMobile ? movimientosMobileWrapStyle : undefined}>
        <DeudaMovimientosTable movimientos={movimientos} />
      </div>
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "16px",
};

const pageMobileStyle = {
  gap: "12px",
  overflowX: "hidden",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.4fr) minmax(320px, 0.8fr)",
  gap: "16px",
  alignItems: "start",
};

const gridMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "12px",
  alignItems: "start",
};

const movimientosMobileWrapStyle = {
  minWidth: 0,
  overflowX: "auto",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #f4c7c3",
};

const successStyle = {
  background: "#ecfdf3",
  color: "#067647",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #abefc6",
};
