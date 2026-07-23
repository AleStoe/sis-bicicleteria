export const POSTVENTA_ESTADOS = [
  "abierto",
  "en_evaluacion",
  "esperando_proveedor",
  "decision_pendiente",
  "aprobado_total",
  "aprobado_parcial",
  "rechazado",
  "en_resolucion",
  "esperando_retiro",
  "resuelto",
  "cerrado",
  "cancelado",
  "reabierto",
];

export const POSTVENTA_TIPOS = [
  "service_postventa",
  "garantia_fabrica",
  "garantia_local",
  "reclamo_tecnico",
  "atencion_comercial",
  "devolucion_cambio",
  "revision",
];

export const POSTVENTA_PRIORIDADES = ["baja", "normal", "alta", "urgente"];

export const POSTVENTA_TERMINALES = new Set(["cerrado", "cancelado"]);

export const POSTVENTA_TRANSICIONES_UI = {
  abierto: ["en_evaluacion", "esperando_proveedor", "decision_pendiente", "cancelado"],
  en_evaluacion: [
    "esperando_proveedor",
    "decision_pendiente",
    "rechazado",
    "aprobado_total",
    "aprobado_parcial",
    "resuelto",
    "cancelado",
  ],
  esperando_proveedor: ["decision_pendiente", "rechazado", "cancelado"],
  decision_pendiente: ["aprobado_total", "aprobado_parcial", "rechazado", "cancelado"],
  aprobado_total: ["en_resolucion", "resuelto", "esperando_retiro", "cancelado"],
  aprobado_parcial: ["en_resolucion", "resuelto", "esperando_retiro", "cancelado"],
  rechazado: ["esperando_retiro", "cerrado", "cancelado"],
  en_resolucion: ["resuelto", "esperando_retiro", "cancelado"],
  esperando_retiro: ["cerrado", "cancelado"],
  resuelto: ["cerrado", "esperando_retiro"],
  cerrado: [],
  cancelado: [],
  reabierto: ["en_evaluacion", "esperando_proveedor", "decision_pendiente", "cancelado"],
};

export function labelPostventaEstado(value) {
  const labels = {
    abierto: "Abierto",
    en_evaluacion: "En evaluacion",
    esperando_proveedor: "Esperando proveedor",
    decision_pendiente: "Decision pendiente",
    aprobado_total: "Aprobado total",
    aprobado_parcial: "Aprobado parcial",
    rechazado: "Rechazado",
    en_resolucion: "En resolucion",
    esperando_retiro: "Esperando retiro",
    resuelto: "Resuelto",
    cerrado: "Cerrado",
    cancelado: "Cancelado",
    reabierto: "Reabierto",
  };

  return labels[value] || value || "-";
}

export function labelPostventaTipo(value) {
  const labels = {
    service_postventa: "Service postventa",
    garantia_fabrica: "Garantia fabrica",
    garantia_local: "Garantia local",
    reclamo_tecnico: "Reclamo tecnico",
    atencion_comercial: "Atencion comercial",
    devolucion_cambio: "Devolucion / cambio",
    revision: "Revision",
  };

  return labels[value] || value || "-";
}

export function labelPostventaPrioridad(value) {
  const labels = {
    baja: "Baja",
    normal: "Normal",
    alta: "Alta",
    urgente: "Urgente",
  };

  return labels[value] || value || "-";
}

export function variantPostventaEstado(estado) {
  if (["cerrado", "resuelto"].includes(estado)) return "success";
  if (["cancelado", "rechazado"].includes(estado)) return "danger";
  if (["esperando_proveedor", "decision_pendiente", "esperando_retiro"].includes(estado)) return "warning";
  return "default";
}
