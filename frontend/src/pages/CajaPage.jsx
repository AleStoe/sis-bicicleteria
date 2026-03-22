import { useEffect, useMemo, useState } from "react";
import {
  abrirCaja,
  cerrarCaja,
  obtenerCajaAbierta,
  obtenerCajaDetalle,
  registrarEgresoCaja,
  registrarAjusteCaja,
} from "../services/cajaService";
import { formatCurrency } from "../utils/currency";

const ID_SUCURSAL = 1;
const ID_USUARIO = 1;

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [montoApertura, setMontoApertura] = useState("");
  const [montoReal, setMontoReal] = useState("");
  const [egreso, setEgreso] = useState({ monto: "", nota: "" });
  const [procesando, setProcesando] = useState(false);
  const [ajuste, setAjuste] = useState({  monto: "",  direccion: "positivo",  nota: "",});
  const puedeRegistrarAjuste =
    !procesando &&
    Number(ajuste.monto || 0) > 0 &&
    ajuste.nota.trim().length >= 3;
  useEffect(() => {
    cargarCaja();
  }, []);
    async function handleRegistrarAjuste(e) {
      e.preventDefault();
      if (!detalle?.caja?.id) return;

      setError("");
      setMensaje("");

      const monto = Number(ajuste.monto || 0);
      const nota = ajuste.nota.trim();

      if (monto <= 0) {
        setError("El monto del ajuste debe ser mayor a 0");
        return;
      }

      if (nota.length < 3) {
        setError("La nota debe tener al menos 3 caracteres");
        return;
      }

      try {
        setProcesando(true);

        await registrarAjusteCaja(detalle.caja.id, {
          monto,
          direccion: ajuste.direccion,
          nota,
          id_usuario: ID_USUARIO,
        });

        setMensaje(
          `Ajuste ${
            ajuste.direccion === "positivo" ? "positivo" : "negativo"
          } registrado: ${formatCurrency(monto)}`
        );

        setAjuste({ monto: "", direccion: "positivo", nota: "" });

        await cargarCaja();
      } catch (err) {
        setError(err.message || "No se pudo registrar el ajuste");
      } finally {
        setProcesando(false);
      }
    }
