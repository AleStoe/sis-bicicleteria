import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CheckoutVentaPanel from "../components/ventas/CheckoutVentaPanel";
import CheckoutClienteVentaCard from "../components/ventas/checkout/CheckoutClienteVentaCard";
import CheckoutResumenLateral from "../components/ventas/checkout/CheckoutResumenLateral";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { listarDeudas } from "../services/deudasService";
import { buildEntregaVentaPayload, buildVentaPayload } from "../builders/ventasPayloadBuilder";
import { validarVentaAntesDeCrear } from "../validators/ventasValidator";
import { useToast } from "../hooks/useToast";
import { useSession } from "../context/SessionContext";
import {
  borrarVentaDraftGuardado,
  guardarVentaDraft,
  leerVentaDraftGuardado,
} from "../services/ventaDraftStore";
import {
  calcularResumenCheckout,
  getClienteNombre,
} from "../helpers/checkoutVentaHelper";
import {
  calcularDeudaAbiertaCliente,
  esConsumidorFinal,
} from "../helpers/ventaPreventiveWarnings";
import { Button, PageHeader } from "../components/ui";
import { ArrowLeft } from "lucide-react";
import { colors, radius, shadows, spacing, typography } from "../theme";

const MOBILE_BREAKPOINT = 760;

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
  const { usuarioId, sucursalId } = useSession();
  const [draft, setDraft] = useState(state?.ventaDraft || null);
  const [draftPendiente, setDraftPendiente] = useState(null);
  const [draftRevisado, setDraftRevisado] = useState(Boolean(state?.ventaDraft));
  const [checkoutEstado, setCheckoutEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [deudaCliente, setDeudaCliente] = useState({ tieneDeuda: false, saldo: 0 });
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

  useEffect(() => {
    if (draft) {
      setDraftRevisado(true);
      return;
    }

    const draftGuardado = leerVentaDraftGuardado({ sucursalId, usuarioId });

    if (draftGuardado?.items?.length) {
      setDraftPendiente(draftGuardado);
    }

    setDraftRevisado(true);
  }, [draft, sucursalId, usuarioId]);

  useEffect(() => {
    let cancelado = false;

    async function cargarDeudaCliente() {
      const clienteId = draft?.clienteId;

      if (!clienteId || esConsumidorFinal(clienteId, draft?.cliente)) {
        setDeudaCliente({ tieneDeuda: false, saldo: 0 });
        return;
      }

      try {
        const deudas = await listarDeudas({ id_cliente: clienteId, estado: "abierta" });
        if (cancelado) return;
        setDeudaCliente(calcularDeudaAbiertaCliente(deudas, clienteId));
      } catch (err) {
        if (!cancelado) {
          setDeudaCliente({ tieneDeuda: false, saldo: 0 });
        }
      }
    }

    cargarDeudaCliente();

    return () => {
      cancelado = true;
    };
  }, [draft?.clienteId, draft?.cliente]);

  function continuarDraftGuardado() {
    setDraft(draftPendiente);
    setDraftPendiente(null);
  }

  function descartarDraftGuardado() {
    borrarVentaDraftGuardado({ sucursalId, usuarioId });
    setDraftPendiente(null);
    navigate("/ventas/nueva", { replace: true });
  }

  function volverAlCarrito() {
    navigate("/ventas/nueva", {
      state: {
        restaurarVentaDraft: true,
        abrirCarrito: isMobile,
      },
    });
  }

  function guardarCheckoutDraft(checkoutDraft) {
    if (!draft?.items?.length || guardando) return;

    guardarVentaDraft({
      sucursalId: draft.idSucursal ?? sucursalId,
      usuarioId: draft.idUsuario ?? usuarioId,
      draft: {
        ...draft,
        checkout: checkoutDraft,
      },
    });
  }

  if (!draft && (!draftRevisado || draftPendiente)) {
    return (
      <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
        <ConfirmModal
          open={Boolean(draftPendiente)}
          title="Venta sin finalizar"
          message="Hay una venta sin finalizar. ¿Querés continuar o descartarla?"
          confirmText="Continuar"
          cancelText="Descartar"
          variant="info"
          onConfirm={continuarDraftGuardado}
          onCancel={descartarDraftGuardado}
        />
      </div>
    );
  }

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
      sucursalId: draft.idSucursal ?? sucursalId,
      usuarioId: draft.idUsuario ?? usuarioId,
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
        await entregarVenta(
          resultado.venta_id,
          buildEntregaVentaPayload({
            usuarioId: draft.idUsuario ?? usuarioId,
            items: draft.items,
          })
        );
      }

      borrarVentaDraftGuardado({
        sucursalId: draft.idSucursal ?? sucursalId,
        usuarioId: draft.idUsuario ?? usuarioId,
      });
      navigate(`/ventas/${resultado.venta_id}`, {
        state: { scrollToTop: true, ventaFinalizadaDesdeCheckout: true },
      });
    } catch (err) {
      toast.error(err.message || "No se pudo finalizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title="Cobrar venta"
        subtitle="Revisá cómo se cubre el saldo y finalizá la venta."
        eyebrow="Paso 2 de 2"
        actions={<Button type="button" variant="outline" onClick={volverAlCarrito}><ArrowLeft size={16} /> Carrito</Button>}
      />

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={{ ...styles.checkoutCard, ...(isMobile ? styles.checkoutCardMobile : {}) }}>
          <CheckoutClienteVentaCard draft={draft} clienteNombre={clienteNombre} />

          <CheckoutVentaPanel
            clienteId={draft.clienteId}
            cliente={draft.cliente}
            deudaCliente={deudaCliente}
            total={draft.total}
            tipoPrecio={draft.tipoPrecio}
            items={draft.items}
            guardando={guardando}
            onVaciar={volverAlCarrito}
            onFinalizar={finalizarCheckout}
            onEstadoCheckoutChange={setCheckoutEstado}
            initialCheckoutDraft={draft.checkout}
            onCheckoutDraftChange={guardarCheckoutDraft}
            mostrarPagosCargados={false}
            consumidorFinalConfirmado={Boolean(draft.advertencias?.consumidorFinalConfirmado)}
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
    display: "grid",
    gap: spacing.xl,
    color: colors.text,
    fontFamily: typography.fontFamily,
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
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    boxShadow: shadows.sm,
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
