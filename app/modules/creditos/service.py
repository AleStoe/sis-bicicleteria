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
    CREDITO_MOVIMIENTO_REINTEGRO,
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
        id_sucursal=None,
        entidad=AUDITORIA_ENTIDAD_CREDITO,
        entidad_id=credito["id"],
        accion=AUDITORIA_ACCION_CREDITO_GENERADO,
        detalle=(
            f"Crédito generado por anulación de venta. "
            f"cliente={id_cliente}, venta_id={id_venta}, monto={monto_credito}"
        ),
    )

    return credito


def obtener_credito_detalle(conn, credito_id: int):
    credito = repository.get_credito_by_id(conn, credito_id)

    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")

    movimientos = repository.get_credito_movimientos(conn, credito_id)

    return {
        "credito": credito,
        "movimientos": movimientos,
    }


def listar_creditos_cliente(conn, id_cliente: int):
    return repository.get_creditos_cliente(conn, id_cliente)


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
    total_venta = Decimal(str(total_venta))

    if not usar_credito:
        return {
            "credito_aplicado_total": Decimal("0"),
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
            "movimientos": [],
        }

    credito_disponible_total = sum(
        Decimal(str(c["saldo_actual"])) for c in creditos
    )

    if monto_credito_a_aplicar is None:
        monto_objetivo = min(total_venta, credito_disponible_total)
    else:
        monto_objetivo = Decimal(str(monto_credito_a_aplicar))

    if monto_objetivo < Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto de crédito a aplicar no puede ser negativo",
        )

    if monto_objetivo == Decimal("0"):
        return {
            "credito_aplicado_total": Decimal("0"),
            "movimientos": [],
        }

    if monto_objetivo > total_venta:
        raise HTTPException(
            status_code=400,
            detail="El crédito no puede superar el total de la venta",
        )

    if monto_objetivo > credito_disponible_total:
        raise HTTPException(
            status_code=400,
            detail="El cliente no tiene crédito suficiente",
        )

    restante = monto_objetivo
    movimientos = []

    for credito in creditos:
        if restante <= Decimal("0"):
            break

        saldo_actual = Decimal(str(credito["saldo_actual"]))
        if saldo_actual <= Decimal("0"):
            continue

        aplicado = min(saldo_actual, restante)
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
            origen_tipo=ORIGEN_VENTA,
            origen_id=id_venta,
            nota=f"Crédito aplicado a venta #{id_venta}",
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
        )

        movimientos.append(movimiento)
        restante -= aplicado

    return {
        "credito_aplicado_total": monto_objetivo,
        "movimientos": movimientos,
    }

def reintegrar_credito(conn, credito_id: int, data):
    exigir_permiso_reintegrar_credito(conn, data.id_usuario)

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
    )

    return {
        "ok": True,
        "credito_id": credito_id,
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