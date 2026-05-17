from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.shared.money import redondear_monto

from .repository import (
    get_reglas_comerciales,
    get_reglas_activas_por_medios,
    get_tarjeta_plan_activo,
    update_regla_comercial,
    get_tarjeta_planes,
    insert_tarjeta_plan,
    update_tarjeta_plan,
)
from .schema import PagoSimulacionInput


def _dec(value) -> Decimal:
    return Decimal(str(value))


def listar_reglas_comerciales(solo_activas: bool = True):
    conn = get_connection()

    try:
        return get_reglas_comerciales(conn, solo_activas=solo_activas)
    finally:
        conn.close()


def _sumar_pagos(pagos) -> Decimal:
    total = Decimal("0")

    for pago in pagos:
        total += _dec(pago.monto)

    return redondear_monto(total)


def _base_regla_por_pagos(pagos_aplicables, subtotal_base: Decimal) -> Decimal:
    total_pagado = _sumar_pagos(pagos_aplicables)
    return min(total_pagado, subtotal_base)


def _calcular_monto_regla(regla: dict, base_regla: Decimal) -> Decimal:
    porcentaje = regla.get("porcentaje")
    monto_fijo = regla.get("monto_fijo")

    if porcentaje is not None:
        return redondear_monto(base_regla * (_dec(porcentaje) / Decimal("100")))

    if monto_fijo is not None:
        return redondear_monto(_dec(monto_fijo))

    return Decimal("0")


def _pagos_cubren_total(pagos, total: Decimal) -> bool:
    return _sumar_pagos(pagos) >= redondear_monto(total)


def _simular_con_conn(conn, *, subtotal_base: Decimal, pagos):
    descuento_total = Decimal("0")
    recargo_total = Decimal("0")
    reglas_aplicadas = []

    medios_pago = list({pago.medio_pago for pago in pagos})
    reglas = get_reglas_activas_por_medios(conn, medios_pago)

    for regla in reglas:
        medio_regla = regla.get("medio_pago")

        pagos_aplicables = [
            pago
            for pago in pagos
            if medio_regla is None or pago.medio_pago == medio_regla
        ]

        if not pagos_aplicables:
            continue

        base_regla = _base_regla_por_pagos(pagos_aplicables, subtotal_base)

        if base_regla <= Decimal("0"):
            continue

        monto_regla = _calcular_monto_regla(regla, base_regla)

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

        factor = Decimal("1") + (porcentaje / Decimal("100"))

        base_recargo = redondear_monto(monto_pago / factor)

        recargo = redondear_monto(monto_pago - base_recargo)

        if recargo <= Decimal("0"):
            continue

        recargo_total = redondear_monto(recargo_total + recargo)

        reglas_aplicadas.append(
            {
                "id_regla_comercial": None,
                "id_tarjeta_plan": plan["id"],
                "tipo": "recargo",
                "descripcion": plan["nombre"],
                "medio_pago": pago.medio_pago,
                "porcentaje_aplicado": porcentaje,
                "monto_aplicado": recargo,
            }
)

    total_final = redondear_monto(subtotal_base - descuento_total + recargo_total)
    total_pagos_cargados = _sumar_pagos(pagos)
    saldo_raw = redondear_monto(total_final - total_pagos_cargados)

    return {
        "subtotal_base": subtotal_base,
        "descuento_total": descuento_total,
        "recargo_total": recargo_total,
        "total_final": total_final,
        "total_pagos_cargados": total_pagos_cargados,
        "saldo_raw": saldo_raw,
        "saldo_estimado": max(saldo_raw, Decimal("0")),
        "reglas_aplicadas": reglas_aplicadas,
    }


