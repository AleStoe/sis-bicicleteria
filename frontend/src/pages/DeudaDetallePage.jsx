import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { obtenerDeuda, registrarPagoDeuda } from "../services/deudasService";
import DeudaHeader from "../components/deudas/detalle/DeudaHeader";
import DeudaResumenPanel from "../components/deudas/detalle/DeudaResumenPanel";
import DeudaPagoPanel from "../components/deudas/detalle/DeudaPagoPanel";
import DeudaMovimientosTable from "../components/deudas/detalle/DeudaMovimientosTable";
import DeudaOrigenPanel from "../components/deudas/detalle/DeudaOrigenPanel";

export default function DeudaDetallePage() {
  const { deudaId } = useParams();

  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [pagoForm, setPagoForm] = useState({
    monto: "",
    medio_pago: "efectivo",
    nota: "",
  });

  useEffect(() => {
    cargarDetalle();
  }, [deudaId]);

  async function cargarDetalle() {
    try {
      setLoading(true);
      setError("");

      const data = await obtenerDeuda(deudaId);
      setDetalle(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la deuda");
    } finally {
      setLoading(false);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();

    const monto = Number(pagoForm.monto);
    const saldo = Number(detalle?.deuda?.saldo_actual || 0);

    if (!monto || monto <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }

    if (monto > saldo) {
      setError("El pago no puede superar el saldo actual");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await registrarPagoDeuda(deudaId, {
        monto,
        medio_pago: pagoForm.medio_pago,
        nota: pagoForm.nota.trim() || null,
        id_usuario: 1,
      });

      setPagoForm({
        monto: "",
        medio_pago: "efectivo",
        nota: "",
      });

      await cargarDetalle();

      setMensaje("Pago registrado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando deuda...</p>;
  }

  if (!detalle) {
    return <p style={{ padding: "24px" }}>No se encontró la deuda.</p>;
  }

  const deuda = detalle.deuda;
  const movimientos = detalle.movimientos || [];

  return (
    <div style={pageStyle}>
      <DeudaHeader deuda={deuda} onRefresh={cargarDetalle} />

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={gridStyle}>
        <DeudaResumenPanel deuda={deuda} />

        <DeudaPagoPanel
          deuda={deuda}
          pagoForm={pagoForm}
          setPagoForm={setPagoForm}
          registrarPago={registrarPago}
          guardando={guardando}
        />
      </section>

      <DeudaOrigenPanel origen={detalle.origen} />

      <DeudaMovimientosTable movimientos={movimientos} />
    </div>
  );
}

const pageStyle = {
  padding: "24px",
  background: "#f6f7fb",
  minHeight: "100vh",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.4fr) minmax(280px, 0.8fr)",
  gap: "16px",
  alignItems: "start",
  marginBottom: "16px",
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