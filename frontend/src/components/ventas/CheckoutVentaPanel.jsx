import { useEffect, useMemo, useState } from "react";
import CheckoutResumenPago from "./checkout/CheckoutResumenPago";
import CheckoutAgregarPago from "./checkout/CheckoutAgregarPago";
import CheckoutPagosList from "./checkout/CheckoutPagosList";
import { simularVenta } from "../../services/ventasService";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export default function CheckoutVentaPanel({
  total,
  tipoPrecio,
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
  const [simulacion, setSimulacion] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const cantidadItems = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  }, [items]);

  const totalCalculado = Number(simulacion?.total_final ?? total ?? 0);

  const pagado = useMemo(() => {
    return pagosDraft.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
  }, [pagosDraft]);

  const pendiente = Math.max(0, totalCalculado - pagado);

  function buildPayloadSimulacion(pagos = pagosDraft) {
    return {
      tipo_precio: tipoPrecio || "minorista",
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: String(item.cantidad),
        id_bicicleta_serializada:
          item.modo_venta_serializada === "serializada" &&
          item.id_bicicleta_serializada
            ? Number(item.id_bicicleta_serializada)
            : null,
        precio_unitario_manual: item.precio_unitario_manual
          ? String(item.precio_unitario_manual)
          : null,
        bonificado: Boolean(item.bonificado),
        motivo_precio_manual: item.motivo_precio_manual || null,
        motivo_bonificacion: item.motivo_bonificacion || null,
      })),
      pagos: pagos.map((pago) => ({
        medio_pago: pago.medio_pago,
        monto: String(pago.monto),
        nota: pago.nota || null,
      })),
    };
  }

  async function recalcularSimulacion(pagos = pagosDraft) {
    if (items.length === 0) {
      setSimulacion(null);
      return null;
    }

    try {
      setSimulando(true);
      setErrorLocal("");

      const data = await simularVenta(buildPayloadSimulacion(pagos));
      setSimulacion(data);
      return data;
    } catch (err) {
      setErrorLocal(err.message || "No se pudo simular el total de la venta");
      return null;
    } finally {
      setSimulando(false);
    }
  }

  async function agregarPago() {
    const montoNumber = Number(monto);

    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      setErrorLocal("El monto debe ser mayor a cero");
      return;
    }

    if (montoNumber > pendiente) {
      setErrorLocal("El pago no puede superar el saldo pendiente");
      return;
    }

    const nuevosPagos = [
      ...pagosDraft,
      {
        temp_id: crypto.randomUUID(),
        medio_pago: medioPago,
        monto: montoNumber,
        nota: null,
      },
    ];

    setPagosDraft(nuevosPagos);
    setMonto("");
    setErrorLocal("");

    await recalcularSimulacion(nuevosPagos);
  }

  async function quitarPago(tempId) {
    const nuevosPagos = pagosDraft.filter((pago) => pago.temp_id !== tempId);
    setPagosDraft(nuevosPagos);
    await recalcularSimulacion(nuevosPagos);
  }

 async function cobrarTotal() {
  const data = await recalcularSimulacion([
    {
      temp_id: "tmp-total",
      medio_pago: medioPago,
      monto: total,
      nota: null,
    },
  ]);

  const totalBackend = Number(data?.total_final ?? total ?? 0);
  const montoParaSaldar = Math.max(0, totalBackend - pagado);

  setMonto(String(montoParaSaldar));
  setErrorLocal("");
}

  useEffect(() => {
    setPagosDraft([]);
    setMonto("");
    setErrorLocal("");
    setSimulacion(null);

    if (items.length > 0) {
      recalcularSimulacion([]);
    }
  }, [items, total, tipoPrecio]);

  function finalizar() {
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
        total={totalCalculado}
        pagado={pagado}
        pendiente={pendiente}
        cantidadItems={cantidadItems}
        formatMoney={formatMoney}
      />

      {simulacion && (
        <div style={styles.simulationBox}>
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(simulacion.subtotal_base)}</strong>
          </div>

          <div>
            <span>Descuento</span>
            <strong>{formatMoney(simulacion.descuento_total)}</strong>
          </div>

          <div>
            <span>Recargo</span>
            <strong>{formatMoney(simulacion.recargo_total)}</strong>
          </div>

          {simulando && <small>Recalculando...</small>}
        </div>
      )}

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
          disabled={guardando || items.length === 0 || simulando}
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
  simulationBox: {
    border: "1px solid #eaecf0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    display: "grid",
    gap: 6,
    background: "#f9fafb",
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