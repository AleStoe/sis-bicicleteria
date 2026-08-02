from decimal import Decimal

from fastapi import HTTPException

from app.modules.auditoria import service as auditoria_service
from app.shared.constants import (
    ORIGEN_VENTA,
    CREDITO_MOVIMIENTO_GENERADO,
    CREDITO_MOVIMIENTO_APLICACION_VENTA,
    CREDITO_ESTADO_APLICADO_TOTAL,
    CREDITO_ESTADO_APLICADO_PARCIAL,
    AUDITORIA_ENTIDAD_CREDITO,
    AUDITORIA_ACCION_CREDITO_GENERADO,
    AUDITORIA_ACCION_CREDITO_APLICADO,
    CREDITO_ESTADO_ABIERTO,
    CREDITO_ESTADO_ANULADO,
    CREDITO_MOVIMIENTO_ANULACION_ADMINISTRATIVA,
    CREDITO_MOVIMIENTO_REINTEGRO,
    CREDITO_MOVIMIENTO_RESTAURACION_VENTA,
    AUDITORIA_ACCION_CREDITO_ANULADO_ADMINISTRATIVO,
    AUDITORIA_ACCION_CREDITO_REINTEGRADO,
    CAJA_MOVIMIENTO_EGRESO,
    CAJA_ORIGEN_EGRESO_MANUAL,
)
from . import repository

from app.modules.authz.service import exigir_permiso_reintegrar_credito
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)
from app.modules.pagos import repository as pagos_repository
from app.modules.pagos.service import (
    calcular_tramo_financiero_pago,
    resolver_tramo_financiero_para_cobrado_objetivo,
)
from app.modules.ventas import repository as ventas_repository
from app.shared.money import redondear_monto


MEDIO_CREDITO_EQUIVALENTE = "efectivo"
MEDIOS_REINTEGRO_CREDITO = {"efectivo", "transferencia"}

def crear_credito_por_anulacion_venta(
    conn,
    *,
    id_cliente: int,
    id_venta: int,
    monto_credito: Decimal,
    id_usuario: int,
):
    monto_credito = Decimal(str(monto_credito))

    if monto_credito <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto del crédito debe ser mayor a 0",
        )

    credito_existente = repository.get_credito_abierto_by_origen(
        conn,
        origen_tipo=ORIGEN_VENTA,
        origen_id=id_venta,
    )
    if credito_existente:
        raise HTTPException(
            status_code=400,
            detail=f"La venta {id_venta} ya tiene un crédito generado",
        )

    credito = repository.insert_credito_cliente(
        conn,
        id_cliente=id_cliente,
        origen_tipo=ORIGEN_VENTA,
        origen_id=id_venta,
        saldo_actual=monto_credito,
        observacion=f"Crédito generado por anulación de venta #{id_venta}",
    )

    repository.insert_credito_movimiento(
        conn,
        id_credito=credito["id"],
        tipo_movimiento=CREDITO_MOVIMIENTO_GENERADO,
        monto=monto_credito,
        origen_tipo=ORIGEN_VENTA,
        origen_id=id_venta,
        nota=f"Crédito generado por anulación de venta #{id_venta}",
        id_usuario=id_usuario,
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=None,  # aceptable si no tenés venta cargada acá
        entidad=AUDITORIA_ENTIDAD_CREDITO,
        entidad_id=credito["id"],
        accion=AUDITORIA_ACCION_CREDITO_GENERADO,
        detalle=(
            f"Crédito generado por anulación de venta. "
            f"cliente={id_cliente}, venta_id={id_venta}, monto={monto_credito}"
        ),
        metadata={
            "tipo": "credito_generado_por_anulacion",
            "credito_id": credito["id"],
            "venta_id": id_venta,
            "cliente_id": id_cliente,
            "monto_credito": str(monto_credito),
            "origen": "anulacion_venta",
        },
        origen_tipo="venta",
        origen_id=id_venta,
    )

    return credito


