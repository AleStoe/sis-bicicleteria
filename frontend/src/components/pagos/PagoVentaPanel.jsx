import { useEffect, useMemo, useRef, useState } from "react";
import {
  crearPago,
  listarPagosDeVenta,
  revertirPago,
  simularTramoPagoVenta,
} from "../../services/pagosService";
import { listarTarjetaPlanes } from "../../services/reglasComercialesService";
import { useSession } from "../../context/SessionContext";
import PagoVentaResumen from "./PagoVentaResumen";
import PagoVentaFormulario from "./PagoVentaFormulario";
import PagoVentaPreview from "./PagoVentaPreview";
import PagoVentaTabla from "./PagoVentaTabla";
import { puedeRevertirPago } from "../../rules/ventaDetalleActionRules";

export default function PagoVentaPanel({
  ventaId,
  saldoPendiente = 0,
  estadoVenta = "",
  autoFocusPago = false,
  onPagoCambiado,
}) {
  const panelRef = useRef(null);
  const montoRef = useRef(null);
  const preservarPreviewSaldarRef = useRef(false);
  const autocompletarSaldoSeqRef = useRef(0);
  const [planesTarjeta, setPlanesTarjeta] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [mostrarRevertidos, setMostrarRevertidos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const { usuarioId, usuarioActual } = useSession();
  const [form, setForm] = useState({
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

  const planesMedioPago = useMemo(
    () => planesTarjeta.filter((plan) => plan.medio_pago === form.medio_pago),
    [form.medio_pago, planesTarjeta]
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
      const planes = (data || []).filter((plan) =>
        ["tarjeta", "mercadopago"].includes(plan.medio_pago)
      );

      setPlanesTarjeta(planes);
    } catch (err) {
      console.error(err);
    }
  }

  cargarPlanes();
}, []);

  useEffect(() => {
    if (!["tarjeta", "mercadopago"].includes(form.medio_pago)) {
      return;
    }

    const planActual = planesMedioPago.find(
      (plan) =>
        Number(plan.cuotas) === Number(form.cuotas)
        && (plan.entidad || "") === (form.entidad || "")
    );

    if (!planActual && planesMedioPago[0]) {
      setForm((actual) => ({
        ...actual,
        cuotas: planesMedioPago[0].cuotas,
        entidad: planesMedioPago[0].entidad || "",
      }));
    }
  }, [form.cuotas, form.entidad, form.medio_pago, planesMedioPago]);
  useEffect(() => {
    if (!autoFocusPago) return;

    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      montoRef.current?.focus();
    }, 150);
  }, [autoFocusPago]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      autocompletarSaldoSegunMedio();
    }, 150);

    return () => clearTimeout(timeout);
  }, [form.medio_pago, form.cuotas, form.entidad, ventaId, saldoPendiente]);

  useEffect(() => {
    if (
      preservarPreviewSaldarRef.current &&
      previewCoincideConFormulario(preview, form)
    ) {
      preservarPreviewSaldarRef.current = false;
      return undefined;
    }

    preservarPreviewSaldarRef.current = false;

    const timeout = setTimeout(() => {
      simularTramoActual();
    }, 300);

    return () => clearTimeout(timeout);
  }, [form.monto, ventaId, saldoPendiente]);

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
    setPreview(null);
    setMensaje("");
    setError("");
  }

  function buildPayloadSimulacion({ saldar = false } = {}) {
    const monto = Number(form.monto || 0);

    const base = {
      venta_id: Number(ventaId),
      medio_pago: form.medio_pago,
      cuotas: ["tarjeta", "mercadopago"].includes(form.medio_pago)
        ? Number(form.cuotas || 1)
        : null,
      entidad: form.entidad?.trim() || null,
    };

    if (saldar) {
      return {
        ...base,
        monto_base: String(saldo),
      };
    }

    return {
      ...base,
      monto_cobrado_objetivo: String(monto),
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

  function aplicarPreviewSaldar(data) {
    const montoSugerido = normalizarMontoPago(data.monto_total_cobrado || 0);

    preservarPreviewSaldarRef.current = true;
    setForm((actual) => ({
      ...actual,
      monto: String(montoSugerido),
    }));
    setPreview({
      ...data,
      monto_input_sugerido: String(montoSugerido),
    });
  }

  async function autocompletarSaldoSegunMedio({ enfocar = false } = {}) {
    if (!puedePagar) return;

    const seq = autocompletarSaldoSeqRef.current + 1;
    autocompletarSaldoSeqRef.current = seq;

    try {
      setSimulando(true);
      setError("");
      if (enfocar) setMensaje("");

      const data = await simularTramoPagoVenta(
        buildPayloadSimulacion({ saldar: true })
      );

      if (autocompletarSaldoSeqRef.current !== seq) return;

      aplicarPreviewSaldar(data);

      if (enfocar) {
        setTimeout(() => montoRef.current?.focus(), 50);
      }
    } catch (err) {
      if (autocompletarSaldoSeqRef.current === seq) {
        setPreview(null);
        setError(err.message || "No se pudo calcular el monto para saldar");
      }
    } finally {
      if (autocompletarSaldoSeqRef.current === seq) {
        setSimulando(false);
      }
    }
  }

  async function saldar() {
    await autocompletarSaldoSegunMedio({ enfocar: true });
  }

  function mitad() {
    if (!puedePagar) return;

    setForm((actual) => ({
      ...actual,
      monto: String(normalizarMontoPago(saldo / 2)),
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

    if (!usuarioId) {
      setError("Sesión requerida. Volvé a iniciar sesión para registrar el pago.");
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

      const simulacion = previewCoincideConFormulario(preview, form)
        ? preview
        : await simularTramoActual();

      if (!simulacion) {
        setError("No se pudo simular el tramo de pago");
        return;
      }

      await crearPago({
        origen_tipo: "venta",
        origen_id: Number(ventaId),
        medio_pago: form.medio_pago,
        monto_base: String(simulacion.monto_base_aplicado),
        cuotas: ["tarjeta", "mercadopago"].includes(form.medio_pago)
          ? Number(form.cuotas || 1)
          : null,
        entidad: form.entidad?.trim() || null,
        id_usuario: usuarioId,
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
    if (!puedeRevertirPago(pago, usuarioActual)) {
      setError("No tenés permiso para revertir este pago o el pago no está confirmado.");
      return;
    }

    if (!usuarioId) {
      setError("Sesión requerida. Volvé a iniciar sesión para revertir el pago.");
      return;
    }

    const motivo = window.prompt("Motivo de reversión del pago:");
    if (!motivo || motivo.trim().length < 3) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await revertirPago(pago.id, {
        motivo: motivo.trim(),
        id_usuario: usuarioId,
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
        planesTarjeta={planesMedioPago}
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
        canRevertirPago={(pago) => puedeRevertirPago(pago, usuarioActual)}
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
              canRevertirPago={(pago) => puedeRevertirPago(pago, usuarioActual)}
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

function normalizarMontoPago(value) {
  const numero = Number(value || 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero);
}

function previewCoincideConFormulario(preview, form) {
  if (!preview) return false;

  const montoPreview =
    preview.monto_input_sugerido ??
    String(normalizarMontoPago(preview.monto_total_cobrado || 0));

  if (String(montoPreview) !== String(form.monto || "")) return false;
  if (preview.medio_pago !== form.medio_pago) return false;

  if (form.medio_pago === "tarjeta") {
    const cuotasPreview = Number(preview.cuotas || 1);
    const cuotasForm = Number(form.cuotas || 1);
    const entidadPreview = preview.entidad || "";
    const entidadForm = form.entidad || "";

    return cuotasPreview === cuotasForm && entidadPreview === entidadForm;
  }

  return true;
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
