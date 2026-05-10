import { useMemo, useState } from "react";

const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "tarjeta", label: "Tarjeta" },
];

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
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Checkout</h3>
          <p style={styles.sub}>
            {cantidadItems} item{cantidadItems === 1 ? "" : "s"} en el carrito
          </p>
        </div>

        <strong style={styles.total}>{formatMoney(total)}</strong>
      </div>

      <div style={styles.statusGrid}>
        <div style={styles.paidBox}>
          <span>Pagado</span>
          <strong>{formatMoney(pagado)}</strong>
        </div>

        <div style={pendiente > 0 ? styles.pendingBox : styles.okBox}>
          <span>{pendiente > 0 ? "Pendiente" : "Venta saldada"}</span>
          <strong>{formatMoney(pendiente)}</strong>
        </div>
      </div>

      <div style={styles.payBox}>
        <div style={styles.payTitle}>Agregar pago</div>

        <div style={styles.paymentControls}>
            <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                style={styles.select}
            >
                {MEDIOS_PAGO.map((medio) => (
                <option key={medio.value} value={medio.value}>
                    {medio.label}
                </option>
                ))}
            </select>
        </div>

        <div style={styles.amountRow}>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Monto"
            style={styles.input}
          />

          <button type="button" onClick={cobrarTotal} style={styles.secondary}>
            Total
          </button>

          <button type="button" onClick={agregarPago} style={styles.addBtn}>
            Agregar
          </button>
        </div>

        {errorLocal && <div style={styles.localError}>{errorLocal}</div>}
      </div>

      <div style={styles.paymentsList}>
        <div style={styles.paymentsTitle}>Pagos cargados</div>

        {pagosDraft.length === 0 ? (
          <div style={styles.emptyPayments}>Sin pagos cargados.</div>
        ) : (
          pagosDraft.map((pago) => (
            <div key={pago.temp_id} style={styles.paymentRow}>
              <span>{renderMedio(pago.medio_pago)}</span>
              <strong>{formatMoney(pago.monto)}</strong>

              <button
                type="button"
                onClick={() => quitarPago(pago.temp_id)}
                style={styles.removePayment}
              >
                Quitar
              </button>
            </div>
          ))
        )}
      </div>

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

function renderMedio(medio) {
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    tarjeta: "Tarjeta",
  };

  return map[medio] || medio;
}

const styles = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    background: "#ffffff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
  },
  sub: {
    margin: "4px 0 0",
    color: "#667085",
    fontSize: 13,
  },
  total: {
    fontSize: 26,
    color: "#0b5bd3",
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  paidBox: {
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 4,
  },
  pendingBox: {
    background: "#fff1f0",
    border: "1px solid #fecdca",
    color: "#b42318",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 4,
  },
  okBox: {
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 4,
  },
  payBox: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    background: "#f9fafb",
    marginBottom: 12,
  },
  payTitle: {
    fontWeight: 900,
    marginBottom: 8,
    color: "#344054",
  },
  amountRow: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 100px",
    gap: 8,
  },
  input: {
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 15,
  },
  secondary: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  addBtn: {
    border: "none",
    background: "#0b5bd3",
    color: "white",
    borderRadius: 10,
    padding: "9px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  localError: {
    marginTop: 8,
    background: "#fff1f0",
    border: "1px solid #fecdca",
    color: "#b42318",
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
  },
  paymentsList: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  paymentsTitle: {
    fontWeight: 900,
    marginBottom: 8,
  },
  emptyPayments: {
    color: "#667085",
    fontSize: 13,
  },
  paymentRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 8,
    alignItems: "center",
    padding: "7px 0",
    borderTop: "1px solid #f2f4f7",
  },
  removePayment: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 8,
    padding: "5px 8px",
    fontWeight: 800,
    cursor: "pointer",
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
  paymentControls: {
  marginBottom: 10,
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