def obtener_credito_detalle(conn, credito_id: int):
    credito = repository.get_credito_by_id(conn, credito_id)

    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")

    movimientos = repository.get_credito_movimientos(conn, credito_id)
    origen_venta = None

    if credito["origen_tipo"] == ORIGEN_VENTA:
        venta = ventas_repository.get_venta_by_id(conn, credito["origen_id"])
        if venta:
            items = ventas_repository.get_venta_items_by_venta_id(
                conn,
                credito["origen_id"],
            )
            pagos = pagos_repository.obtener_pagos_por_venta(
                conn,
                credito["origen_id"],
            )
            pagos_confirmados = [
                pago for pago in pagos if pago["estado"] == "confirmado"
            ]

            origen_venta = {
                "venta": venta,
                "items": items,
                "pagos": pagos,
                "total_base_pagada": redondear_monto(
                    sum(
                        (
                            Decimal(str(pago["monto_base_aplicado"] or 0))
                            for pago in pagos_confirmados
                        ),
                        Decimal("0"),
                    )
                ),
                "total_descuento_aplicado": redondear_monto(
                    sum(
                        (
                            Decimal(str(pago["monto_descuento_aplicado"] or 0))
                            for pago in pagos_confirmados
                        ),
                        Decimal("0"),
                    )
                ),
                "total_recargo_aplicado": redondear_monto(
                    sum(
                        (
                            Decimal(str(pago["monto_recargo_aplicado"] or 0))
                            for pago in pagos_confirmados
                        ),
                        Decimal("0"),
                    )
                ),
                "total_cobrado_real": redondear_monto(
                    sum(
                        (
                            Decimal(str(pago["monto_total_cobrado"] or 0))
                            for pago in pagos_confirmados
                        ),
                        Decimal("0"),
                    )
                ),
            }

    return {
        "credito": credito,
        "movimientos": movimientos,
        "origen_venta": origen_venta,
    }


def listar_creditos_cliente(conn, id_cliente: int):
    return repository.get_creditos_cliente(conn, id_cliente)


def listar_clientes_con_credito_disponible(conn, q: str | None = None, limit: int = 100):
    if limit < 1:
        raise HTTPException(status_code=400, detail="El limite debe ser mayor a 0")
    if limit > 200:
        raise HTTPException(status_code=400, detail="El limite maximo permitido es 200")

    return repository.get_clientes_con_credito_disponible(conn, q=q, limit=limit)


def restaurar_credito_aplicado_a_venta(
    conn,
    *,
    id_venta: int,
    id_usuario: int,
    monto_maximo: Decimal | None = None,
    motivo: str,
):
    aplicaciones = repository.get_aplicaciones_credito_venta(conn, id_venta)
    restante = (
        redondear_monto(monto_maximo)
        if monto_maximo is not None
        else None
    )
    total_restaurado = Decimal("0")

    for aplicacion in aplicaciones:
        aplicado = redondear_monto(aplicacion["monto"])
        restaurado = redondear_monto(aplicacion["monto_restaurado"])
        disponible = redondear_monto(aplicado - restaurado)

        if disponible <= Decimal("0"):
            continue

        if restante is not None:
            if restante <= Decimal("0"):
                break
            a_restaurar = min(disponible, restante)
        else:
            a_restaurar = disponible

        credito = repository.get_credito_by_id_for_update(
            conn,
            aplicacion["id_credito"],
        )
        if credito is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "No se pudo restaurar el crédito aplicado porque el "
                    f"crédito #{aplicacion['id_credito']} ya no existe"
                ),
            )

        nuevo_saldo = redondear_monto(
            Decimal(str(credito["saldo_actual"])) + a_restaurar
        )
        repository.update_credito_saldo_y_estado(
            conn,
            credito_id=credito["id"],
            saldo_actual=nuevo_saldo,
            estado=CREDITO_ESTADO_ABIERTO,
        )
        repository.insert_credito_movimiento(
            conn,
            id_credito=credito["id"],
            tipo_movimiento=CREDITO_MOVIMIENTO_RESTAURACION_VENTA,
            monto=a_restaurar,
            origen_tipo="credito_aplicacion_restaurada",
            origen_id=aplicacion["id"],
            nota=f"{motivo}. Venta #{id_venta}",
            id_usuario=id_usuario,
        )
        auditoria_service.registrar_evento(
            conn,
            id_usuario=id_usuario,
            id_sucursal=None,
            entidad=AUDITORIA_ENTIDAD_CREDITO,
            entidad_id=credito["id"],
            accion="credito_restaurado_por_venta",
            detalle=(
                f"Crédito restaurado. venta_id={id_venta}, "
                f"aplicacion_id={aplicacion['id']}, monto={a_restaurar}, "
                f"saldo_nuevo={nuevo_saldo}"
            ),
            metadata={
                "tipo": "credito_restaurado_por_venta",
                "venta_id": id_venta,
                "aplicacion_credito_id": aplicacion["id"],
                "monto_restaurado": str(a_restaurar),
                "saldo_nuevo": str(nuevo_saldo),
                "motivo": motivo,
            },
            origen_tipo=ORIGEN_VENTA,
            origen_id=id_venta,
        )

        total_restaurado = redondear_monto(
            total_restaurado + a_restaurar
        )
        if restante is not None:
            restante = redondear_monto(restante - a_restaurar)

    return {
        "monto_restaurado": total_restaurado,
        "monto_sin_restaurar": (
            max(restante, Decimal("0"))
            if restante is not None
            else Decimal("0")
        ),
    }


