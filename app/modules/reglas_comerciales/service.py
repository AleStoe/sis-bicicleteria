from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.shared.money import redondear_monto

from .repository import (
    get_reglas_comerciales,
    get_reglas_activas_por_medios,
    get_tarjeta_plan_activo
)

def _dec(value) -> Decimal:
    return Decimal(str(value))


def listar_reglas_comerciales(solo_activas: bool = True):
    conn = get_connection()

    try:
        return get_reglas_comerciales(conn, solo_activas=solo_activas)
    finally:
        conn.close()


def _calcular_monto_regla(regla: dict, subtotal_base: Decimal) -> Decimal:
    porcentaje = regla.get("porcentaje")
    monto_fijo = regla.get("monto_fijo")

    if porcentaje is not None:
        return redondear_monto(subtotal_base * (_dec(porcentaje) / Decimal("100")))

    if monto_fijo is not None:
        return redondear_monto(_dec(monto_fijo))

    return Decimal("0")


def _pago_cubre_total(pago, total: Decimal) -> bool:
    return redondear_monto(_dec(pago.monto)) >= redondear_monto(total)


def simular_reglas_comerciales(data):
    subtotal_base = redondear_monto(data.subtotal_base)
    pagos = data.medios_pago or []

    descuento_total = Decimal("0")
    recargo_total = Decimal("0")
    reglas_aplicadas = []

    medios_pago = list({pago.medio_pago for pago in pagos})

    conn = get_connection()
    try:
        reglas = get_reglas_activas_por_medios(conn, medios_pago)

        for regla in reglas:
            medio_regla = regla.get("medio_pago")

            pagos_aplicables = [
                pago for pago in pagos
                if medio_regla is None or pago.medio_pago == medio_regla
            ]

            if not pagos_aplicables:
                continue

            if regla.get("requiere_pago_total"):
                if not any(_pago_cubre_total(pago, subtotal_base) for pago in pagos_aplicables):
                    continue

            monto_regla = _calcular_monto_regla(regla, subtotal_base)

            if monto_regla <= Decimal("0"):
                continue

            if regla["tipo"] == "descuento":
                descuento_total = redondear_monto(descuento_total + monto_regla)
            elif regla["tipo"] == "recargo":
                recargo_total = redondear_monto(recargo_total + monto_regla)
            else:
                continue

            reglas_aplicadas.append(
                {
                    "id_regla_comercial": regla["id"],
                    "tipo": regla["tipo"],
                    "descripcion": regla["nombre"],
                    "medio_pago": medio_regla,
                    "porcentaje_aplicado": regla.get("porcentaje"),
                    "monto_aplicado": monto_regla,
                }
            )

            if not regla.get("combinable", True):
                break

        for pago in pagos:
            if pago.medio_pago != "tarjeta":
                continue

            cuotas = pago.cuotas or 1
            entidad = getattr(pago, "entidad", None)

            plan = get_tarjeta_plan_activo(
                conn,
                medio_pago=pago.medio_pago,
                cuotas=cuotas,
                entidad=entidad,
            )

            if plan is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No existe plan financiero activo para "
                        f"{pago.medio_pago} en {cuotas} cuota(s)"
                    ),
                )

            monto_pago = redondear_monto(_dec(pago.monto))
            porcentaje = _dec(plan["porcentaje_recargo_cliente"])

            recargo = redondear_monto(
                monto_pago * (porcentaje / Decimal("100"))
            )

            if recargo <= Decimal("0"):
                continue

            recargo_total = redondear_monto(recargo_total + recargo)

            reglas_aplicadas.append(
                {
                    "id_regla_comercial": None,
                    "tipo": "recargo",
                    "descripcion": plan["nombre"],
                    "medio_pago": pago.medio_pago,
                    "porcentaje_aplicado": porcentaje,
                    "monto_aplicado": recargo,
                }
            )

    finally:
        conn.close()

    total_final = redondear_monto(
        subtotal_base - descuento_total + recargo_total
    )

    return {
        "subtotal_base": subtotal_base,
        "descuento_total": descuento_total,
        "recargo_total": recargo_total,
        "total_final": total_final,
        "reglas_aplicadas": reglas_aplicadas,
    }