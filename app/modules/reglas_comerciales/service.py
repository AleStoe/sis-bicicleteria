from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.shared.money import redondear_monto

from .repository import (
    get_reglas_comerciales,
    get_reglas_activas_por_medios,
)
REGLAS_CUOTAS = {
    3: Decimal("15"),
    6: Decimal("35"),
    12: Decimal("70"),
}

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


def simular_reglas_comerciales(data):
    subtotal_base = redondear_monto(data.subtotal_base)

    pagos = data.medios_pago or []

    descuento_total = Decimal("0")
    recargo_total = Decimal("0")

    reglas_aplicadas = []

    total_pagos = Decimal("0")

    for pago in pagos:
        monto_pago = redondear_monto(_dec(pago.monto))

        total_pagos += monto_pago

        # =========================================
        # EFECTIVO / TRANSFERENCIA
        # =========================================

        if pago.medio_pago in ("efectivo", "transferencia"):
            descuento = redondear_monto(
                monto_pago * Decimal("0.10")
            )

            descuento_total += descuento

            reglas_aplicadas.append(
                {
                    "id_regla_comercial": 1,
                    "tipo": "descuento",
                    "descripcion": (
                        f"Descuento contado 10% "
                        f"({pago.medio_pago})"
                    ),
                    "medio_pago": pago.medio_pago,
                    "porcentaje_aplicado": Decimal("10"),
                    "monto_aplicado": descuento,
                }
            )

        # =========================================
        # TARJETA
        # =========================================

        elif pago.medio_pago == "tarjeta":
            cuotas = pago.cuotas or 1

            if cuotas > 1:
                porcentaje = REGLAS_CUOTAS.get(cuotas)

                if porcentaje is None:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"No existe regla financiera "
                            f"para {cuotas} cuotas"
                        ),
                    )

                recargo = redondear_monto(
                    monto_pago * (porcentaje / Decimal("100"))
                )

                recargo_total += recargo

                reglas_aplicadas.append(
                    {
                        "id_regla_comercial": None,
                        "tipo": "recargo",
                        "descripcion": (
                            f"Recargo tarjeta "
                            f"{cuotas} cuotas"
                        ),
                        "medio_pago": "tarjeta",
                        "porcentaje_aplicado": porcentaje,
                        "monto_aplicado": recargo,
                    }
                )

    total_final = redondear_monto(
        subtotal_base
        - descuento_total
        + recargo_total
    )

    return {
        "subtotal_base": subtotal_base,
        "descuento_total": descuento_total,
        "recargo_total": recargo_total,
        "total_final": total_final,
        "reglas_aplicadas": reglas_aplicadas,
    }