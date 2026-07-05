from decimal import Decimal

from fastapi import HTTPException
from psycopg.errors import UniqueViolation

from app.db.connection import get_connection
from app.shared.money import redondear_monto

from .repository import (
    get_reglas_comerciales,
    get_regla_comercial,
    existe_regla_comercial_con_nombre,
    get_reglas_activas_por_medios,
    insert_regla_comercial,
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


def _monto_base_pago(pago) -> Decimal:
    return redondear_monto(
        _dec(
            getattr(pago, "monto_base", None)
            or getattr(pago, "monto", None)
        )
    )


def _sumar_bases(pagos) -> Decimal:
    return redondear_monto(
        sum((_monto_base_pago(pago) for pago in pagos), Decimal("0"))
    )


def _calcular_monto_regla(regla: dict, base_regla: Decimal) -> Decimal:
    porcentaje = regla.get("porcentaje")
    monto_fijo = regla.get("monto_fijo")

    if porcentaje is not None:
        return redondear_monto(
            base_regla * (_dec(porcentaje) / Decimal("100"))
        )

    if monto_fijo is not None:
        return redondear_monto(_dec(monto_fijo))

    return Decimal("0")


def _simular_con_conn(conn, *, subtotal_base: Decimal, pagos):
    descuento_total = Decimal("0")
    recargo_total = Decimal("0")
    total_cobrado = Decimal("0")

    reglas_aplicadas = []
    tramos_pago = []

    pagos = pagos or []

    total_base_asignada = _sumar_bases(pagos)

    if total_base_asignada > subtotal_base:
        raise HTTPException(
            status_code=400,
            detail="La suma de bases de pago supera el subtotal de la venta",
        )

    medios_pago = list({pago.medio_pago for pago in pagos})

    reglas = get_reglas_activas_por_medios(
        conn,
        medios_pago,
    )

    for pago in pagos:
        medio_pago = pago.medio_pago
        monto_base = _monto_base_pago(pago)

        descuento = Decimal("0")
        recargo = Decimal("0")
        costo_financiero = Decimal("0")

        id_tarjeta_plan = None
        porcentaje_recargo_aplicado = None
        porcentaje_costo_financiero_aplicado = Decimal("0")
        plan = None

        if medio_pago in {"tarjeta", "mercadopago"}:
            cuotas = pago.cuotas or 1
            entidad = getattr(pago, "entidad", None)

            plan = get_tarjeta_plan_activo(
                conn,
                medio_pago=medio_pago,
                cuotas=cuotas,
                entidad=entidad,
            )

            if plan is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No existe plan financiero activo para "
                        f"{medio_pago} en {cuotas} cuota(s)"
                    ),
                )

        if plan is not None:
            id_tarjeta_plan = plan["id"]

            porcentaje_recargo_aplicado = _dec(
                plan["porcentaje_recargo_cliente"]
            )
            porcentaje_costo_financiero_aplicado = _dec(
                plan["porcentaje_costo_financiero"]
            )

            recargo = redondear_monto(
                monto_base * (
                    porcentaje_recargo_aplicado / Decimal("100")
                )
            )

            if recargo > Decimal("0"):
                reglas_aplicadas.append(
                    {
                        "id_regla_comercial": None,
                        "id_tarjeta_plan": id_tarjeta_plan,
                        "tipo": "recargo",
                        "descripcion": plan["nombre"],
                        "medio_pago": medio_pago,
                        "porcentaje_aplicado": porcentaje_recargo_aplicado,
                        "monto_base_aplicado": monto_base,
                        "monto_aplicado": recargo,
                    }
                )

        else:
            for regla in reglas:
                medio_regla = regla.get("medio_pago")

                if medio_regla is not None and medio_regla != medio_pago:
                    continue

                if (
                    regla.get("requiere_pago_total")
                    and total_base_asignada < subtotal_base
                ):
                    continue

                monto_regla = _calcular_monto_regla(
                    regla,
                    monto_base,
                )

                if monto_regla <= Decimal("0"):
                    continue

                if regla["tipo"] == "descuento":
                    descuento = redondear_monto(
                        descuento + monto_regla
                    )

                elif regla["tipo"] == "recargo":
                    recargo = redondear_monto(
                        recargo + monto_regla
                    )

                else:
                    continue

                reglas_aplicadas.append(
                    {
                        "id_regla_comercial": regla["id"],
                        "id_tarjeta_plan": None,
                        "tipo": regla["tipo"],
                        "descripcion": regla["nombre"],
                        "medio_pago": medio_pago,
                        "porcentaje_aplicado": regla.get("porcentaje"),
                        "monto_base_aplicado": monto_base,
                        "monto_aplicado": monto_regla,
                    }
                )

                if not regla.get("combinable", True):
                    break

        monto_total_cobrado = redondear_monto(
            monto_base - descuento + recargo
        )
        costo_financiero = redondear_monto(
            monto_total_cobrado
            * (
                porcentaje_costo_financiero_aplicado
                / Decimal("100")
            )
        )
        monto_neto_liquidado = redondear_monto(
            monto_total_cobrado - costo_financiero
        )

        if monto_neto_liquidado < Decimal("0"):
            raise HTTPException(
                status_code=400,
                detail="El costo financiero supera el monto cobrado",
            )

        descuento_total = redondear_monto(
            descuento_total + descuento
        )

        recargo_total = redondear_monto(
            recargo_total + recargo
        )

        total_cobrado = redondear_monto(
            total_cobrado + monto_total_cobrado
        )

        tramos_pago.append(
            {
                "medio_pago": medio_pago,
                "monto_base_aplicado": monto_base,
                "descuento_aplicado": descuento,
                "recargo_aplicado": recargo,
                "monto_total_cobrado": monto_total_cobrado,
                "cuotas": getattr(pago, "cuotas", None),
                "entidad": getattr(pago, "entidad", None),
                "id_tarjeta_plan": id_tarjeta_plan,
                "porcentaje_recargo_aplicado": porcentaje_recargo_aplicado,
                "porcentaje_costo_financiero_aplicado": (
                    porcentaje_costo_financiero_aplicado
                ),
                "costo_financiero": costo_financiero,
                "monto_neto_liquidado": monto_neto_liquidado,
            }
        )

    saldo_base_estimado = redondear_monto(
        subtotal_base - total_base_asignada
    )

    total_final = redondear_monto(
        total_cobrado + saldo_base_estimado
    )

    return {
        "subtotal_base": subtotal_base,
        "descuento_total": descuento_total,
        "recargo_total": recargo_total,
        "total_final": total_final,
        "total_base_asignada": total_base_asignada,
        "total_pagos_cargados": total_cobrado,
        "saldo_base_estimado": saldo_base_estimado,
        "saldo_estimado": saldo_base_estimado,
        "saldo_raw": saldo_base_estimado,
        "reglas_aplicadas": reglas_aplicadas,
        "tramos_pago": tramos_pago,
    }