def _calcular_aplicacion_credito(
    conn,
    *,
    credito_disponible: Decimal,
    saldo_base: Decimal,
    monto_credito_solicitado: Decimal | None,
):
    credito_disponible = redondear_monto(credito_disponible)
    saldo_base = redondear_monto(saldo_base)

    if credito_disponible <= Decimal("0") or saldo_base <= Decimal("0"):
        return {
            "credito_aplicado": Decimal("0"),
            "monto_base_cubierto": Decimal("0"),
            "descuento_aplicado": Decimal("0"),
        }

    tramo_saldar = calcular_tramo_financiero_pago(
        conn,
        {
            "medio_pago": MEDIO_CREDITO_EQUIVALENTE,
            "monto_base": saldo_base,
        },
    )
    credito_para_saldar = redondear_monto(
        tramo_saldar["monto_total_cobrado"]
    )

    if monto_credito_solicitado is None:
        credito_objetivo = min(credito_disponible, credito_para_saldar)
    else:
        credito_objetivo = redondear_monto(monto_credito_solicitado)

        if credito_objetivo < Decimal("0"):
            raise HTTPException(
                status_code=400,
                detail="El monto de crédito no puede ser negativo",
            )

        if credito_objetivo > credito_disponible:
            raise HTTPException(
                status_code=400,
                detail="El cliente no tiene crédito suficiente",
            )

        if credito_objetivo > credito_para_saldar:
            raise HTTPException(
                status_code=400,
                detail=(
                    "El crédito solicitado supera el importe contado "
                    "necesario para cubrir el saldo"
                ),
            )

    if credito_objetivo <= Decimal("0"):
        return {
            "credito_aplicado": Decimal("0"),
            "monto_base_cubierto": Decimal("0"),
            "descuento_aplicado": Decimal("0"),
        }

    if abs(credito_objetivo - credito_para_saldar) <= Decimal("0.01"):
        tramo = tramo_saldar
    else:
        tramo = resolver_tramo_financiero_para_cobrado_objetivo(
            conn,
            medio_pago=MEDIO_CREDITO_EQUIVALENTE,
            monto_cobrado_objetivo=credito_objetivo,
            maximo_base=saldo_base,
        )

    credito_aplicado = redondear_monto(tramo["monto_total_cobrado"])
    monto_base_cubierto = redondear_monto(tramo["monto_base_aplicado"])
    descuento_aplicado = redondear_monto(tramo["descuento_aplicado"])

    return {
        "credito_aplicado": credito_aplicado,
        "monto_base_cubierto": monto_base_cubierto,
        "descuento_aplicado": descuento_aplicado,
    }


