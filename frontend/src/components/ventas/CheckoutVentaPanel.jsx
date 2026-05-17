import { useEffect, useMemo, useState } from "react";
import CheckoutResumenPago from "./checkout/CheckoutResumenPago";
import CheckoutAgregarPago from "./checkout/CheckoutAgregarPago";
import CheckoutPagosList from "./checkout/CheckoutPagosList";
import { simularVenta } from "../../services/ventasService";
import CheckoutTotalesSimulacion from "./checkout/CheckoutTotalesSimulacion";

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

  const pagado = Number(
    simulacion?.total_pagos_cargados ?? 0
  );

  const pendiente = Number(
    simulacion?.saldo_estimado ?? totalCalculado
  );

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

  async function simularPagos(pagos = pagosDraft) {
    if (items.length === 0) {
      return null;
    }

    try {
      setSimulando(true);
      setErrorLocal("");

      return await simularVenta(buildPayloadSimulacion(pagos));
    } catch (err) {
      setErrorLocal(err.message || "No se pudo simular el total de la venta");
      return null;
    } finally {
      setSimulando(false);
    }
  }

  async function recalcularSimulacion(pagos = pagosDraft) {
    const data = await simularPagos(pagos);
    setSimulacion(data);
    return data;
  }

  async function agregarPago() {
    const montoNumber = Number(monto);

    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      setErrorLocal("El monto debe ser mayor a cero");
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

    const nuevaSimulacion = await simularPagos(nuevosPagos);

    if (!nuevaSimulacion) return;

    const totalFinal = Number(nuevaSimulacion.total_final || 0);
    const totalPagos = Number(nuevaSimulacion.total_pagos_cargados || 0);

    if (totalPagos > totalFinal) {
      setErrorLocal(
        `El pago supera el total final simulado. Total final: ${formatMoney(totalFinal)}`
      );
      return;
    }

    setPagosDraft(nuevosPagos);
    setSimulacion(nuevaSimulacion);
    setMonto("");
    setErrorLocal("");
  }

  async function quitarPago(tempId) {
    const nuevosPagos = pagosDraft.filter((pago) => pago.temp_id !== tempId);
    setPagosDraft(nuevosPagos);
    await recalcularSimulacion(nuevosPagos);
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

      <CheckoutTotalesSimulacion
        simulacion={simulacion}
        formatMoney={formatMoney}
        simulando={simulando}
      />

      <CheckoutAgregarPago
        medioPago={medioPago}
        setMedioPago={setMedioPago}
        monto={monto}
        setMonto={setMonto}
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