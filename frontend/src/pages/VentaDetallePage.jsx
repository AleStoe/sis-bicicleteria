import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import VentaHeader from "../components/ventas/detalle/VentaHeader";
import VentaResumenCards from "../components/ventas/detalle/VentaResumenCards";

import {
  obtenerVenta,
  anularVenta,
  entregarVenta,
  devolverVentaSerializada,
  devolverVenta,
  devolverItemsVenta,
} from "../services/ventasService";

import { listarPagosDeVenta } from "../services/pagosService";
import { CURRENT_USER_ID } from "../config/appConfig";
import { formatMoney } from "./VentasListPage";

export default function VentaDetallePage() {
  const { ventaId } = useParams();

  const [data, setData] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, [ventaId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la venta");
    } finally {
      setLoading(false);
    }
  }

  async function cargarVenta() {
    try {
      setError("");

      const [ventaData, pagosData] = await Promise.all([
        obtenerVenta(ventaId),
        listarPagosDeVenta(ventaId),
      ]);

      setData(ventaData);
      setPagos(pagosData || []);
    } catch (err) {
      setError(err.message || "No se pudo refrescar la venta");
    }
  }

  async function handleEntregarVenta() {
    const confirmar = window.confirm(
      "¿Confirmás la entrega de esta venta? Si tiene saldo pendiente, el backend exigirá permiso y creará deuda."
    );

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await entregarVenta(ventaId, { id_usuario: CURRENT_USER_ID });
      await cargarVenta();

      setMensaje("Venta entregada correctamente");
    } catch (err) {
      setError(err.message || "No se pudo entregar la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleAnularVenta() {
    const motivo = window.prompt("Motivo de anulación de la venta:");

    if (!motivo || motivo.trim().length < 3) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await anularVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(
        result.credito_generado
          ? `Venta anulada. Crédito generado: ${formatMoney(result.monto_credito)}`
          : "Venta anulada correctamente"
      );
    } catch (err) {
      setError(err.message || "No se pudo anular la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverVentaCompleta() {
    const motivo = window.prompt(
      "Motivo de devolución total de la venta. Se generará crédito al cliente, no devolución de efectivo:"
    );

    if (!motivo || motivo.trim().length < 3) return;

    const confirmar = window.confirm(
      "¿Confirmás la devolución TOTAL de esta venta? Se devolverá stock y se generará crédito al cliente."
    );

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(
        `Venta devuelta correctamente. Crédito generado: ${formatMoney(result.credito_generado)}`
      );
    } catch (err) {
      setError(err.message || "No se pudo devolver la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverItem(item) {
    const cantidadMaxima = Number(item.cantidad || 0);

    const cantidadRaw = window.prompt(
      `Cantidad a devolver del item #${item.id}. Máximo: ${cantidadMaxima}`
    );

    if (!cantidadRaw) return;

    const cantidad = Number(cantidadRaw);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setError("La cantidad a devolver debe ser mayor a 0");
      return;
    }

    if (cantidad > cantidadMaxima) {
      setError("La cantidad a devolver no puede superar la cantidad vendida");
      return;
    }

    const motivo = window.prompt(
      "Motivo de devolución parcial. Se generará crédito al cliente:"
    );

    if (!motivo || motivo.trim().length < 3) return;

    const confirmar = window.confirm(
      `¿Confirmás devolver ${cantidad} unidad(es) del item #${item.id}?`
    );

    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverItemsVenta(ventaId, {
        items: [
          {
            id_venta_item: Number(item.id),
            cantidad: String(cantidad),
          },
        ],
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(
        `Devolución parcial registrada. Crédito generado: ${formatMoney(result.credito_generado)}`
      );
    } catch (err) {
      setError(err.message || "No se pudo devolver el item");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverSerializada(item) {
    if (!item.id_bicicleta_serializada) return;

    const motivo = window.prompt("Motivo de devolución de bicicleta serializada:");

    if (!motivo || motivo.trim().length < 3) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const result = await devolverVentaSerializada(ventaId, {
        id_bicicleta_serializada: Number(item.id_bicicleta_serializada),
        motivo: motivo.trim(),
        id_usuario: CURRENT_USER_ID,
      });

      await cargarVenta();

      setMensaje(`Devolución registrada. ID devolución: ${result.devolucion_id}`);
    } catch (err) {
      setError(err.message || "No se pudo registrar la devolución serializada");
    } finally {
      setProcesando(false);
    }
  }

  const totalPagadoReal = useMemo(() => {
    return pagos
      .filter((pago) => pago.estado === "confirmado")
      .reduce((acc, pago) => acc + Number(pago.monto_total_cobrado || 0), 0);
  }, [pagos]);

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando detalle de venta...</p>;
  }

  if (!data) {
    return <p style={{ padding: "24px" }}>No se encontró la venta.</p>;
  }

  const { venta, items = [], situacion_financiera } = data;

  const totalFinal = Number(venta.total_final || 0);
  const saldoPendiente = Number(venta.saldo_pendiente || 0);
  const cubiertoNoPago = Math.max(
    totalFinal - totalPagadoReal - saldoPendiente,
    0
  );

  const estadosFinales = ["anulada", "devuelta", "devuelta_parcial"];
  const puedeAnular = ["creada", "pagada_parcial", "pagada_total"].includes(
    venta.estado
  );
  const puedeEntregar = !["entregada", ...estadosFinales].includes(venta.estado);
  const puedeDevolver = venta.estado === "entregada";

  const tieneDeuda = situacion_financiera?.tiene_deuda;
  const deuda = situacion_financiera?.deuda_abierta;

  return (
    <div style={pageStyle}>
      <VentaHeader
        venta={venta}
        procesando={procesando}
        onRefrescar={cargarVenta}
      />

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <VentaResumenCards
        venta={venta}
        totalFinal={totalFinal}
        totalPagadoReal={totalPagadoReal}
        cubiertoNoPago={cubiertoNoPago}
        saldoPendiente={saldoPendiente}
        formatMoney={formatMoney}
      />

      {cubiertoNoPago > 0 && (
        <div style={noteStyle}>
          Esta venta tiene monto cubierto sin pago real registrado. Probablemente
          corresponde a crédito aplicado u otro ajuste financiero.
        </div>
      )}

      <div style={topActionsStyle}>
        <Link to={`/ventas/${venta.id}/cobro`} style={primaryLinkActionStyle}>
          Cobrar venta
        </Link>
      </div>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Acciones operativas</h2>

        <div style={actionGridStyle}>
          <button
            onClick={handleEntregarVenta}
            disabled={!puedeEntregar || procesando}
            style={puedeEntregar ? primaryActionStyle : disabledActionStyle}
          >
            Entregar venta
          </button>

          <button
            onClick={handleAnularVenta}
            disabled={!puedeAnular || procesando}
            style={puedeAnular ? dangerActionStyle : disabledActionStyle}
          >
            Anular venta
          </button>

          <button
            onClick={handleDevolverVentaCompleta}
            disabled={!puedeDevolver || procesando}
            style={puedeDevolver ? warnActionStyle : disabledActionStyle}
          >
            Devolver venta completa
          </button>
        </div>

        <div style={smallNoteStyle}>
          Las devoluciones no revierten pagos: devuelven stock y generan crédito al cliente.
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Situación financiera</h2>

        {tieneDeuda ? (
          <div style={warningStyle}>
            <strong>Venta con deuda abierta.</strong>
            <div>ID deuda: #{deuda.id}</div>
            <div>Saldo actual: {formatMoney(deuda.saldo_actual)}</div>
            <div>Estado: {deuda.estado}</div>

            <Link to={`/deudas/${deuda.id}`} style={detailLinkStyle}>
              Ver deuda
            </Link>
          </div>
        ) : (
          <div style={successSoftStyle}>
            No hay deuda abierta asociada a esta venta.
          </div>
        )}
      </section>

      <section style={itemsCardStyle}>
        <div style={itemsHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Items vendidos</h2>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: "18px" }}>La venta no tiene items.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Serializada</th>
                  <th style={thStyle}>Cantidad</th>
                  <th style={thStyle}>Precio lista</th>
                  <th style={thStyle}>Precio final</th>
                  <th style={thStyle}>Subtotal</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>
                      <strong>{item.descripcion_snapshot}</strong>
                      <div style={mutedInlineStyle}>
                        Item #{item.id} · Variante #{item.id_variante}
                      </div>

                      {item.bonificado && (
                        <div style={bonusBadgeStyle}>
                          Bonificado: {item.motivo_bonificacion || "sin motivo"}
                        </div>
                      )}

                      {item.motivo_precio_manual && (
                        <div style={manualPriceBadgeStyle}>
                          Precio manual: {item.motivo_precio_manual}
                        </div>
                      )}
                    </td>

                    <td style={tdStyle}>
                      {item.id_bicicleta_serializada
                        ? `#${item.id_bicicleta_serializada}`
                        : "-"}
                    </td>

                    <td style={tdStyle}>
                      {Number(item.cantidad).toLocaleString("es-AR")}
                    </td>

                    <td style={tdStyle}>{formatMoney(item.precio_lista)}</td>
                    <td style={tdStyle}>{formatMoney(item.precio_final)}</td>
                    <td style={tdStyle}>
                      <strong>{formatMoney(item.subtotal)}</strong>
                    </td>

                    <td style={tdStyle}>
                      {venta.estado === "entregada" ? (
                        <div style={{ display: "grid", gap: "6px" }}>
                          <button
                            onClick={() => handleDevolverItem(item)}
                            disabled={procesando}
                          >
                            Devolver item
                          </button>

                          {item.id_bicicleta_serializada && (
                            <button
                              onClick={() => handleDevolverSerializada(item)}
                              disabled={procesando}
                            >
                              Devolver serializada
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={mutedInlineStyle}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const pageStyle = {
  padding: "24px",
  background: "#f6f7fb",
  minHeight: "100vh",
};

const topActionsStyle = {
  marginBottom: "16px",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
  marginBottom: "16px",
};

const cardTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "20px",
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};

const primaryActionStyle = {
  border: "none",
  background: "#12a15f",
  color: "white",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerActionStyle = {
  border: "1px solid #fecdca",
  background: "#fff1f0",
  color: "#b42318",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const warnActionStyle = {
  border: "1px solid #f3dc97",
  background: "#fff8e1",
  color: "#8a6d00",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const disabledActionStyle = {
  border: "1px solid #d0d5dd",
  background: "#f2f4f7",
  color: "#98a2b3",
  borderRadius: "10px",
  padding: "12px",
  fontWeight: 800,
  cursor: "not-allowed",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "16px",
};

const successStyle = {
  background: "#e8fff0",
  color: "#146c2e",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b7ebc6",
  marginBottom: "16px",
};

const successSoftStyle = {
  background: "#e8fff0",
  color: "#146c2e",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b7ebc6",
};

const warningStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f3dc97",
  display: "grid",
  gap: "6px",
};

const noteStyle = {
  background: "#fff8e1",
  color: "#8a6d00",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f3dc97",
  marginBottom: "16px",
};

const smallNoteStyle = {
  marginTop: "12px",
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "12px",
  borderRadius: "8px",
  color: "#344054",
};

const itemsCardStyle = {
  ...cardStyle,
  padding: 0,
  overflow: "hidden",
};

const itemsHeaderStyle = {
  padding: "16px 18px",
  borderBottom: "1px solid #eee",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "980px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "12px 10px",
  verticalAlign: "top",
};

const mutedInlineStyle = {
  color: "#667085",
  fontSize: "13px",
  marginTop: "4px",
};

const detailLinkStyle = {
  textDecoration: "none",
  fontWeight: 800,
  color: "#175cd3",
};

const primaryLinkActionStyle = {
  display: "inline-block",
  textDecoration: "none",
  textAlign: "center",
  border: "none",
  background: "#1f6feb",
  color: "white",
  borderRadius: "10px",
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const bonusBadgeStyle = {
  display: "inline-block",
  marginTop: "6px",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: 800,
};

const manualPriceBadgeStyle = {
  display: "inline-block",
  marginTop: "6px",
  background: "#fff8e1",
  color: "#8a6d00",
  border: "1px solid #f3dc97",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "12px",
  fontWeight: 800,
};