def aplicar_credito_a_venta(
    conn,
    *,
    id_cliente: int,
    id_venta: int,
    total_venta: Decimal,
    usar_credito: bool,
    monto_credito_a_aplicar: Decimal | None,
    id_usuario: int,
):
    total_venta = redondear_monto(total_venta)

    if not usar_credito:
        return {
            "credito_aplicado_total": Decimal("0"),
            "monto_base_cubierto": Decimal("0"),
            "descuento_aplicado": Decimal("0"),
            "movimientos": [],
        }

    if total_venta <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El total de la venta debe ser mayor a 0 para aplicar crédito",
        )

    creditos = repository.get_creditos_disponibles_cliente_for_update(conn, id_cliente)

    if not creditos:
        return {
            "credito_aplicado_total": Decimal("0"),
            "monto_base_cubierto": Decimal("0"),
            "descuento_aplicado": Decimal("0"),
            "movimientos": [],
        }

    credito_disponible_total = redondear_monto(
        sum(
            (Decimal(str(c["saldo_actual"])) for c in creditos),
            Decimal("0"),
        )
    )

    aplicacion = _calcular_aplicacion_credito(
        conn,
        credito_disponible=credito_disponible_total,
        saldo_base=total_venta,
        monto_credito_solicitado=monto_credito_a_aplicar,
    )
    monto_objetivo = aplicacion["credito_aplicado"]

    if monto_objetivo <= Decimal("0"):
        return {
            "credito_aplicado_total": Decimal("0"),
            "monto_base_cubierto": Decimal("0"),
            "descuento_aplicado": Decimal("0"),
            "movimientos": [],
        }

    restante = monto_objetivo
    base_restante = aplicacion["monto_base_cubierto"]
    descuento_restante = aplicacion["descuento_aplicado"]
    movimientos = []

    for credito in creditos:
        if restante <= Decimal("0"):
            break

        saldo_actual = Decimal(str(credito["saldo_actual"]))
        if saldo_actual <= Decimal("0"):
            continue

        aplicado = min(saldo_actual, restante)
        proporcion = aplicado / monto_objetivo
        base_aplicada = redondear_monto(
            aplicacion["monto_base_cubierto"] * proporcion
        )
        descuento_aplicado = redondear_monto(
            aplicacion["descuento_aplicado"] * proporcion
        )

        if aplicado == restante:
            base_aplicada = base_restante
            descuento_aplicado = descuento_restante

        nuevo_saldo = saldo_actual - aplicado

        if nuevo_saldo == Decimal("0"):
            nuevo_estado = CREDITO_ESTADO_APLICADO_TOTAL
        else:
            nuevo_estado = CREDITO_ESTADO_APLICADO_PARCIAL

        repository.update_credito_saldo_y_estado(
            conn,
            credito_id=credito["id"],
            saldo_actual=nuevo_saldo,
            estado=nuevo_estado,
        )

        movimiento = repository.insert_credito_movimiento(
            conn,
            id_credito=credito["id"],
            tipo_movimiento=CREDITO_MOVIMIENTO_APLICACION_VENTA,
            monto=aplicado,
            monto_base_aplicado=base_aplicada,
            monto_descuento_aplicado=descuento_aplicado,
            origen_tipo=ORIGEN_VENTA,
            origen_id=id_venta,
            nota=(
                f"Crédito aplicado a venta #{id_venta}. "
                f"Base cubierta={base_aplicada}, "
                f"beneficio contado={descuento_aplicado}"
            ),
            id_usuario=id_usuario,
        )

        auditoria_service.registrar_evento(
            conn,
            id_usuario=id_usuario,
            id_sucursal=None,
            entidad=AUDITORIA_ENTIDAD_CREDITO,
            entidad_id=credito["id"],
            accion=AUDITORIA_ACCION_CREDITO_APLICADO,
            detalle=(
                f"Crédito aplicado a venta. "
                f"venta_id={id_venta}, monto_aplicado={aplicado}, "
                f"saldo_nuevo={nuevo_saldo}, estado_nuevo={nuevo_estado}"
            ),
            metadata={
                "tipo": "credito_aplicado_a_venta",
                "credito_id": credito["id"],
                "venta_id": id_venta,
                "cliente_id": id_cliente,
                "monto_aplicado": str(aplicado),
                "monto_base_cubierto": str(base_aplicada),
                "descuento_aplicado": str(descuento_aplicado),
                "saldo_anterior": str(saldo_actual),
                "saldo_nuevo": str(nuevo_saldo),
                "estado_nuevo": nuevo_estado,
            },
            origen_tipo="venta",
            origen_id=id_venta,
        )

        movimientos.append(movimiento)
        restante -= aplicado
        base_restante -= base_aplicada
        descuento_restante -= descuento_aplicado

    return {
        "credito_aplicado_total": monto_objetivo,
        "monto_base_cubierto": aplicacion["monto_base_cubierto"],
        "descuento_aplicado": aplicacion["descuento_aplicado"],
        "movimientos": movimientos,
    }

