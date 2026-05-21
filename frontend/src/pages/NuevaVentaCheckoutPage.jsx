import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CheckoutVentaPanel from "../components/ventas/CheckoutVentaPanel";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { buildVentaPayload } from "../builders/ventasPayloadBuilder";
import { validarVentaAntesDeCrear } from "../validators/ventasValidator";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizarMedioPago(medio) {
  const labels = {
    efectivo: "💵 Efectivo",
    transferencia: "🏦 Transferencia",
    tarjeta: "💳 Tarjeta",
    mercadopago: "📲 MercadoPago",
  };

  return labels[medio] || medio || "Pago";
}

function describirPago(pago) {
  if (pago.medio_pago === "tarjeta") {
    const cuotas = pago.cuotas ? `${pago.cuotas} cuota(s)` : "tarjeta";
    return `${normalizarMedioPago(pago.medio_pago)} · ${cuotas}`;
  }

  return normalizarMedioPago(pago.medio_pago);
}

function getPagoAccent(pago) {
  if (Number(pago.recargo_aplicado || 0) > 0) return "#f59e0b";
  if (Number(pago.descuento_aplicado || 0) > 0) return "#22c55e";

  const colors = {
    efectivo: "#22c55e",
    transferencia: "#38bdf8",
    tarjeta: "#f59e0b",
    mercadopago: "#60a5fa",
  };

  return colors[pago.medio_pago] || "#94a3b8";
}

function getAjustePago(pago) {
  const recargo = Number(pago.recargo_aplicado || 0);
  const descuento = Number(pago.descuento_aplicado || 0);

  if (recargo > 0) {
    return { label: "Recargo", value: recargo, tone: "warning" };
  }

  if (descuento > 0) {
    return { label: "Descuento", value: descuento, tone: "success" };
  }

  return null;
}

function getNumeroCuadroItem(item) {
  return (
    item.numero_cuadro ||
    item.numero_cuadro_serializada ||
    item.bicicleta_serializada?.numero_cuadro ||
    item.serializada?.numero_cuadro ||
    item.bicicleta?.numero_cuadro ||
    null
  );
}

function itemRequiereCuadro(item) {
  return Boolean(
    item.id_bicicleta_serializada ||
      item.modo_venta_serializada === "serializada" ||
      item.serializable
  );
}

export default function NuevaVentaCheckoutPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const draft = state?.ventaDraft;
  const [checkoutEstado, setCheckoutEstado] = useState(null);

  if (!draft) {
    return (
      <div style={styles.page}>
        <section style={styles.emptyCard}>
          <h1 style={styles.emptyTitle}>No hay venta para cobrar</h1>
          <p style={styles.emptyText}>
            Armá el carrito desde Nueva Venta y después entrá al checkout.
          </p>
          <button type="button" onClick={() => navigate("/ventas/nueva")} style={styles.orangeBtn}>
            Volver a Nueva Venta
          </button>
        </section>
      </div>
    );
  }

  const clienteNombre = draft.cliente?.nombre || `Cliente #${draft.clienteId}`;
  const cantidadItems = draft.items.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  const pagosPanel = checkoutEstado?.pagosDraft || [];
  const baseCubierta = pagosPanel.reduce(
    (acc, pago) => acc + Number(pago.monto_base || 0),
    0
  );
  const clientePagoTotal = pagosPanel.reduce(
    (acc, pago) =>
      acc + Number(pago.monto_total_cobrado ?? pago.monto_base ?? 0),
    0
  );
  const saldoBasePendiente = checkoutEstado?.saldoBasePendiente ?? draft.total;
  const ventaSaldada = Number(saldoBasePendiente || 0) <= 0;

  async function finalizarCheckout({ pagos = [], entregar_ahora }) {
    const errorValidacion = validarVentaAntesDeCrear({
      clienteId: draft.clienteId,
      items: draft.items,
    });

    if (errorValidacion) {
      alert(errorValidacion);
      return;
    }

    const payload = buildVentaPayload({
      clienteId: draft.clienteId,
      sucursalId: draft.idSucursal,
      usuarioId: draft.idUsuario,
      tipoPrecio: draft.tipoPrecio,
      items: draft.items,
      pagos,
      observaciones: draft.observaciones,
      usarCredito: draft.usarCredito,
    });

    try {
      const resultado = await crearVenta(payload);

      if (entregar_ahora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: draft.idUsuario,
        });
      }

      navigate(`/ventas/${resultado.venta_id}`);
    } catch (err) {
      alert(err.message || "No se pudo finalizar la venta");
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button type="button" onClick={() => navigate(-1)} style={styles.backBtn}>
          ← Volver al carrito
        </button>

        <div>
          <h1 style={styles.title}>Cobro de venta</h1>
          <p style={styles.subtitle}>Checkout separado para evitar confusión entre armado y pago.</p>
        </div>
      </header>

      <main style={styles.layout}>
        <section style={styles.checkoutCard}>
          <div style={styles.clientPanel}>
            <div style={styles.avatar}>👤</div>
            <div>
              <span style={styles.panelLabel}>Cliente de la venta</span>
              <h2 style={styles.clientName}>{clienteNombre}</h2>
              <p style={styles.clientMeta}>
                {draft.tipoPrecio} · {cantidadItems} ítem(s) · precio lista {formatMoney(draft.total)}
              </p>
            </div>
          </div>

          <CheckoutVentaPanel
            total={draft.total}
            tipoPrecio={draft.tipoPrecio}
            items={draft.items}
            guardando={false}
            onVaciar={() => navigate("/ventas/nueva")}
            onFinalizar={finalizarCheckout}
            onEstadoCheckoutChange={setCheckoutEstado}
            mostrarPagosCargados={false}
          />
        </section>

        <aside style={styles.summaryPanel}>
          <span style={styles.panelLabelDark}>Resumen</span>
          <h2 style={styles.summaryClient}>{clienteNombre}</h2>

          <div style={styles.summaryBox}>
            <span>Precio lista</span>
            <strong>{formatMoney(draft.total)}</strong>
          </div>

          <div style={styles.metricsGrid}>
            <div style={styles.metricBox}>
              <span>Base cubierta</span>
              <strong>{formatMoney(baseCubierta)}</strong>
            </div>

            <div style={styles.metricBox}>
              <span>Cliente paga</span>
              <strong>{formatMoney(clientePagoTotal)}</strong>
            </div>
          </div>

          <div style={ventaSaldada ? styles.statusBoxOk : styles.statusBox}>
            <span>{ventaSaldada ? "Estado" : "Saldo base pendiente"}</span>
            <strong>{ventaSaldada ? "Venta saldada" : formatMoney(saldoBasePendiente)}</strong>
            <small>
              {ventaSaldada
                ? "La base de la venta está cubierta."
                : "No es “falta cobrar”: cambia según el medio elegido."}
            </small>
          </div>

          <div style={styles.paymentsBox}>
            <div style={styles.boxHeader}>
              <strong>Pagos cargados</strong>
              <span>{pagosPanel.length}</span>
            </div>

            {pagosPanel.length ? (
              <div style={styles.paymentsList}>
                {pagosPanel.map((pago) => {
                  const ajuste = getAjustePago(pago);

                  return (
                    <div
                      key={pago.temp_id}
                      style={{
                        ...styles.paymentRow,
                        borderLeft: `5px solid ${getPagoAccent(pago)}`,
                      }}
                    >
                      <div style={styles.paymentTitleRow}>
                        <strong>{describirPago(pago)}</strong>
                        <span>{formatMoney(pago.monto_total_cobrado ?? pago.monto_base)}</span>
                      </div>

                      <div style={styles.paymentDetails}>
                        <span>Base</span>
                        <strong>{formatMoney(pago.monto_base)}</strong>

                        <span>Cliente paga</span>
                        <strong>{formatMoney(pago.monto_total_cobrado ?? pago.monto_base)}</strong>
                      </div>

                      {ajuste && (
                        <div
                          style={
                            ajuste.tone === "warning"
                              ? styles.adjustmentWarning
                              : styles.adjustmentSuccess
                          }
                        >
                          <span>{ajuste.label}</span>
                          <strong>{formatMoney(ajuste.value)}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={styles.emptyPayments}>Todavía no cargaste pagos.</p>
            )}
          </div>

          <div style={styles.itemsBox}>
            <strong>Items</strong>
            {draft.items.slice(0, 6).map((item) => {
              const numeroCuadro = getNumeroCuadroItem(item);
              const requiereCuadro = itemRequiereCuadro(item);

              return (
                <div key={item.line_id} style={styles.itemCard}>
                  <div style={styles.itemRow}>
                    <span>{item.descripcion || item.nombre || "Producto"}</span>
                    <strong>x{item.cantidad}</strong>
                  </div>

                  {numeroCuadro ? (
                    <div style={styles.numeroCuadroOk}>
                      <span>Cuadro</span>
                      <strong>{numeroCuadro}</strong>
                    </div>
                  ) : requiereCuadro ? (
                    <div style={styles.numeroCuadroWarning}>
                      ⚠ Sin número de cuadro asignado
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: 20,
    background: "#f1f5f9",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
  },
  backBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "white",
    color: "#0f172a",
    fontWeight: 900,
    padding: "11px 14px",
    cursor: "pointer",
  },
  title: {
    margin: 0,
    fontSize: 30,
    color: "#0f172a",
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 18,
    alignItems: "start",
  },
  checkoutCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.08)",
  },
  clientPanel: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    background: "#f97316",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
  },
  panelLabel: {
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  clientName: {
    margin: "3px 0",
    color: "#0f172a",
    fontSize: 24,
  },
  clientMeta: {
    margin: 0,
    color: "#64748b",
    fontWeight: 700,
  },
  summaryPanel: {
    background: "#0f172a",
    color: "white",
    borderRadius: 22,
    padding: 18,
    position: "sticky",
    top: 20,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
  },
  panelLabelDark: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  summaryClient: {
    margin: "8px 0 16px",
    fontSize: 22,
  },
  summaryBox: {
    background: "#1e293b",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
  },
  metricsGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  metricBox: {
    background: "#111827",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 4,
  },
  statusBox: {
    marginTop: 12,
    background: "#172554",
    border: "1px solid rgba(96, 165, 250, 0.35)",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
  },
  statusBoxOk: {
    marginTop: 12,
    background: "rgba(22, 101, 52, 0.72)",
    border: "1px solid rgba(134, 239, 172, 0.35)",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 5,
  },
  paymentsBox: {
    marginTop: 14,
    background: "#1e293b",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  paymentsList: {
    display: "grid",
    gap: 10,
  },
  boxHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentRow: {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 9,
    minWidth: 0,
    overflow: "hidden",
  },
  paymentTitleRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },
  paymentDetails: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "4px 10px",
    color: "#cbd5e1",
    fontSize: 12,
  },
  adjustmentWarning: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    padding: "7px 9px",
    background: "rgba(245, 158, 11, 0.12)",
    color: "#fbbf24",
    fontWeight: 900,
    fontSize: 12,
  },
  adjustmentSuccess: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    padding: "7px 9px",
    background: "rgba(34, 197, 94, 0.12)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 12,
  },
  emptyPayments: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  itemsBox: {
    marginTop: 14,
    background: "#1e293b",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  itemCard: {
    borderRadius: 14,
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    padding: 10,
    display: "grid",
    gap: 8,
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 12,
  },
  numeroCuadroOk: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 10,
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(134, 239, 172, 0.22)",
    color: "#86efac",
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  numeroCuadroWarning: {
    borderRadius: 10,
    background: "rgba(245, 158, 11, 0.14)",
    border: "1px solid rgba(251, 191, 36, 0.25)",
    color: "#fbbf24",
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
  },
  emptyCard: {
    maxWidth: 520,
    margin: "80px auto",
    background: "white",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    padding: 28,
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    color: "#0f172a",
  },
  emptyText: {
    color: "#64748b",
  },
  orangeBtn: {
    border: "none",
    borderRadius: 14,
    background: "#f97316",
    color: "white",
    padding: "13px 18px",
    fontWeight: 1000,
    cursor: "pointer",
  },
};