def _calcular_monto_sugerido_para_saldar(
    conn,
    *,
    subtotal_base: Decimal,
    pagos_actuales,
    sugerencia,
) -> Decimal:
    simulacion_actual = _simular_con_conn(
        conn,
        subtotal_base=subtotal_base,
        pagos=pagos_actuales,
    )

    saldo_actual = redondear_monto(simulacion_actual["saldo_raw"])

    if saldo_actual <= Decimal("0"):
        return Decimal("0.00")

    # Tarjeta: recargo comercial normal.
    # Si el saldo actual es 1000 y el plan tiene 15%,
    # el cliente debe pagar 1150, no 1176.47.
    if sugerencia.medio_pago == "tarjeta":
        cuotas = sugerencia.cuotas or 1
        entidad = getattr(sugerencia, "entidad", None)

        plan = get_tarjeta_plan_activo(
            conn,
            medio_pago=sugerencia.medio_pago,
            cuotas=cuotas,
            entidad=entidad,
        )

        if plan is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"No existe plan financiero activo para "
                    f"{sugerencia.medio_pago} en {cuotas} cuota(s)"
                ),
            )

        porcentaje = _dec(plan["porcentaje_recargo_cliente"])

        return redondear_monto(
            saldo_actual * (Decimal("1") + porcentaje / Decimal("100"))
        )

    # Efectivo/transferencia: se mantiene búsqueda porque el descuento
    # depende del monto pagado y queremos calcular el monto justo a cobrar.
    def simular_con_monto(monto: Decimal):
        pago_sugerido = PagoSimulacionInput(
            medio_pago=sugerencia.medio_pago,
            monto=max(redondear_monto(monto), Decimal("0.01")),
            cuotas=sugerencia.cuotas,
            entidad=sugerencia.entidad,
        )

        return _simular_con_conn(
            conn,
            subtotal_base=subtotal_base,
            pagos=[*pagos_actuales, pago_sugerido],
        )

    bajo = Decimal("0")
    alto = max(saldo_actual, Decimal("1"))

    while simular_con_monto(alto)["saldo_raw"] > Decimal("0"):
        alto = redondear_monto(alto * Decimal("2"))

        if alto > subtotal_base * Decimal("10"):
            raise HTTPException(
                status_code=400,
                detail="No se pudo calcular un monto sugerido razonable para saldar",
            )

    for _ in range(40):
        medio = redondear_monto((bajo + alto) / Decimal("2"))
        resultado = simular_con_monto(medio)

        if resultado["saldo_raw"] > Decimal("0"):
            bajo = medio
        else:
            alto = medio

    return redondear_monto(alto)

def simular_reglas_comerciales(data):
    subtotal_base = redondear_monto(data.subtotal_base)
    pagos = data.medios_pago or []

    conn = get_connection()
    try:
        resultado = _simular_con_conn(
            conn,
            subtotal_base=subtotal_base,
            pagos=pagos,
        )

        monto_sugerido = None

        if data.sugerir_saldo_con_medio_pago is not None:
            monto_sugerido = _calcular_monto_sugerido_para_saldar(
                conn,
                subtotal_base=subtotal_base,
                pagos_actuales=pagos,
                sugerencia=data.sugerir_saldo_con_medio_pago,
            )

        return {
            "subtotal_base": resultado["subtotal_base"],
            "descuento_total": resultado["descuento_total"],
            "recargo_total": resultado["recargo_total"],
            "total_final": resultado["total_final"],
            "total_pagos_cargados": resultado["total_pagos_cargados"],
            "saldo_estimado": resultado["saldo_estimado"],
            "monto_sugerido_para_saldar": monto_sugerido,
            "reglas_aplicadas": resultado["reglas_aplicadas"],
        }

    finally:
        conn.close()

def editar_regla_comercial(regla_id: int, data):
    conn = get_connection()

    try:
        payload = data.model_dump(exclude_unset=True)

        regla = update_regla_comercial(conn, regla_id, payload)

        if regla is None:
            raise HTTPException(status_code=404, detail="Regla comercial no encontrada")

        conn.commit()
        return regla

    finally:
        conn.close()


def listar_tarjeta_planes(solo_activos: bool = False):
    conn = get_connection()

    try:
        return get_tarjeta_planes(conn, solo_activos=solo_activos)
    finally:
        conn.close()


def crear_tarjeta_plan(data):
    conn = get_connection()

    try:
        plan = insert_tarjeta_plan(
            conn,
            data.model_dump(),
        )
        conn.commit()
        return plan

    finally:
        conn.close()


def editar_tarjeta_plan(plan_id: int, data):
    conn = get_connection()

    try:
        payload = data.model_dump(exclude_unset=True)

        plan = update_tarjeta_plan(conn, plan_id, payload)

        if plan is None:
            raise HTTPException(status_code=404, detail="Plan de tarjeta no encontrado")

        conn.commit()
        return plan

    finally:
        conn.close()