import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CheckoutVentaPanel from "../components/ventas/CheckoutVentaPanel";
import CheckoutClienteVentaCard from "../components/ventas/checkout/CheckoutClienteVentaCard";
import CheckoutResumenLateral from "../components/ventas/checkout/CheckoutResumenLateral";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { buildVentaPayload } from "../builders/ventasPayloadBuilder";
import { validarVentaAntesDeCrear } from "../validators/ventasValidator";
import {
  calcularResumenCheckout,
  getClienteNombre,
} from "../helpers/checkoutVentaHelper";

export default function NuevaVentaCheckoutPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const draft = state?.ventaDraft;
  const [checkoutEstado, setCheckoutEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const clienteNombre = useMemo(() => getClienteNombre(draft), [draft]);

  const resumenCheckout = useMemo(() => {
    return calcularResumenCheckout({ draft, checkoutEstado });
  }, [draft, checkoutEstado]);

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
      setGuardando(true);
      const resultado = await crearVenta(payload);

      if (entregar_ahora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: draft.idUsuario,
        });
      }

      navigate(`/ventas/${resultado.venta_id}`);
    } catch (err) {
      alert(err.message || "No se pudo finalizar la venta");
    } finally {
      setGuardando(false);
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
          <p style={styles.subtitle}>
            Checkout separado para evitar confusión entre armado y pago.
          </p>
        </div>
      </header>

      <main style={styles.layout}>
        <section style={styles.checkoutCard}>
          <CheckoutClienteVentaCard draft={draft} clienteNombre={clienteNombre} />

          <CheckoutVentaPanel
            total={draft.total}
            tipoPrecio={draft.tipoPrecio}
            items={draft.items}
            guardando={guardando}
            onVaciar={() => navigate("/ventas/nueva")}
            onFinalizar={finalizarCheckout}
            onEstadoCheckoutChange={setCheckoutEstado}
            mostrarPagosCargados={false}
          />
        </section>

        <CheckoutResumenLateral
          draft={draft}
          clienteNombre={clienteNombre}
          resumen={resumenCheckout}
          onQuitarPago={checkoutEstado?.quitarPago}
        />
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
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