def _calcular_monto_sugerido_para_saldar(
    conn,
    *,
    subtotal_base: Decimal,
    pagos_actuales,
    sugerencia,
):
    simulacion_actual = _simular_con_conn(
        conn,
        subtotal_base=subtotal_base,
        pagos=pagos_actuales,
    )

    saldo_base = redondear_monto(
        simulacion_actual["saldo_base_estimado"]
    )

    if saldo_base <= Decimal("0"):
        return {
            "monto_base": Decimal("0.00"),
            "monto_total_cobrado": Decimal("0.00"),
        }

    pago_sugerido = PagoSimulacionInput(
        medio_pago=sugerencia.medio_pago,
        monto_base=saldo_base,
        cuotas=sugerencia.cuotas,
        entidad=sugerencia.entidad,
    )

    simulacion = _simular_con_conn(
        conn,
        subtotal_base=subtotal_base,
        pagos=[*pagos_actuales, pago_sugerido],
    )

    tramo = simulacion["tramos_pago"][-1]

    return {
        "monto_base": saldo_base,
        "monto_total_cobrado": tramo["monto_total_cobrado"],
    }


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

        monto_base_sugerido = None
        monto_sugerido = None

        if data.sugerir_saldo_con_medio_pago is not None:
            sugerencia = _calcular_monto_sugerido_para_saldar(
                conn,
                subtotal_base=subtotal_base,
                pagos_actuales=pagos,
                sugerencia=data.sugerir_saldo_con_medio_pago,
            )

            monto_base_sugerido = sugerencia["monto_base"]
            monto_sugerido = sugerencia["monto_total_cobrado"]

        return {
            "subtotal_base": resultado["subtotal_base"],
            "descuento_total": resultado["descuento_total"],
            "recargo_total": resultado["recargo_total"],
            "total_final": resultado["total_final"],
            "total_base_asignada": resultado["total_base_asignada"],
            "total_pagos_cargados": resultado["total_pagos_cargados"],
            "saldo_base_estimado": resultado["saldo_base_estimado"],
            "saldo_estimado": resultado["saldo_estimado"],
            "monto_base_sugerido_para_saldar": monto_base_sugerido,
            "monto_sugerido_para_saldar": monto_sugerido,
            "reglas_aplicadas": resultado["reglas_aplicadas"],
            "tramos_pago": resultado["tramos_pago"],
        }

    finally:
        conn.close()