async function cargarCaja() {
  try {
    setLoading(true);
    setError("");
    setMensaje("");

    const cajaAbierta = await obtenerCajaAbierta(ID_SUCURSAL);
    const detalleCaja = await obtenerCajaDetalle(cajaAbierta.caja.id);

    setDetalle(detalleCaja);
    setMontoReal(String(detalleCaja.efectivo_teorico ?? ""));
  } catch (err) {
    const msg = err.message || "";

    if (msg.toLowerCase().includes("no hay caja abierta")) {
      setDetalle(null);
      return;
    }

    setDetalle(null);
    setError(msg || "No se pudo cargar la caja");
  } finally {
    setLoading(false);
  }
}

  async function handleAbrirCaja(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    const apertura = Number(montoApertura || 0);
    if (apertura < 0) {
      setError("El monto de apertura no puede ser negativo");
      return;
    }

    try {
      setProcesando(true);
      await abrirCaja({
        id_sucursal: ID_SUCURSAL,
        monto_apertura: apertura,
        id_usuario: ID_USUARIO,
      });
      setMensaje("Caja abierta correctamente");
      setMontoApertura("");
      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo abrir la caja");
    } finally {
      setProcesando(false);
    }
  }

  async function handleRegistrarEgreso(e) {
    e.preventDefault();
    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const monto = Number(egreso.monto || 0);
    const nota = egreso.nota.trim();

    if (monto <= 0) {
      setError("El monto del egreso debe ser mayor a 0");
      return;
    }

    if (nota.length < 3) {
      setError("La nota debe tener al menos 3 caracteres");
      return;
    }

    try {
      setProcesando(true);
      await registrarEgresoCaja(detalle.caja.id, {
        monto,
        nota,
        id_usuario: ID_USUARIO,
      });
      setMensaje(`Egreso registrado: ${formatCurrency(monto)}`);
      setEgreso({ monto: "", nota: "" });
      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo registrar el egreso");
    } finally {
      setProcesando(false);
    }
  }

  async function handleCerrarCaja(e) {
    e.preventDefault();
    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const cierreReal = Number(montoReal || 0);
    if (cierreReal < 0) {
      setError("El monto real no puede ser negativo");
      return;
    }

    const confirmado = window.confirm("¿Seguro que querés cerrar la caja?");
    if (!confirmado) return;

    try {
      setProcesando(true);
      const resp = await cerrarCaja(detalle.caja.id, {
        monto_cierre_real: cierreReal,
        id_usuario: ID_USUARIO,
      });

      setMensaje(
        `Caja cerrada. Diferencia: ${formatCurrency(resp.diferencia)}`
      );
      setDetalle(null);
      setMontoReal("");
    } catch (err) {
      setError(err.message || "No se pudo cerrar la caja");
    } finally {
      setProcesando(false);
    }
  }

  const totales = useMemo(
    () =>
      detalle?.totales_por_submedio ?? {
        efectivo: 0,
        transferencia: 0,
        mercadopago: 0,
        tarjeta: 0,
      },
    [detalle]
  );

  const movimientos = detalle?.movimientos ?? [];
  const puedeRegistrarEgreso =
    !procesando &&
    Number(egreso.monto || 0) > 0 &&
    egreso.nota.trim().length >= 3;

  const puedeAbrirCaja =
    !procesando && montoApertura !== "" && Number(montoApertura) >= 0;

  const puedeCerrarCaja =
    !procesando && montoReal !== "" && Number(montoReal) >= 0;

  if (loading) {
    return <div style={{ padding: "24px" }}>Cargando caja...</div>;
  }

  return (
    <div style={{ padding: "24px", background: "#f6f7fb", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h1 style={{ margin: 0 }}>Caja</h1>
        <button onClick={cargarCaja} disabled={procesando}>
          Refrescar
        </button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {mensaje ? <Alert type="success" message={mensaje} /> : null}

      {!detalle ? (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Abrir caja</h2>
          <p>No hay caja abierta para la sucursal actual.</p>

          <form
            onSubmit={handleAbrirCaja}
            style={{ display: "grid", gap: "12px", maxWidth: "360px" }}
          >
            <label>
              Monto de apertura
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                style={inputStyle}
                required
              />
            </label>

            <button disabled={!puedeAbrirCaja}>
              {procesando ? "Abriendo..." : "Abrir caja"}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <Info label="Estado" value={detalle.caja.estado} />
            <Info label="Fecha" value={detalle.caja.fecha} />
            <Info
              label="Apertura"
              value={formatCurrency(detalle.caja.monto_apertura)}
            />
            <Info
              label="Efectivo teórico"
              value={formatCurrency(detalle.efectivo_teorico)}
              emphasize
            />
            <Info label="Caja" value={`#${detalle.caja.id}`} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <Info
              label="Neto de movimientos en efectivo"
              value={formatCurrency(totales.efectivo)}
              tone={Number(totales.efectivo) < 0 ? "danger" : "success"}
            />
            <Info
              label="Transferencia"
              value={formatCurrency(totales.transferencia)}
            />
            <Info
              label="Mercado Pago"
              value={formatCurrency(totales.mercadopago)}
            />
            <Info label="Tarjeta" value={formatCurrency(totales.tarjeta)} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Registrar egreso</h2>

              <form
                onSubmit={handleRegistrarEgreso}
                style={{ display: "grid", gap: "12px" }}
              >
                <label>
                  Monto
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={egreso.monto}
                    onChange={(e) =>
                      setEgreso((prev) => ({ ...prev, monto: e.target.value }))
                    }
                    style={inputStyle}
                    required
                  />
                </label>

                <label>
                  Nota
                  <input
                    type="text"
                    value={egreso.nota}
                    onChange={(e) =>
                      setEgreso((prev) => ({ ...prev, nota: e.target.value }))
                    }
                    style={inputStyle}
                    required
                  />
                </label>

                <button disabled={!puedeRegistrarEgreso}>
                  {procesando ? "Guardando..." : "Registrar egreso"}
                </button>
              </form>
            </div>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Ajuste de caja</h2>

              <form onSubmit={handleRegistrarAjuste} style={{ display: "grid", gap: "12px" }}>
                
                <label>
                  Tipo de ajuste
                  <select
                    value={ajuste.direccion}
                    onChange={(e) =>
                      setAjuste((prev) => ({ ...prev, direccion: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="positivo">Ingreso (suma dinero)</option>
                    <option value="negativo">Egreso (resta dinero)</option>
                  </select>
                </label>

                <label>
                  Monto
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ajuste.monto}
                    onChange={(e) =>
                      setAjuste((prev) => ({ ...prev, monto: e.target.value }))
                    }
                    style={inputStyle}
                    required
                  />
                </label>

                <label>
                  Nota
                  <input
                    type="text"
                    value={ajuste.nota}
                    onChange={(e) =>
                      setAjuste((prev) => ({ ...prev, nota: e.target.value }))
                    }
                    style={inputStyle}
                    required
                  />
                </label>

                <button disabled={!puedeRegistrarAjuste}>
                  {procesando ? "Guardando..." : "Registrar ajuste"}
                </button>
              </form>
            </div>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Cerrar caja</h2>

              <form
                onSubmit={handleCerrarCaja}
                style={{ display: "grid", gap: "12px" }}
              >
                <label>
                  Dinero contado en efectivo
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoReal}
                    onChange={(e) => setMontoReal(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </label>

                <div style={{ color: "#555" }}>
                  Teórico efectivo:{" "}
                  <strong>{formatCurrency(detalle.efectivo_teorico)}</strong>
                </div>

                <button disabled={!puedeCerrarCaja}>
                  {procesando ? "Cerrando..." : "Cerrar caja"}
                </button>
              </form>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Movimientos</h2>

            {movimientos.length === 0 ? (
              <p>Sin movimientos registrados.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  cellPadding="10"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead style={{ background: "#f9fafb" }}>
                    <tr>
                      <th style={thStyle}>Fecha</th>
                      <th style={thStyle}>Tipo</th>
                      <th style={thStyle}>Submedio</th>
                      <th style={thStyle}>Monto</th>
                      <th style={thStyle}>Origen</th>
                      <th style={thStyle}>Usuario</th>
                      <th style={thStyle}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((mov) => (
                      <tr key={mov.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={tdStyle}>
                          {new Date(mov.fecha).toLocaleString("es-AR")}
                        </td>
                        <td style={tdStyle}>
                          {mov.tipo_movimiento === "ajuste"
                            ? `ajuste (${mov.direccion_ajuste})`
                            : mov.tipo_movimiento}
                        </td>
                        <td style={tdStyle}>{mov.submedio || "-"}</td>
                        <td
                          style={{
                            ...tdStyle,
                            color:
                              mov.tipo_movimiento === "egreso"
                                ? "#b42318"
                                : mov.tipo_movimiento === "ajuste"
                                ? mov.direccion_ajuste === "negativo"
                                  ? "#b42318"
                                  : "#027a48"
                                : "#027a48",
                            fontWeight: 600,
                          }}
                        >
                          {formatCurrency(mov.monto)}
                        </td>
                        <td style={tdStyle}>
                          {mov.origen_tipo
                            ? `${mov.origen_tipo}${
                                mov.origen_id ? ` #${mov.origen_id}` : ""
                              }`
                            : "-"}
                        </td>
                        <td style={tdStyle}>{mov.id_usuario ? `Usuario #${mov.id_usuario}` : "-"}</td>
                        <td style={tdStyle}>{mov.nota || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Info({ label, value, tone = "default", emphasize = false }) {
  const color =
    tone === "danger"
      ? "#b42318"
      : tone === "success"
      ? "#027a48"
      : "#111827";

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        padding: "16px",
      }}
    >
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: emphasize ? 700 : 600,
          fontSize: emphasize ? "20px" : "16px",
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Alert({ type, message }) {
  const isError = type === "error";
  return (
    <div
      style={{
        background: isError ? "#fff1f0" : "#ecfdf3",
        color: isError ? "#b42318" : "#027a48",
        padding: "12px",
        borderRadius: "10px",
        border: `1px solid ${isError ? "#f4c7c3" : "#abefc6"}`,
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "18px",
};

const inputStyle = {
  width: "100%",
  marginTop: "6px",
  padding: "10px",
  boxSizing: "border-box",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "10px",
};