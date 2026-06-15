import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CheckoutVentaPanel from "../components/ventas/CheckoutVentaPanel";
import CheckoutClienteVentaCard from "../components/ventas/checkout/CheckoutClienteVentaCard";
import CheckoutResumenLateral from "../components/ventas/checkout/CheckoutResumenLateral";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { buildVentaPayload } from "../builders/ventasPayloadBuilder";
import { validarVentaAntesDeCrear } from "../validators/ventasValidator";
import { useToast } from "../hooks/useToast";
import {
  calcularResumenCheckout,
  getClienteNombre,
} from "../helpers/checkoutVentaHelper";

const MOBILE_BREAKPOINT = 760;

function getVentaDraftStorageKey({ sucursalId, usuarioId }) {
  return `pos_venta_draft_sucursal_${sucursalId || "default"}_usuario_${usuarioId || "default"}`;
}

function borrarVentaDraftGuardado({ sucursalId, usuarioId }) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(
    getVentaDraftStorageKey({ sucursalId, usuarioId })
  );
}

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => setIsMobile(event.matches);

    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);

    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

export default function NuevaVentaCheckoutPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const draft = state?.ventaDraft;
  const [checkoutEstado, setCheckoutEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const toast = useToast();
  const isMobile = useIsMobile();

  const clienteNombre = useMemo(() => getClienteNombre(draft), [draft]);

  const resumenCheckout = useMemo(
    () =>
      calcularResumenCheckout({
        draft,
        checkoutEstado,
      }),
    [draft, checkoutEstado]
  );

  if (!draft) {
    return (
      <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
        <section style={{ ...styles.emptyCard, ...(isMobile ? styles.emptyCardMobile : {}) }}>
          <h1 style={styles.emptyTitle}>No hay venta para cobrar</h1>
          <p style={styles.emptyText}>
            Armá el carrito desde Nueva Venta y después entrá al cobro.
          </p>
          <button
            type="button"
            onClick={() => navigate("/ventas/nueva")}
            style={styles.orangeBtn}
          >
            Volver a Nueva Venta
          </button>
        </section>
      </div>
    );
  }

  async function finalizarCheckout(payloadCheckout) {
    const { pagos = [], entregar_ahora } = payloadCheckout;

    const errorValidacion = validarVentaAntesDeCrear({
      clienteId: draft.clienteId,
      items: draft.items,
    });

    if (errorValidacion) {
      toast.error(errorValidacion);
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
      usarCredito: payloadCheckout?.usar_credito,
      montoCreditoAAplicar: payloadCheckout?.monto_credito_a_aplicar,
    });

    try {
      setGuardando(true);
      const resultado = await crearVenta(payload);

      if (entregar_ahora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: draft.idUsuario,
        });
      }

      borrarVentaDraftGuardado({
        sucursalId: draft.idSucursal,
        usuarioId: draft.idUsuario,
      });
      navigate(`/ventas/${resultado.venta_id}`);
    } catch (err) {
      toast.error(err.message || "No se pudo finalizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
        <button type="button" onClick={() => navigate(-1)} style={styles.backBtn}>
          ← Carrito
        </button>

        <div style={styles.headerText}>
          <span style={styles.kicker}>Paso 2 de 2</span>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>
            Cobrar venta
          </h1>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
            Elegí el medio de pago, tocá “Completar saldo” y cargá el pago.
          </p>
        </div>
      </header>

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={{ ...styles.checkoutCard, ...(isMobile ? styles.checkoutCardMobile : {}) }}>
          <CheckoutClienteVentaCard draft={draft} clienteNombre={clienteNombre} />

          <CheckoutVentaPanel
            clienteId={draft.clienteId}
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

        <div style={isMobile ? styles.resumenMobile : undefined}>
          <CheckoutResumenLateral
            draft={draft}
            clienteNombre={clienteNombre}
            resumen={resumenCheckout}
            onQuitarPago={checkoutEstado?.quitarPago}
          />
        </div>
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
  headerText: {
    minWidth: 0,
  },
  kicker: {
    display: "block",
    color: "#f97316",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 3,
  },
  backBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "white",
    color: "#0f172a",
    fontWeight: 950,
    padding: "12px 15px",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
  },
  title: {
    margin: 0,
    fontSize: 32,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 750,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(520px, 1fr) 380px",
    gap: 18,
    alignItems: "start",
  },
  checkoutCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.08)",
    minWidth: 0,
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
  pageMobile: {
    padding: 10,
    overflowX: "hidden",
  },
  headerMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    marginBottom: 12,
  },
  titleMobile: {
    fontSize: 25,
  },
  subtitleMobile: {
    fontSize: 13,
    lineHeight: 1.35,
  },
  layoutMobile: {
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  checkoutCardMobile: {
    padding: 12,
    borderRadius: 18,
  },
  resumenMobile: {
    minWidth: 0,
  },
  emptyCardMobile: {
    margin: "32px auto",
    padding: 18,
  },
};
