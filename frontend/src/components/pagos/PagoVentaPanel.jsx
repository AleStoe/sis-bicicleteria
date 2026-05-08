import { useEffect, useMemo, useRef, useState } from "react";
import { crearPago, listarPagosDeVenta, revertirPago } from "../../services/pagosService";
import { CURRENT_USER_ID } from "../../config/appConfig";

const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "tarjeta", label: "Tarjeta" },
];

export default function PagoVentaPanel({
  ventaId,
  saldoPendiente = 0,
  estadoVenta = "",
  autoFocusPago = false,
  onPagoCambiado,
}) {
  const panelRef = useRef(null);
  const montoRef = useRef(null);

  const [pagos, setPagos] = useState([]);
  const [mostrarRevertidos, setMostrarRevertidos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [form, setForm] = useState({
    medio_pago: "efectivo",
    monto: "",
    nota: "",
  });

  const saldo = Number(saldoPendiente || 0);
  const ventaCerradaParaPago = ["entregada", "anulada", "devuelta", "devuelta_parcial"].includes(
    estadoVenta
  );
  const puedePagar = !ventaCerradaParaPago && saldo > 0;

  useEffect(() => {
    if (ventaId) cargarPagos();
  }, [ventaId]);

  useEffect(() => {
    if (!autoFocusPago) return;

    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      montoRef.current?.focus();
    }, 150);
  }, [autoFocusPago]);

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

  function setMontoRapido(valor) {
    if (!puedePagar) return;

    setError("");
    setForm((actual) => ({
      ...actual,
      monto: String(Math.max(0, Number(valor || 0))),
    }));

    setTimeout(() => montoRef.current?.focus(), 50);
  }

  function limpiarMonto() {
    setForm((actual) => ({ ...actual, monto: "" }));
    setTimeout(() => montoRef.current?.focus(), 50);
  }

  async function registrarPago(e) {
    e.preventDefault();

    const monto = Number(form.monto);

    if (!puedePagar) {
      setError("Esta venta no puede recibir pagos en este estado o no tiene saldo pendiente");
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto del pago debe ser mayor a cero");
      return;
    }

    if (monto > saldo) {
      setError("El monto no puede superar el saldo pendiente de la venta");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await crearPago({
        origen_tipo: "venta",
        origen_id: Number(ventaId),
        medio_pago: form.medio_pago,
        monto: String(monto),
        id_usuario: CURRENT_USER_ID,
        nota: form.nota?.trim() || null,
      });

      setForm({ medio_pago: form.medio_pago, monto: "", nota: "" });
      await refrescarTodo();

      setMensaje(
        Number(resultado?.saldo_restante || 0) === 0
          ? "Pago registrado. La venta quedó pagada."
          : `Pago registrado. Saldo restante: ${formatMoney(resultado?.saldo_restante ?? 0)}`
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

      setMensaje(
        `Pago revertido. Saldo actual: ${formatMoney(resultado?.saldo_restante ?? 0)}`
      );
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section ref={panelRef} style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Cobro</h2>
          <p style={mutedStyle}>Registrá pagos reales contra caja. Permite pago mixto.</p>
        </div>

        <button onClick={cargarPagos} disabled={loading || guardando} style={secondaryBtnStyle}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div style={heroGridStyle}>
        <div style={saldoBoxStyle}>
          <span style={mutedSmallStyle}>Saldo a cobrar</span>
          <strong style={saldoValueStyle}>{formatMoney(saldo)}</strong>
          <span style={mutedSmallStyle}>Estado: {estadoVenta || "-"}</span>
        </div>

        <Metric label="Pagado confirmado" value={formatMoney(totalConfirmado)} tone="ok" />
        <Metric label="Pagos confirmados" value={pagosConfirmados.length} />
        <Metric label="Revertidos" value={pagosRevertidos.length} tone={pagosRevertidos.length ? "warn" : ""} />
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      {!puedePagar && (
        <div style={noteStyle}>
          {ventaCerradaParaPago
            ? "Esta venta no puede recibir pagos directos. Si fue entregada con deuda, cobrá desde el módulo Deudas."
            : "Esta venta no tiene saldo pendiente para cobrar."}
        </div>
      )}

      <form onSubmit={registrarPago} style={formStyle}>
        <div style={medioGridStyle}>
          {MEDIOS_PAGO.map((medio) => (
            <button
              key={medio.value}
              type="button"
              disabled={!puedePagar || guardando}
              onClick={() => setForm((p) => ({ ...p, medio_pago: medio.value }))}
              style={form.medio_pago === medio.value ? medioActiveStyle : medioStyle}
            >
              {medio.label}
            </button>
          ))}
        </div>

        <div style={quickGridStyle}>
          <button
            type="button"
            disabled={!puedePagar || guardando}
            onClick={() => setMontoRapido(saldo)}
            style={secondaryBtnStyle}
          >
            Cobrar total
          </button>
          <button
            type="button"
            disabled={!puedePagar || guardando}
            onClick={() => setMontoRapido(saldo / 2)}
            style={secondaryBtnStyle}
          >
            Mitad
          </button>
          <button
            type="button"
            disabled={!puedePagar || guardando}
            onClick={limpiarMonto}
            style={secondaryBtnStyle}
          >
            Limpiar
          </button>
        </div>

        <div style={inputGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Monto</span>
            <input
              ref={montoRef}
              type="number"
              min="0.01"
              step="0.01"
              max={saldo || undefined}
              value={form.monto}
              onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              style={inputStyle}
              disabled={!puedePagar || guardando}
              placeholder={puedePagar ? formatMoney(saldo) : ""}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Nota</span>
            <input
              value={form.nota}
              onChange={(e) => setForm((p) => ({ ...p, nota: e.target.value }))}
              placeholder="Opcional"
              style={inputStyle}
              disabled={!puedePagar || guardando}
            />
          </label>

          <button type="submit" disabled={!puedePagar || guardando} style={primaryBtnStyle}>
            {guardando ? "Registrando..." : "Registrar pago"}
          </button>
        </div>
      </form>

      <div style={hintStyle}>
        Para pago mixto: registrá un medio, luego cargá el saldo restante con otro.
      </div>

      <PagoTabla
        titulo="Pagos confirmados"
        pagos={pagosConfirmados}
        guardando={guardando}
        onRevertir={handleRevertirPago}
        vacio="No hay pagos confirmados para esta venta."
      />

      {pagosRevertidos.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <button
            type="button"
            onClick={() => setMostrarRevertidos((v) => !v)}
            style={secondaryBtnStyle}
          >
            {mostrarRevertidos
              ? "Ocultar revertidos"
              : `Mostrar revertidos (${pagosRevertidos.length})`}
          </button>

          {mostrarRevertidos && (
            <PagoTabla
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

function PagoTabla({ titulo, pagos, guardando, onRevertir, vacio, soloHistorial = false }) {
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={sectionHeaderStyle}>
        <h3 style={sectionTitleStyle}>{titulo}</h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Medio</th>
              <th style={thStyle}>Monto</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Nota</th>
              <th style={thStyle}>Acción</th>
            </tr>
          </thead>

          <tbody>
            {pagos.length === 0 ? (
              <tr>
                <td colSpan="7" style={tdStyle}>
                  {vacio}
                </td>
              </tr>
            ) : (
              pagos.map((pago) => (
                <tr key={pago.id}>
                  <td style={tdStyle}>#{pago.id}</td>
                  <td style={tdStyle}>{formatDate(pago.fecha)}</td>
                  <td style={tdStyle}>{renderMedio(pago.medio_pago)}</td>
                  <td style={tdStrongStyle}>{formatMoney(pago.monto_total_cobrado)}</td>
                  <td style={tdStyle}>
                    <EstadoPago estado={pago.estado} />
                  </td>
                  <td style={tdStyle}>{pago.nota || "-"}</td>
                  <td style={tdStyle}>
                    {!soloHistorial && pago.estado === "confirmado" ? (
                      <button
                        disabled={guardando}
                        onClick={() => onRevertir(pago)}
                        style={dangerBtnStyle}
                      >
                        Revertir
                      </button>
                    ) : (
                      <span style={mutedInlineStyle}>Sin acciones</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const style =
    tone === "ok" ? metricOkStyle : tone === "warn" ? metricWarnStyle : metricStyle;

  return (
    <div style={style}>
      <span style={mutedSmallStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EstadoPago({ estado }) {
  return (
    <span style={estado === "confirmado" ? estadoOkStyle : estadoMutedStyle}>
      {estado}
    </span>
  );
}

function renderMedio(medio) {
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    tarjeta: "Tarjeta",
  };

  return map[medio] || medio;
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

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
  marginBottom: "16px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "14px",
};

const titleStyle = { margin: 0, fontSize: "22px" };
const mutedStyle = { margin: "6px 0 0", color: "#667085", fontSize: "14px" };
const mutedSmallStyle = { color: "#667085", fontSize: "13px" };
const mutedInlineStyle = { color: "#667085", fontSize: "13px" };

const heroGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(230px, 1.4fr) repeat(3, minmax(150px, 1fr))",
  gap: "10px",
  marginBottom: "14px",
};

const saldoBoxStyle = {
  border: "1px solid #fecdca",
  borderRadius: "14px",
  padding: "14px",
  background: "#fff1f0",
  color: "#b42318",
  display: "grid",
  gap: "6px",
};

const saldoValueStyle = {
  fontSize: "30px",
  lineHeight: 1,
};

const metricStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "14px",
  display: "grid",
  gap: "6px",
  background: "#f9fafb",
  color: "#344054",
};

const metricOkStyle = {
  ...metricStyle,
  background: "#ecfdf3",
  borderColor: "#abefc6",
  color: "#067647",
};

const metricWarnStyle = {
  ...metricStyle,
  background: "#fff8e1",
  borderColor: "#f3dc97",
  color: "#8a6d00",
};

const formStyle = {
  display: "grid",
  gap: "12px",
  marginTop: "14px",
};

const medioGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "8px",
};

const medioStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#111827",
  borderRadius: "12px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const medioActiveStyle = {
  ...medioStyle,
  background: "#1f6feb",
  borderColor: "#1f6feb",
  color: "white",
};

const quickGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "8px",
};

const inputGridStyle = {
  display: "grid",
  gridTemplateColumns: "180px minmax(220px, 1fr) 180px",
  gap: "12px",
  alignItems: "end",
};

const fieldStyle = { display: "grid", gap: "6px" };
const labelStyle = { fontWeight: 700, fontSize: "14px" };

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  fontSize: "15px",
};

const primaryBtnStyle = {
  border: "none",
  background: "#12a15f",
  color: "white",
  borderRadius: "10px",
  padding: "11px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#111827",
  borderRadius: "10px",
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtnStyle = {
  border: "1px solid #fecdca",
  background: "#fff1f0",
  color: "#b42318",
  borderRadius: "8px",
  padding: "7px 10px",
  fontWeight: 700,
  cursor: "pointer",
};

const successStyle = {
  background: "#e8fff0",
  color: "#146c2e",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b7ebc6",
  marginBottom: "12px",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "12px",
};

const noteStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f3dc97",
  marginBottom: "12px",
};

const hintStyle = {
  background: "#f9fafb",
  color: "#475467",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "13px",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "8px",
};

const sectionTitleStyle = { margin: 0, fontSize: "17px" };

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "900px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
  borderTop: "1px solid #eee",
  verticalAlign: "top",
};

const tdStrongStyle = {
  ...tdStyle,
  fontWeight: 800,
};

const estadoOkStyle = {
  display: "inline-block",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: 800,
};

const estadoMutedStyle = {
  display: "inline-block",
  background: "#f2f4f7",
  color: "#475467",
  border: "1px solid #d0d5dd",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: 800,
};