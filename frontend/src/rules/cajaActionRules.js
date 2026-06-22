export function cajaEstaAbierta(caja) {
  return caja?.estado === "abierta";
}

export function puedeAbrirCaja({ procesando, montoApertura, cajaActual }) {
  if (procesando || cajaEstaAbierta(cajaActual)) return false;
  if (montoApertura === "" || montoApertura === null || montoApertura === undefined) return false;

  const monto = Number(montoApertura);
  return Number.isFinite(monto) && monto >= 0;
}

export function puedeCerrarCaja({ procesando, caja, montoReal }) {
  if (procesando || !cajaEstaAbierta(caja)) return false;
  if (montoReal === "" || montoReal === null || montoReal === undefined) return false;

  const monto = Number(montoReal);
  return Number.isFinite(monto) && monto >= 0;
}

export function puedeRegistrarMovimientoCaja({ procesando, caja, monto, nota }) {
  if (procesando || !cajaEstaAbierta(caja)) return false;

  const importe = Number(monto || 0);
  return Number.isFinite(importe) && importe > 0 && String(nota || "").trim().length >= 3;
}
