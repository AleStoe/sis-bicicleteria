const VENTA_DRAFT_VERSION = 2;
const VENTA_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export function getVentaDraftStorageKey({ sucursalId, usuarioId }) {
  return `pos_venta_draft_sucursal_${sucursalId || "default"}_usuario_${usuarioId || "default"}`;
}

export function normalizarVentaDraft(draft) {
  if (!draft || !Array.isArray(draft.items)) return null;

  return {
    version: VENTA_DRAFT_VERSION,
    clienteId: draft.clienteId ? String(draft.clienteId) : "1",
    cliente: draft.cliente || null,
    tipoPrecio: draft.tipoPrecio || "minorista",
    items: draft.items,
    total: Number(draft.total || 0),
    observaciones: draft.observaciones || "",
    usarCredito:
      typeof draft.usarCredito === "boolean" ? draft.usarCredito : true,
    idUsuario: draft.idUsuario ?? null,
    idSucursal: draft.idSucursal ?? null,
    advertencias: {
      consumidorFinalConfirmado: Boolean(draft.advertencias?.consumidorFinalConfirmado),
    },
    checkout: {
      medioPago: draft.checkout?.medioPago || "efectivo",
      planTarjetaId: draft.checkout?.planTarjetaId
        ? String(draft.checkout.planTarjetaId)
        : "",
      monto: draft.checkout?.monto || "",
      entregarAhora: Boolean(draft.checkout?.entregarAhora),
      montoCreditoAAplicar: draft.checkout?.montoCreditoAAplicar || "",
      usarCredito:
        typeof draft.checkout?.usarCredito === "boolean"
          ? draft.checkout.usarCredito
          : undefined,
    },
  };
}

export function leerVentaDraftGuardado({ sucursalId, usuarioId }) {
  if (typeof window === "undefined") return null;

  const storageKey = getVentaDraftStorageKey({ sucursalId, usuarioId });

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const updatedAt = parsed?.updated_at ? Date.parse(parsed.updated_at) : null;

    if (updatedAt && Date.now() - updatedAt > VENTA_DRAFT_TTL_MS) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    if (!parsed || !Array.isArray(parsed.items)) return null;

    return normalizarVentaDraft(parsed);
  } catch (err) {
    console.warn("No se pudo recuperar el borrador POS guardado", err);
    return null;
  }
}

export function guardarVentaDraft({ sucursalId, usuarioId, draft }) {
  if (typeof window === "undefined") return;

  const storageKey = getVentaDraftStorageKey({ sucursalId, usuarioId });

  try {
    const draftNormalizado = normalizarVentaDraft(draft);

    if (!draftNormalizado?.items?.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...draftNormalizado,
        updated_at: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn("No se pudo guardar el borrador POS", err);
  }
}

export function borrarVentaDraftGuardado({ sucursalId, usuarioId }) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(
    getVentaDraftStorageKey({ sucursalId, usuarioId })
  );
}
