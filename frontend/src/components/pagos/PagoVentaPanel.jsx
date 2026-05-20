import { useEffect, useMemo, useRef, useState } from "react";
import {
  crearPago,
  listarPagosDeVenta,
  revertirPago,
  simularTramoPagoVenta,
} from "../../services/pagosService";
import { listarTarjetaPlanes } from "../../services/reglasComercialesService";
import { CURRENT_USER_ID } from "../../config/appConfig";

import PagoVentaResumen from "./PagoVentaResumen";
import PagoVentaFormulario from "./PagoVentaFormulario";
import PagoVentaPreview from "./PagoVentaPreview";
import PagoVentaTabla from "./PagoVentaTabla";

export default function PagoVentaPanel({
  ventaId,
  saldoPendiente = 0,
  estadoVenta = "",
  autoFocusPago = false,
  onPagoCambiado,
}) {
  const panelRef = useRef(null);
  const montoRef = useRef(null);
  const [planesTarjeta, setPlanesTarjeta] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [mostrarRevertidos, setMostrarRevertidos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState({
    modo: "base",
    medio_pago: "efectivo",
    monto: "",
    cuotas: 3,
    entidad: "",
    nota: "",
  });

  const [preview, setPreview] = useState(null);

  const saldo = Number(saldoPendiente || 0);

  const ventaCerradaParaPago = [
    "entregada",
    "anulada",
    "devuelta",
    "devuelta_parcial",
  ].includes(estadoVenta);

  const puedePagar = !ventaCerradaParaPago && saldo > 0;

  const pagosConfirmados = useMemo(
    () => pagos.filter((pago) => pago.estado === "confirmado"),
    [pagos]
  );

  const pagosRevertidos = useMemo(
    () => pagos.filter((pago) => pago.estado === "revertido"),
    [pagos]
  );

  const totalConfirmado = useMemo(() => {
    return pagosConfirmados.reduce(
      (acc, pago) => acc + Number(pago.monto_total_cobrado || 0),
      0
    );
  }, [pagosConfirmados]);

  useEffect(() => {
    if (ventaId) cargarPagos();
  }, [ventaId]);

  useEffect(() => {
  async function cargarPlanes() {
    try {
      const data = await listarTarjetaPlanes(true);

      setPlanesTarjeta(data || []);

      if (data?.length) {
        setForm((actual) => ({
          ...actual,
          cuotas: data[0].cuotas,
          entidad: data[0].entidad || "",
        }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  cargarPlanes();
}, []);
  useEffect(() => {
    if (!autoFocusPago) return;

    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      montoRef.current?.focus();
    }, 150);
  }, [autoFocusPago]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      simularTramoActual();
    }, 300);

    return () => clearTimeout(timeout);
  }, [form.modo, form.medio_pago, form.monto, form.cuotas, form.entidad, ventaId, saldoPendiente]);

  async function cargarPagos() {
    try {
      setLoading(true);
      setError("");

      const data = await listarPagosDeVenta(ventaId);
      setPagos(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pagos de la venta");
    } finally {
      setLoading(false);
    }
  }

  async function refrescarTodo() {
    await cargarPagos();

    if (onPagoCambiado) {
      await onPagoCambiado();
    }
  }

  function actualizarForm(patch) {
    setForm((actual) => ({
      ...actual,
      ...patch,
    }));
    setMensaje("");
    setError("");
  }

  function buildPayloadSimulacion({ saldar = false } = {}) {
    const monto = Number(form.monto || 0);

    const base = {
      venta_id: Number(ventaId),
      medio_pago: form.medio_pago,
      cuotas: form.medio_pago === "tarjeta" ? Number(form.cuotas || 1) : null,
      entidad: form.entidad?.trim() || null,
    };

    if (saldar) {
      return {
        ...base,
        monto_cobrado_objetivo: String(saldo),
      };
    }

    if (form.modo === "cobrado") {
      return {
        ...base,
        monto_cobrado_objetivo: String(monto),
      };
    }

    return {
      ...base,
      monto_base: String(monto),
    };
  }

  async function simularTramoActual() {
    const monto = Number(form.monto || 0);

    if (!puedePagar || !Number.isFinite(monto) || monto <= 0) {
      setPreview(null);
      return null;
    }

    try {
      setSimulando(true);

      const data = await simularTramoPagoVenta(buildPayloadSimulacion());
      setPreview(data);

      return data;
    } catch {
      setPreview(null);
      return null;
    } finally {
      setSimulando(false);
    }
  }

  async function saldar() {
    if (!puedePagar) return;

    try {
      setSimulando(true);
      setError("");
      setMensaje("");

      const data = await simularTramoPagoVenta(
        buildPayloadSimulacion({ saldar: true })
      );

      setPreview(data);
      setForm((actual) => ({
        ...actual,
        modo: "cobrado",
        monto: String(Number(data.monto_total_cobrado || 0).toFixed(2)),
      }));

      setTimeout(() => montoRef.current?.focus(), 50);
    } catch (err) {
      setError(err.message || "No se pudo calcular el monto para saldar");
    } finally {
      setSimulando(false);
    }
  }

  function mitad() {
    if (!puedePagar) return;

    setForm((actual) => ({
      ...actual,
      modo: "cobrado",
      monto: String(Number(saldo / 2).toFixed(2)),
    }));

    setTimeout(() => montoRef.current?.focus(), 50);
  }

  function limpiarMonto() {
    setPreview(null);
    setForm((actual) => ({
      ...actual,
      monto: "",
    }));

    setTimeout(() => montoRef.current?.focus(), 50);
  }

  async function registrarPago(e) {
    e.preventDefault();

    if (!puedePagar) {
      setError("Esta venta no puede recibir pagos en este estado o no tiene saldo pendiente");
      return;
    }

    const monto = Number(form.monto || 0);

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const simulacion = preview || (await simularTramoActual());

      if (!simulacion) {
        setError("No se pudo simular el tramo de pago");
        return;
      }

      await crearPago({
        origen_tipo: "venta",
        origen_id: Number(ventaId),
        medio_pago: form.medio_pago,
        monto_base: String(simulacion.monto_base_aplicado),
        cuotas: form.medio_pago === "tarjeta" ? Number(form.cuotas || 1) : null,
        entidad: form.entidad?.trim() || null,
        id_usuario: CURRENT_USER_ID,
        nota: form.nota?.trim() || null,
      });

      setForm((actual) => ({
        ...actual,
        monto: "",
        nota: "",
      }));
      setPreview(null);

      await refrescarTodo();

      setMensaje(
        Number(simulacion.saldo_restante_estimado || 0) === 0
          ? "Pago registrado. La venta quedó pagada."
          : `Pago registrado. Saldo restante estimado: ${formatMoney(
              simulacion.saldo_restante_estimado
            )}`
      );
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago. Verificá que la caja esté abierta.");
    } finally {
      setGuardando(false);
    }
  }

  async function handleRevertirPago(pago) {
    const motivo = window.prompt("Motivo de reversión del pago:");
    if (!motivo || motivo.trim().length < 3) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await revertirPago(pago.id, {
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await refrescarTodo();

      setMensaje(`Pago revertido. Saldo actual: ${formatMoney(resultado?.saldo_restante ?? 0)}`);
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section ref={panelRef} style={styles.card}>
      <PagoVentaResumen
        saldo={saldo}
        estadoVenta={estadoVenta}
        totalConfirmado={totalConfirmado}
        pagosConfirmados={pagosConfirmados}
        pagosRevertidos={pagosRevertidos}
        loading={loading}
        guardando={guardando}
        onRefrescar={cargarPagos}
      />

      {mensaje && <div style={styles.success}> {mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      {!puedePagar && (
        <div style={styles.note}>
          {ventaCerradaParaPago
            ? "Esta venta no puede recibir pagos directos. Si fue entregada con deuda, cobrá desde el módulo Deudas."
            : "Esta venta no tiene saldo pendiente para cobrar."}
        </div>
      )}

      <PagoVentaFormulario
        form={form}
        setForm={actualizarForm}
        puedePagar={puedePagar}
        guardando={guardando}
        simulando={simulando}
        montoRef={montoRef}
        onSubmit={registrarPago}
        onSaldar={saldar}
        onMitad={mitad}
        onLimpiar={limpiarMonto}
        planesTarjeta={planesTarjeta}
      />

      <PagoVentaPreview
        preview={preview}
        simulando={simulando}
        
      />

      <PagoVentaTabla
        titulo="Pagos confirmados"
        pagos={pagosConfirmados}
        guardando={guardando}
        onRevertir={handleRevertirPago}
        vacio="No hay pagos confirmados para esta venta."
      />

      {pagosRevertidos.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setMostrarRevertidos((v) => !v)}
            style={styles.secondaryButton}
          >
            {mostrarRevertidos
              ? "Ocultar revertidos"
              : `Mostrar revertidos (${pagosRevertidos.length})`}
          </button>

          {mostrarRevertidos && (
            <PagoVentaTabla
              titulo="Pagos revertidos"
              pagos={pagosRevertidos}
              guardando={guardando}
              onRevertir={handleRevertirPago}
              vacio="No hay pagos revertidos."
              soloHistorial
            />
          )}
        </div>
      )}
    </section>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

const styles = {
  card: {
    background: "white",
    borderRadius: 14,
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    padding: 16,
    marginBottom: 16,
  },
  success: {
    background: "#e8fff0",
    color: "#146c2e",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #b7ebc6",
    marginBottom: 12,
  },
  error: {
    background: "#fff1f0",
    color: "#b42318",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #f4c7c3",
    marginBottom: 12,
  },
  note: {
    background: "#fff8e1",
    color: "#8a6d00",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #f3dc97",
    marginBottom: 12,
  },
  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#111827",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
};