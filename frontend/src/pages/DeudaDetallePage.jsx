import { useEffect, useState } from "react";
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
  monto_base: "",
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
  const montoBase = normalizarMonto(pagoForm.monto_base);

  return {
    monto_base: montoBase,
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
  const { usuarioId } = useSession();
  const [pagoForm, setPagoForm] = useState(PAGO_FORM_INICIAL);

  useEffect(() => {
    cargarDetalle();
  }, [deudaId]);

  useEffect(() => {
    setPreviewPago(null);
    setMensaje("");
  }, [
    pagoForm.monto_base,
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
    const montoBase = normalizarMonto(pagoForm.monto_base);
    const saldo = normalizarMonto(detalle?.deuda?.saldo_actual) || 0;

    if (!montoBase || montoBase <= 0) {
      return "El monto base debe ser mayor a cero";
    }

    if (montoBase > saldo) {
      return "El monto base no puede superar el saldo actual de la deuda";
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

      const payload = buildPagoPayload(pagoForm, usuarioId);

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