def reintegrar_credito(conn, credito_id: int, data):
    exigir_permiso_reintegrar_credito(conn, data.id_usuario)

    if data.medio_pago not in MEDIOS_REINTEGRO_CREDITO:
        raise HTTPException(
            status_code=400,
            detail=(
                "Los créditos comerciales sólo se reintegran por efectivo "
                "o transferencia. Tarjeta y Mercado Pago deben cancelarse "
                "desde la terminal o plataforma correspondiente."
            ),
        )

    credito = repository.get_credito_by_id_for_update(conn, credito_id)
    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")

    if credito["estado"] not in (CREDITO_ESTADO_ABIERTO, CREDITO_ESTADO_APLICADO_PARCIAL):
        raise HTTPException(
            status_code=400,
            detail=f"El crédito {credito_id} no tiene saldo disponible para reintegrar",
        )

    monto = Decimal(str(data.monto))
    saldo_actual = Decimal(str(credito["saldo_actual"]))

    if monto <= Decimal("0"):
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")

    if monto > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail="El monto del reintegro supera el saldo del crédito",
        )

    caja = get_caja_abierta_hoy_by_sucursal_for_update(conn, data.id_sucursal)
    if caja is None:
        raise HTTPException(
            status_code=400,
            detail=f"No hay caja abierta para la sucursal {data.id_sucursal}",
        )

    nuevo_saldo = saldo_actual - monto
    nuevo_estado = (
        CREDITO_ESTADO_APLICADO_TOTAL
        if nuevo_saldo == Decimal("0")
        else CREDITO_ESTADO_APLICADO_PARCIAL
    )

    credito_actualizado = repository.update_credito_saldo_y_estado(
        conn,
        credito_id=credito_id,
        saldo_actual=nuevo_saldo,
        estado=nuevo_estado,
    )

    repository.insert_credito_movimiento(
        conn,
        id_credito=credito_id,
        tipo_movimiento=CREDITO_MOVIMIENTO_REINTEGRO,
        monto=monto,
        origen_tipo="credito",
        origen_id=credito_id,
        nota=data.motivo,
        id_usuario=data.id_usuario,
    )

    insert_caja_movimiento(
        conn,
        id_caja=caja["id"],
        tipo_movimiento=CAJA_MOVIMIENTO_EGRESO,
        submedio=data.medio_pago,
        monto=monto,
        origen_tipo=CAJA_ORIGEN_EGRESO_MANUAL,
        origen_id=credito_id,
        nota=f"Reintegro de crédito #{credito_id}. Motivo: {data.motivo}",
        id_usuario=data.id_usuario,
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=data.id_usuario,
        id_sucursal=data.id_sucursal,
        entidad=AUDITORIA_ENTIDAD_CREDITO,
        entidad_id=credito_id,
        accion=AUDITORIA_ACCION_CREDITO_REINTEGRADO,
        detalle=(
            f"Crédito reintegrado. monto={monto}, "
            f"saldo_nuevo={nuevo_saldo}, estado_nuevo={nuevo_estado}, "
            f"motivo={data.motivo}"
        ),
        metadata={
            "tipo": "credito_reintegrado",
            "credito_id": credito_id,
            "monto_reintegrado": str(monto),
            "saldo_anterior": str(saldo_actual),
            "saldo_nuevo": str(nuevo_saldo),
            "estado_nuevo": nuevo_estado,
            "medio_pago": data.medio_pago,
            "motivo": data.motivo,
            "caja_id": caja["id"],
        },
        origen_tipo="credito",
        origen_id=credito_id,
    )

    return {
        "ok": True,
        "credito_id": credito_id,
        "saldo_actual": credito_actualizado["saldo_actual"],
        "estado": credito_actualizado["estado"],
    }


