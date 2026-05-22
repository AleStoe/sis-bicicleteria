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
      />

      <CheckoutTotalesSimulacion
        simulacion={checkout.simulacionActiva}
        formatMoney={formatMoney}
        simulando={checkout.simulando}
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

      <label style={styles.checkRow}>
        <input
          type="checkbox"
          checked={checkout.entregarAhora}
          onChange={(e) => checkout.setEntregarAhora(e.target.checked)}
        />
        Entregar ahora
      </label>

      <div style={styles.actions}>
        <button type="button" onClick={onVaciar} style={styles.clear}>
          Vaciar
        </button>

        <button
          type="button"
          onClick={finalizar}
          disabled={guardando || items.length === 0 || checkout.simulando}
          style={styles.primary}
        >
          {guardando ? "Procesando..." : "Finalizar venta"}
        </button>
      </div>
    </section>
  );
}

const styles = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    background: "#ffffff",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#344054",
    marginBottom: 12,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: 10,
  },
  clear: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 12,
    padding: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  primary: {
    border: "none",
    background: "#12a15f",
    color: "white",
    borderRadius: 12,
    padding: 13,
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  },
};
