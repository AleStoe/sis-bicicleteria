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
  const ventaCerradaParaPago = ["entregada", "anulada"].includes(estadoVenta);
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

  const pagosConfirmados = useMemo(() => {
    return pagos.filter((pago) => pago.estado === "confirmado");
  }, [pagos]);

  const pagosRevertidos = useMemo(() => {
    return pagos.filter((pago) => pago.estado === "revertido");
  }, [pagos]);

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

      setForm({ medio_pago: "efectivo", monto: "", nota: "" });
      await refrescarTodo();

      setMensaje(
        Number(resultado?.saldo_restante || 0) === 0
          ? "Pago registrado correctamente. La venta quedó pagada."
          : `Pago registrado correctamente. Saldo restante: ${formatMoney(resultado?.saldo_restante ?? 0)}`
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
        `Pago revertido correctamente. Saldo actual: ${formatMoney(resultado?.saldo_restante ?? 0)}`
      );
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setGuardando(false);
    }
  }

  function completarSaldo() {
    if (!puedePagar) return;

    setError("");
    setForm((actual) => ({
      ...actual,
      monto: String(Number(saldo || 0)),
    }));

    montoRef.current?.focus();
  }

  return (
    <section ref={panelRef} style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Cobro de la venta</h2>
          <p style={mutedStyle}>
            Pagos reales registrados contra caja. Permite pago mixto cargando varios pagos.
          </p>
        </div>

        <button onClick={cargarPagos} disabled={loading || guardando} style={secondaryBtnStyle}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div style={metricsGridStyle}>
        <Metric label="Pagado confirmado" value={formatMoney(totalConfirmado)} tone="ok" />
        <Metric label="Saldo a cobrar" value={formatMoney(saldo)} tone={saldo > 0 ? "danger" : "ok"} />
        <Metric label="Estado venta" value={estadoVenta || "-"} />
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      {!puedePagar && (
        <div style={noteStyle}>
          {ventaCerradaParaPago
            ? "Esta venta no puede recibir pagos directos. Si fue entregada con deuda, el pago corresponde al módulo Deudas."
            : pagosConfirmados.length === 0
              ? "No hay saldo pendiente para cobrar. Si la venta figura pagada sin pagos reales, probablemente se cubrió con crédito."
              : "Esta venta no tiene saldo pendiente para cobrar."}
        </div>
      )}

      {pagosConfirmados.length === 0 && pagosRevertidos.length > 0 && (
        <div style={warningInfoStyle}>
          Todos los pagos registrados para esta venta fueron revertidos. Por eso no impactan el saldo actual.
        </div>
      )}

      <form onSubmit={registrarPago} style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Medio</span>
          <select
            value={form.medio_pago}
            onChange={(e) => setForm((p) => ({ ...p, medio_pago: e.target.value }))}
            style={inputStyle}
            disabled={!puedePagar || guardando}
          >
            {MEDIOS_PAGO.map((medio) => (
              <option key={medio.value} value={medio.value}>
                {medio.label}
              </option>
            ))}
          </select>
        </label>

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

        <div style={buttonGroupStyle}>
          <button
            type="button"
            disabled={!puedePagar || guardando}
            onClick={completarSaldo}
            style={secondaryBtnStyle}
          >
            Cobrar saldo
          </button>

          <button
            type="submit"
            disabled={!puedePagar || guardando}
            style={primaryBtnStyle}
          >
            {guardando ? "Registrando..." : "Registrar pago"}
          </button>
        </div>
      </form>

      <div style={hintStyle}>
        Ejemplo pago mixto: cargá efectivo por una parte, luego tarjeta por el saldo restante.
      </div>

      <PagoTabla
        titulo="Pagos confirmados"
        descripcion="Estos pagos impactan en el saldo de la venta."
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
              ? "Ocultar pagos revertidos"
              : `Mostrar pagos revertidos (${pagosRevertidos.length})`}
          </button>

          {mostrarRevertidos && (
            <PagoTabla
              titulo="Historial de pagos revertidos"
              descripcion="Estos pagos son históricos. No impactan el saldo vigente."
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

function PagoTabla({
  titulo,
  descripcion,
  pagos,
  guardando,
  onRevertir,
  vacio,
  soloHistorial = false,
}) {
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={sectionTitleStyle}>{titulo}</h3>
          <p style={mutedStyle}>{descripcion}</p>
        </div>
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
              <th style={thStyle}>Acciones</th>
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
                  <td style={tdStyle}>{formatMoney(pago.monto_total_cobrado)}</td>
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
    tone === "ok"
      ? metricOkStyle
      : tone === "danger"
        ? metricDangerStyle
        : metricStyle;

  return (
    <div style={style}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EstadoPago({ estado }) {
  const esConfirmado = estado === "confirmado";
  return (
    <span style={esConfirmado ? estadoOkStyle : estadoMutedStyle}>
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

const titleStyle = {
  margin: 0,
  fontSize: "22px",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "8px",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "17px",
};

const mutedStyle = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const mutedInlineStyle = {
  color: "#667085",
  fontSize: "13px",
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "10px",
  marginBottom: "14px",
};

const metricStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "12px",
  display: "grid",
  gap: "5px",
  background: "#f9fafb",
  color: "#344054",
};

const metricOkStyle = {
  ...metricStyle,
  background: "#ecfdf3",
  borderColor: "#abefc6",
  color: "#067647",
};

const metricDangerStyle = {
  ...metricStyle,
  background: "#fff1f0",
  borderColor: "#fecdca",
  color: "#b42318",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "180px 180px minmax(220px, 1fr) 270px",
  gap: "12px",
  alignItems: "end",
  marginTop: "14px",
};

const fieldStyle = {
  display: "grid",
  gap: "6px",
};

const labelStyle = {
  fontWeight: 700,
  fontSize: "14px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  fontSize: "15px",
};

const buttonGroupStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
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
};

const warningInfoStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f3dc97",
  marginBottom: "12px",
};

const hintStyle = {
  marginTop: "10px",
  background: "#f9fafb",
  color: "#475467",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "13px",
};

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