def anular_credito_administrativo(conn, credito_id: int, data):
    exigir_permiso_reintegrar_credito(conn, data.id_usuario)

    motivo = data.motivo.strip()
    if len(motivo) < 3:
        raise HTTPException(status_code=400, detail="El motivo es obligatorio")

    credito = repository.get_credito_by_id_for_update(conn, credito_id)
    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")

    if credito["estado"] not in (CREDITO_ESTADO_ABIERTO, CREDITO_ESTADO_APLICADO_PARCIAL):
        raise HTTPException(
            status_code=400,
            detail=f"El crédito {credito_id} no tiene saldo disponible para anular",
        )

    saldo_actual = redondear_monto(Decimal(str(credito["saldo_actual"] or 0)))
    if saldo_actual <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail=f"El crédito {credito_id} no tiene saldo disponible para anular",
        )

    credito_actualizado = repository.update_credito_saldo_y_estado(
        conn,
        credito_id=credito_id,
        saldo_actual=Decimal("0"),
        estado=CREDITO_ESTADO_ANULADO,
    )

    repository.insert_credito_movimiento(
        conn,
        id_credito=credito_id,
        tipo_movimiento=CREDITO_MOVIMIENTO_ANULACION_ADMINISTRATIVA,
        monto=saldo_actual,
        origen_tipo="credito",
        origen_id=credito_id,
        nota=motivo,
        id_usuario=data.id_usuario,
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=data.id_usuario,
        id_sucursal=None,
        entidad=AUDITORIA_ENTIDAD_CREDITO,
        entidad_id=credito_id,
        accion=AUDITORIA_ACCION_CREDITO_ANULADO_ADMINISTRATIVO,
        detalle=(
            f"Crédito anulado administrativamente. monto={saldo_actual}, "
            f"saldo_nuevo=0.00, motivo={motivo}"
        ),
        metadata={
            "tipo": "credito_anulado_administrativo",
            "credito_id": credito_id,
            "monto_anulado": str(saldo_actual),
            "saldo_anterior": str(saldo_actual),
            "saldo_nuevo": "0.00",
            "estado_nuevo": CREDITO_ESTADO_ANULADO,
            "motivo": motivo,
            "genera_movimiento_caja": False,
        },
        origen_tipo="credito",
        origen_id=credito_id,
    )

    return {
        "ok": True,
        "credito_id": credito_id,
        "saldo_anulado": saldo_actual,
        "saldo_actual": credito_actualizado["saldo_actual"],
        "estado": credito_actualizado["estado"],
    }

def reintegrar_credito_endpoint(credito_id: int, data):
    from app.db.connection import get_connection

    conn = get_connection()
    try:
        with conn.transaction():
            return reintegrar_credito(conn, credito_id, data)
    finally:
        conn.close()
        
def listar_creditos_disponibles_cliente(conn, id_cliente: int):
    return repository.get_creditos_disponibles_cliente(conn, id_cliente)

