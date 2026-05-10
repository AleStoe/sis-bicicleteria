import { useMemo, useState } from "react";
import CheckoutResumenPago from "./checkout/CheckoutResumenPago";
import CheckoutAgregarPago from "./checkout/CheckoutAgregarPago";
import CheckoutPagosList from "./checkout/CheckoutPagosList";
function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export default function CheckoutVentaPanel({
  total,
  items,
  guardando,
  onVaciar,
  onFinalizar,
}) {
  const [pagosDraft, setPagosDraft] = useState([]);
  const [medioPago, setMedioPago] = useState("efectivo");
  const [monto, setMonto] = useState("");
  const [entregarAhora, setEntregarAhora] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");

  const cantidadItems = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  }, [items]);

  const pagado = useMemo(() => {
    return pagosDraft.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
  }, [pagosDraft]);

  const pendiente = Math.max(0, Number(total || 0) - pagado);

  function agregarPago() {
    const montoNumber = Number(monto);

    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      setErrorLocal("El monto debe ser mayor a cero");
      return;
    }

    if (montoNumber > pendiente) {
      setErrorLocal("El pago no puede superar el saldo pendiente");
      return;
    }

    setPagosDraft((actual) => [
      ...actual,
      {
        temp_id: crypto.randomUUID(),
        medio_pago: medioPago,
        monto: montoNumber,
        nota: null,
      },
    ]);

    setMonto("");
    setErrorLocal("");
  }

  function quitarPago(tempId) {
    setPagosDraft((actual) => actual.filter((pago) => pago.temp_id !== tempId));
  }

  function cobrarTotal() {
    setMonto(String(pendiente || 0));
    setErrorLocal("");
  }

  function finalizar() {
    if (entregarAhora && pendiente > 0) {
      setErrorLocal(
        "No conviene entregar ahora si queda saldo pendiente. Primero cobrá el total o dejala pendiente."
      );
      return;
    }

    onFinalizar?.({
      pagos: pagosDraft.map((pago) => ({
        medio_pago: pago.medio_pago,
        monto: String(pago.monto),
        nota: pago.nota || null,
      })),
      entregar_ahora: entregarAhora,
    });
  }

  return (
    <section style={styles.card}>
      <CheckoutResumenPago
        total={total}
        pagado={pagado}
        pendiente={pendiente}
        cantidadItems={cantidadItems}
        formatMoney={formatMoney}
      />

      <CheckoutAgregarPago
        medioPago={medioPago}
        setMedioPago={setMedioPago}
        monto={monto}
        setMonto={setMonto}
        cobrarTotal={cobrarTotal}
        agregarPago={agregarPago}
        errorLocal={errorLocal}
      />

      <CheckoutPagosList
        pagosDraft={pagosDraft}
        quitarPago={quitarPago}
        formatMoney={formatMoney}
      />

      <label style={styles.checkRow}>
        <input
          type="checkbox"
          checked={entregarAhora}
          onChange={(e) => setEntregarAhora(e.target.checked)}
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
          disabled={guardando || items.length === 0}
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
 select: {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  padding: "10px 11px",
  fontSize: 14,
  background: "white",
},
};