def editar_regla_comercial(regla_id: int, data):
    conn = get_connection()

    try:
        payload = data.model_dump(exclude_unset=True)
        actual = get_regla_comercial(conn, regla_id)

        if actual is None:
            raise HTTPException(
                status_code=404,
                detail="Regla comercial no encontrada",
            )

        if not payload:
            raise HTTPException(
                status_code=400,
                detail="No se informaron cambios para la regla comercial",
            )

        nombre = str(payload.get("nombre", actual["nombre"])).strip()

        if existe_regla_comercial_con_nombre(
            conn,
            nombre,
            excluir_id=regla_id,
        ):
            raise HTTPException(
                status_code=400,
                detail="Ya existe una regla comercial con ese nombre",
            )

        payload["nombre"] = nombre
        _validar_valor_regla({**dict(actual), **payload})

        try:
            regla = update_regla_comercial(conn, regla_id, payload)
        except UniqueViolation:
            conn.rollback()
            raise HTTPException(
                status_code=400,
                detail="Ya existe una regla comercial con esos datos",
            )

        conn.commit()
        return regla

    finally:
        conn.close()


def crear_regla_comercial(data):
    conn = get_connection()

    try:
        payload = data.model_dump()
        payload["nombre"] = payload["nombre"].strip()

        if existe_regla_comercial_con_nombre(conn, payload["nombre"]):
            raise HTTPException(
                status_code=400,
                detail="Ya existe una regla comercial con ese nombre",
            )

        try:
            regla = insert_regla_comercial(
                conn,
                payload,
            )
        except UniqueViolation:
            conn.rollback()
            raise HTTPException(
                status_code=400,
                detail="Ya existe una regla comercial activa con esos datos",
            )

        conn.commit()
        return regla

    finally:
        conn.close()


def _validar_valor_regla(regla: dict) -> None:
    porcentaje = regla.get("porcentaje")
    monto_fijo = regla.get("monto_fijo")
    informados = [valor for valor in (porcentaje, monto_fijo) if valor is not None]

    if len(informados) != 1:
        raise HTTPException(
            status_code=400,
            detail="La regla debe usar porcentaje o monto fijo, pero no ambos",
        )

    if _dec(informados[0]) <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El valor de la regla debe ser mayor a cero",
        )


def listar_tarjeta_planes(solo_activos: bool = False):
    conn = get_connection()

    try:
        return get_tarjeta_planes(
            conn,
            solo_activos=solo_activos,
        )
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

        plan = update_tarjeta_plan(
            conn,
            plan_id,
            payload,
        )

        if plan is None:
            raise HTTPException(
                status_code=404,
                detail="Plan de tarjeta no encontrado",
            )

        conn.commit()

        return plan

    finally:
        conn.close()