def crear_credito_por_devolucion_venta(
    conn,
    *,
    id_cliente: int,
    id_venta: int,
    monto_credito: Decimal,
    id_usuario: int,
):
    monto_credito = Decimal(str(monto_credito))

    if monto_credito <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto del crédito debe ser mayor a 0",
        )

    credito_existente = repository.get_credito_abierto_by_origen_for_update(
        conn,
        origen_tipo=ORIGEN_VENTA,
        origen_id=id_venta,
    )
    if credito_existente:
        nuevo_saldo = redondear_monto(
            Decimal(str(credito_existente["saldo_actual"])) + monto_credito
        )
        credito = repository.update_credito_saldo_y_estado(
            conn,
            credito_id=credito_existente["id"],
            saldo_actual=nuevo_saldo,
            estado=CREDITO_ESTADO_ABIERTO,
        )
    else:
        credito = repository.insert_credito_cliente(
            conn,
            id_cliente=id_cliente,
            origen_tipo=ORIGEN_VENTA,
            origen_id=id_venta,
            saldo_actual=monto_credito,
            observacion=f"Crédito generado por devolución de venta #{id_venta}",
        )

    repository.insert_credito_movimiento(
        conn,
        id_credito=credito["id"],
        tipo_movimiento=CREDITO_MOVIMIENTO_GENERADO,
        monto=monto_credito,
        origen_tipo=ORIGEN_VENTA,
        origen_id=id_venta,
        nota=f"Crédito generado por devolución de venta #{id_venta}",
        id_usuario=id_usuario,
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=None,
        entidad=AUDITORIA_ENTIDAD_CREDITO,
        entidad_id=credito["id"],
        accion=AUDITORIA_ACCION_CREDITO_GENERADO,
        detalle=(
            f"Crédito generado por devolución de venta. "
            f"cliente={id_cliente}, venta_id={id_venta}, monto={monto_credito}"
        ),
        metadata={
            "tipo": "credito_generado_por_devolucion",
            "credito_id": credito["id"],
            "venta_id": id_venta,
            "cliente_id": id_cliente,
            "monto_credito": str(monto_credito),
            "origen": "devolucion_venta",
        },
        origen_tipo="venta",
        origen_id=id_venta,
    )

    return credito

def simular_aplicacion_credito_a_venta(
    conn,
    *,
    id_cliente: int | None,
    total_a_cubrir: Decimal,
    usar_credito: bool,
    monto_credito_a_aplicar: Decimal | None,
):
    total_a_cubrir = redondear_monto(total_a_cubrir)

    if not usar_credito or not id_cliente or total_a_cubrir <= Decimal("0"):
        return {
            "credito_disponible": Decimal("0"),
            "credito_aplicado": Decimal("0"),
            "monto_base_cubierto": Decimal("0"),
            "descuento_aplicado": Decimal("0"),
            "total_a_cobrar": total_a_cubrir,
            "saldo_credito_restante": Decimal("0"),
        }

    creditos = repository.get_creditos_disponibles_cliente(conn, id_cliente)

    credito_disponible = redondear_monto(
        sum(
            (Decimal(str(c["saldo_actual"])) for c in creditos),
            Decimal("0"),
        )
    )

    aplicacion = _calcular_aplicacion_credito(
        conn,
        credito_disponible=credito_disponible,
        saldo_base=total_a_cubrir,
        monto_credito_solicitado=monto_credito_a_aplicar,
    )
    credito_aplicado = aplicacion["credito_aplicado"]
    monto_base_cubierto = aplicacion["monto_base_cubierto"]

    return {
        "credito_disponible": credito_disponible,
        "credito_aplicado": credito_aplicado,
        "monto_base_cubierto": monto_base_cubierto,
        "descuento_aplicado": aplicacion["descuento_aplicado"],
        "total_a_cobrar": redondear_monto(
            total_a_cubrir - monto_base_cubierto
        ),
        "saldo_credito_restante": redondear_monto(
            credito_disponible - credito_aplicado
        ),
    }
