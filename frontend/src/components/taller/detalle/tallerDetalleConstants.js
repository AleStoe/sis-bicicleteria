export const ESTADOS = [
  "ingresada",
  "presupuestada",
  "esperando_aprobacion",
  "esperando_repuestos",
  "en_reparacion",
  "terminada",
  "facturada",
  "lista_para_retirar",
  "retirada",
  "cancelada",
];

export const TRANSICIONES_UI = {
  ingresada: ["presupuestada", "cancelada"],
  presupuestada: ["esperando_aprobacion", "en_reparacion", "cancelada"],
  esperando_aprobacion: ["en_reparacion", "cancelada"],
  esperando_repuestos: ["en_reparacion", "cancelada"],
  en_reparacion: ["esperando_repuestos", "terminada", "cancelada"],
  terminada: [],
  facturada: ["lista_para_retirar"],
  lista_para_retirar: ["retirada"],
  retirada: [],
  cancelada: [],
};
