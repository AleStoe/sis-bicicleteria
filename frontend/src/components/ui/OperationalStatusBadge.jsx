const TONES = {
  success: { background: "#ecfdf5", color: "#047857", borderColor: "#bbf7d0" },
  info: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" },
  warning: { background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" },
  danger: { background: "#fff1f0", color: "#b42318", borderColor: "#fecaca" },
  orange: { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" },
  violet: { background: "#f5f3ff", color: "#6d28d9", borderColor: "#ddd6fe" },
  muted: { background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" },
  dark: { background: "#f1f5f9", color: "#0f172a", borderColor: "#cbd5e1" },
};

const STATUS_CONFIG = {
  venta: {
    creada: { label: "Creada", tone: "info" },
    pagada_parcial: { label: "Pago parcial", tone: "warning" },
    pagada_total: { label: "Pagada", tone: "success" },
    entregada: { label: "Entregada", tone: "success" },
    devuelta_parcial: { label: "Dev. parcial", tone: "orange" },
    devuelta: { label: "Devuelta", tone: "danger" },
    anulada: { label: "Anulada", tone: "danger" },
  },
  taller: {
    ingresada: { label: "Ingresada", tone: "info" },
    presupuestada: { label: "Presupuestada", tone: "violet" },
    esperando_aprobacion: { label: "Esperando aprobacion", tone: "warning" },
    esperando_repuestos: { label: "Esperando repuestos", tone: "warning" },
    en_reparacion: { label: "En reparacion", tone: "orange" },
    terminada: { label: "Terminada", tone: "info" },
    facturada: { label: "Facturada", tone: "success" },
    lista_para_retirar: { label: "Lista para retirar", tone: "success" },
    retirada: { label: "Retirada", tone: "muted" },
    cancelada: { label: "Cancelada", tone: "danger" },
  },
  reserva: {
    activa: { label: "Activa", tone: "success" },
    vencida: { label: "Vencida", tone: "danger" },
    cancelada: { label: "Cancelada", tone: "danger" },
    convertida_en_venta: { label: "Convertida", tone: "info" },
  },
  deuda: {
    abierta: { label: "Abierta", tone: "warning" },
    cerrada: { label: "Cerrada", tone: "success" },
    cancelada: { label: "Cancelada", tone: "danger" },
  },
  pago: {
    confirmado: { label: "Confirmado", tone: "success" },
    revertido: { label: "Revertido", tone: "danger" },
    devuelto_externo: { label: "Devuelto externo", tone: "warning" },
  },
  vencimiento: {
    none: { label: "Sin vencimiento", tone: "muted" },
    ok: { label: null, tone: "success" },
    soon: { label: null, tone: "warning" },
    today: { label: "Hoy", tone: "orange" },
    overdue: { label: "Vencida", tone: "danger" },
    closed: { label: "-", tone: "muted" },
  },
};

function humanize(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getOperationalStatusConfig(domain, status) {
  const config = STATUS_CONFIG[domain]?.[status];
  if (config) return config;
  return { label: humanize(status), tone: "muted" };
}

export default function OperationalStatusBadge({
  domain,
  status,
  label,
  tone,
  style = {},
}) {
  const config = getOperationalStatusConfig(domain, status);
  const currentTone = TONES[tone || config.tone] || TONES.muted;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 24,
        borderRadius: 999,
        padding: "5px 9px",
        fontSize: 12,
        lineHeight: 1,
        fontWeight: 1000,
        whiteSpace: "nowrap",
        border: `1px solid ${currentTone.borderColor}`,
        background: currentTone.background,
        color: currentTone.color,
        ...style,
      }}
    >
      {label || config.label}
    </span>
  );
}
