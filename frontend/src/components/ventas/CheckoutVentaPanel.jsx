import CheckoutResumenPago from "./checkout/CheckoutResumenPago";
import CheckoutAgregarPago from "./checkout/CheckoutAgregarPago";
import CheckoutPagosList from "./checkout/CheckoutPagosList";
import CheckoutTotalesSimulacion from "./checkout/CheckoutTotalesSimulacion";
import useCheckoutVenta from "../../hooks/useCheckoutVenta";
import { formatMoney } from "../../utils/formatters";

export default function CheckoutVentaPanel({
  total,
  tipoPrecio,
  items,
  guardando,
  onVaciar,
  onFinalizar,
  onEstadoCheckoutChange,
  mostrarPagosCargados = true,
}) {
  const checkout = useCheckoutVenta({
    total,
    tipoPrecio,
    items,
    onEstadoCheckoutChange,
  });

  const ventaSaldada = Number(checkout.pendiente || 0) <= 0;
  const hayPagos = checkout.pagosDraft.length > 0;
  const entregaConSaldo = checkout.entregarAhora && !ventaSaldada;
  const montoCobroSugerido =
    checkout.previewSaldar?.monto_sugerido_para_saldar ?? null;

  function finalizar() {
    const payloadCheckout = checkout.finalizarCheckout();
    if (!payloadCheckout) return;

    onFinalizar?.(payloadCheckout);
  }

  return (
    <section style={styles.card}>
      <CheckoutResumenPago
        total={checkout.totalCalculado}
        pagado={checkout.pagado}
        pendiente={checkout.pendiente}
        cantidadItems={checkout.cantidadItems}
        formatMoney={formatMoney}
        montoCobroSugerido={montoCobroSugerido}
        medioPago={checkout.medioPago}
      />

      <CheckoutAgregarPago
        medioPago={checkout.medioPago}
        setMedioPago={checkout.setMedioPago}
        monto={checkout.monto}
        setMonto={checkout.setMonto}
        agregarPago={checkout.agregarPago}
        sugerirMontoParaSaldar={checkout.sugerirMontoParaSaldar}
        previewSaldar={checkout.previewSaldar}
        errorLocal={checkout.errorLocal}
        simulando={checkout.simulando}
        planesTarjeta={checkout.planesTarjeta}
        planTarjetaId={checkout.planTarjetaId}
        setPlanTarjetaId={checkout.setPlanTarjetaId}
      />

      {mostrarPagosCargados && (
        <CheckoutPagosList
          pagosDraft={checkout.pagosDraft}
          quitarPago={checkout.quitarPago}
        />
      )}

      <CheckoutTotalesSimulacion
        simulacion={checkout.simulacionActiva}
        formatMoney={formatMoney}
        simulando={checkout.simulando}
      />

      <div style={entregaConSaldo ? styles.debtWarning : styles.deliveryBox}>
        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={checkout.entregarAhora}
            onChange={(e) => checkout.setEntregarAhora(e.target.checked)}
          />
          <span>
            <strong>Entregar ahora</strong>
            <small>
              {entregaConSaldo
                ? "Se entregará con saldo pendiente y el backend formalizará deuda."
                : "Marcá esto si el cliente se lleva la mercadería ahora."}
            </small>
          </span>
        </label>
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={onVaciar} style={styles.clear}>
          Volver al carrito
        </button>

        <button
          type="button"
          onClick={finalizar}
          disabled={guardando || items.length === 0 || checkout.simulando}
          style={{
            ...styles.primary,
            ...(ventaSaldada ? styles.primaryOk : {}),
            ...(entregaConSaldo ? styles.primaryDebt : {}),
          }}
        >
          {getFinalizarLabel({
            guardando,
            ventaSaldada,
            entregaConSaldo,
            hayPagos,
          })}
        </button>
      </div>
    </section>
  );
}

function getFinalizarLabel({ guardando, ventaSaldada, entregaConSaldo, hayPagos }) {
  if (guardando) return "Procesando...";
  if (entregaConSaldo) return "Finalizar y entregar con deuda";
  if (ventaSaldada) return "Finalizar venta saldada";
  if (hayPagos) return "Finalizar venta parcial";
  return "Finalizar sin pagos";
}

const styles = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    background: "#ffffff",
  },
  deliveryBox: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  debtWarning: {
    border: "1px solid #fdba74",
    background: "#fff7ed",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  checkRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    color: "#344054",
    fontWeight: 900,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.7fr",
    gap: 10,
  },
  clear: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 14,
    padding: 14,
    fontWeight: 950,
    cursor: "pointer",
    color: "#334155",
  },
  primary: {
    border: "none",
    background: "#0f172a",
    color: "white",
    borderRadius: 14,
    padding: 14,
    fontWeight: 1000,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(15,23,42,0.18)",
  },
  primaryOk: {
    background: "#12a15f",
    boxShadow: "0 12px 24px rgba(18,161,95,0.22)",
  },
  primaryDebt: {
    background: "#f97316",
    boxShadow: "0 12px 24px rgba(249,115,22,0.24)",
  },
};
