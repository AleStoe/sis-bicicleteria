from decimal import Decimal

from fastapi import HTTPException
from psycopg.rows import dict_row
from app.modules.authz.service import exigir_rol_admin
from app.db.connection import get_connection
from app.shared.money import redondear_monto
from app.modules.auditoria import service as auditoria_service
from app.modules.pagos import service as pagos_service
from app.shared.constants import (
    ORIGEN_VENTA,
    ORIGEN_DEUDA_CLIENTE,
    DEUDA_ESTADO_ABIERTA,
    DEUDA_ESTADO_CERRADA,
    DEUDA_MOVIMIENTO_CARGO,
    DEUDA_MOVIMIENTO_PAGO,
    AUDITORIA_ENTIDAD_DEUDA,
    AUDITORIA_ACCION_DEUDA_GENERADA,
    AUDITORIA_ACCION_DEUDA_PAGO_REGISTRADO,
)

from . import repository


def _validar_cliente(conn, id_cliente: int):
    cliente = repository.get_cliente_by_id(conn, id_cliente)

    if cliente is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe el cliente {id_cliente}",
        )

    if not cliente["activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El cliente {id_cliente} está inactivo",
        )

    return cliente


def _validar_venta_para_deuda(conn, id_venta: int, id_cliente: int):
    venta = repository.get_venta_by_id_for_update(conn, id_venta)

    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {id_venta}",
        )

    if venta["id_cliente"] != id_cliente:
        raise HTTPException(
            status_code=400,
            detail="La venta no pertenece al cliente indicado",
        )
    if venta["estado"] != "entregada":
        raise HTTPException(
            status_code=400,
            detail="Solo se puede generar deuda sobre ventas entregadas",
        )

    deuda_existente = repository.get_deuda_abierta_by_origen(
        conn,
        ORIGEN_VENTA,
        id_venta,
    )
    if deuda_existente is not None:
        raise HTTPException(
            status_code=400,
            detail=f"La venta {id_venta} ya tiene una deuda abierta",
        )

    return venta


def crear_deuda_por_venta(data):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_rol_admin(conn, data.id_usuario)

            deuda = crear_deuda_desde_venta_entregada(
                conn,
                id_cliente=data.id_cliente,
                id_venta=data.id_venta,
                monto_inicial=data.monto_inicial,
                id_usuario=data.id_usuario,
                observacion=data.observacion,
            )

        return {
            "ok": True,
            "deuda_id": deuda["id"],
            "estado": deuda["estado"],
            "saldo_actual": deuda["saldo_actual"],
        }
    finally:
        conn.close()


def listar_deudas(
    *,
    q: str | None = None,
    estado: str | None = None,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
):
    conn = get_connection()
    try:
        return repository.get_deudas_filtradas(
            conn,
            q=q,
            estado=estado,
            origen_tipo=origen_tipo,
            origen_id=origen_id,
        )
    finally:
        conn.close()


def obtener_deuda(deuda_id: int):
    conn = get_connection()
    try:
        deuda = repository.get_deuda_detalle_by_id(conn, deuda_id)

        if deuda is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la deuda {deuda_id}",
            )

        movimientos = repository.get_deuda_movimientos(conn, deuda_id)

        origen = None

        if deuda["origen_tipo"] == ORIGEN_VENTA:
            venta = repository.get_venta_origen_by_id(
                conn,
                deuda["origen_id"],
            )

            items = repository.get_venta_items_origen_by_venta_id(
                conn,
                deuda["origen_id"],
            )

            origen = {
                "tipo": ORIGEN_VENTA,
                "venta": venta,
                "items": items,
            }

        return {
            "deuda": deuda,
            "movimientos": movimientos,
            "origen": origen,
        }
    finally:
        conn.close()


def _validar_deuda_pagable(conn, deuda_id: int):
    deuda = repository.get_deuda_by_id_for_update(conn, deuda_id)

    if deuda is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la deuda {deuda_id}",
        )

    if deuda["estado"] != DEUDA_ESTADO_ABIERTA:
        raise HTTPException(
            status_code=400,
            detail=f"La deuda {deuda_id} no está abierta",
        )

    if deuda["origen_tipo"] != ORIGEN_VENTA:
        raise HTTPException(
            status_code=400,
            detail="En este MVP solo se permite pagar deudas originadas en venta",
        )

    venta = repository.get_venta_by_id_for_update(conn, deuda["origen_id"])
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta origen {deuda['origen_id']}",
        )

    return deuda, venta


def _normalizar_payload_pago_deuda(data, *, id_sucursal: int, id_cliente: int, deuda_id: int, tramo: dict):
    """
    Payload hacia pagos_service.

    Regla de estabilidad:
    - monto_base / monto_cobrado_objetivo = flujo nuevo con motor financiero.
    - monto = compatibilidad legacy, se registra como cobrado real sin reglas.

    Esto evita romper endpoints/tests existentes mientras el frontend migra
    al flujo preview -> confirmar con monto_base.
    """

    payload = {
        "id_sucursal": id_sucursal,
        "id_cliente": id_cliente,
        "origen_tipo": ORIGEN_DEUDA_CLIENTE,
        "origen_id": deuda_id,
        "medio_pago": data.medio_pago,
        "nota": data.nota,
        "id_usuario": data.id_usuario,
        "cuotas": getattr(data, "cuotas", None),
        "entidad": getattr(data, "entidad", None),
    }

    if getattr(data, "monto_cobrado_objetivo", None) is not None:
        # El objetivo ya fue resuelto por _calcular_tramo_pago_deuda.
        # A pagos se le manda base para que persista el mismo criterio financiero.
        payload["monto_base"] = redondear_monto(tramo["monto_base_aplicado"])
    elif getattr(data, "monto_base", None) is not None:
        payload["monto_base"] = data.monto_base
    else:
        # Compatibilidad legacy: monto se considera cobrado real, sin reglas.
        payload["monto"] = data.monto

    return payload


def _calcular_tramo_pago_deuda(conn, data, *, saldo_actual):
    saldo_actual = redondear_monto(saldo_actual)

    if getattr(data, "monto_cobrado_objetivo", None) is not None:
        tramo = pagos_service.resolver_tramo_financiero_para_cobrado_objetivo(
            conn,
            medio_pago=data.medio_pago,
            monto_cobrado_objetivo=data.monto_cobrado_objetivo,
            maximo_base=saldo_actual,
            cuotas=getattr(data, "cuotas", None),
            entidad=getattr(data, "entidad", None),
            nota=getattr(data, "nota", None),
        )
    elif getattr(data, "monto_base", None) is not None:
        tramo = pagos_service.calcular_tramo_financiero_pago(
            conn,
            {
                "medio_pago": data.medio_pago,
                "monto_base": data.monto_base,
                "cuotas": getattr(data, "cuotas", None),
                "entidad": getattr(data, "entidad", None),
                "nota": getattr(data, "nota", None),
            },
        )
    else:
        # Compatibilidad legacy: monto era el dinero cobrado real.
        # No se aplican reglas comerciales para no cambiar comportamiento histórico.
        monto = redondear_monto(data.monto)
        tramo = {
            "medio_pago": data.medio_pago,
            "monto_base_aplicado": monto,
            "descuento_aplicado": Decimal("0.00"),
            "recargo_aplicado": Decimal("0.00"),
            "monto_total_cobrado": monto,
            "cuotas": getattr(data, "cuotas", None),
            "entidad": getattr(data, "entidad", None),
            "id_tarjeta_plan": None,
            "porcentaje_recargo_aplicado": None,
        }

    monto_base_aplicado = redondear_monto(tramo["monto_base_aplicado"])
    monto_total_cobrado = redondear_monto(tramo["monto_total_cobrado"])

    if monto_base_aplicado <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto base aplicado debe ser mayor a 0",
        )

    if monto_total_cobrado <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto cobrado debe ser mayor a 0",
        )

    if monto_base_aplicado > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail="El monto base aplicado supera el saldo de la deuda",
        )

    return tramo


def simular_pago_deuda(deuda_id: int, data):
    conn = get_connection()

    try:
        deuda, venta = _validar_deuda_pagable(conn, deuda_id)
        saldo_actual = redondear_monto(deuda["saldo_actual"])

        tramo = _calcular_tramo_pago_deuda(
            conn,
            data,
            saldo_actual=saldo_actual,
        )

        monto_base_aplicado = redondear_monto(tramo["monto_base_aplicado"])
        saldo_restante_estimado = redondear_monto(saldo_actual - monto_base_aplicado)

        if abs(saldo_restante_estimado) <= Decimal("0.01"):
            saldo_restante_estimado = Decimal("0.00")

        estado_estimado = (
            DEUDA_ESTADO_CERRADA
            if saldo_restante_estimado == Decimal("0.00")
            else DEUDA_ESTADO_ABIERTA
        )

        return {
            "deuda_id": deuda_id,
            "venta_id": venta["id"],
            "cliente_id": deuda["id_cliente"],
            "medio_pago": tramo["medio_pago"],
            "monto_base_aplicado": monto_base_aplicado,
            "descuento_aplicado": redondear_monto(tramo["descuento_aplicado"]),
            "recargo_aplicado": redondear_monto(tramo["recargo_aplicado"]),
            "monto_total_cobrado": redondear_monto(tramo["monto_total_cobrado"]),
            "saldo_actual": saldo_actual,
            "saldo_restante_estimado": saldo_restante_estimado,
            "estado_estimado": estado_estimado,
            "cuotas": tramo.get("cuotas"),
            "entidad": tramo.get("entidad"),
            "id_tarjeta_plan": tramo.get("id_tarjeta_plan"),
            "porcentaje_recargo_aplicado": tramo.get("porcentaje_recargo_aplicado"),
        }
    finally:
        conn.close()


def registrar_pago_deuda(deuda_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            deuda, venta = _validar_deuda_pagable(conn, deuda_id)
            saldo_actual = redondear_monto(deuda["saldo_actual"])
            saldo_anterior = saldo_actual

            tramo = _calcular_tramo_pago_deuda(
                conn,
                data,
                saldo_actual=saldo_actual,
            )

            monto_base_aplicado = redondear_monto(tramo["monto_base_aplicado"])
            monto_total_cobrado = redondear_monto(tramo["monto_total_cobrado"])

            payload_pago = _normalizar_payload_pago_deuda(
                data,
                id_sucursal=venta["id_sucursal"],
                id_cliente=deuda["id_cliente"],
                deuda_id=deuda_id,
                tramo=tramo,
            )

            resultado_pago = pagos_service.registrar_pago(conn, payload_pago)
            pago_id = resultado_pago["pago_id"]

            nuevo_saldo = redondear_monto(saldo_actual - monto_base_aplicado)

            # Tolerancia financiera por redondeo de centavos.
            if abs(nuevo_saldo) <= Decimal("0.01"):
                nuevo_saldo = Decimal("0.00")

            nuevo_estado = (
                DEUDA_ESTADO_CERRADA
                if nuevo_saldo == Decimal("0.00")
                else DEUDA_ESTADO_ABIERTA
            )

            repository.insert_deuda_movimiento(
                conn,
                {
                    "id_deuda": deuda_id,
                    "tipo_movimiento": DEUDA_MOVIMIENTO_PAGO,
                    # La deuda se reduce por base cubierta, no por cobrado real.
                    "monto": monto_base_aplicado,
                    "origen_tipo": "pago",
                    "origen_id": pago_id,
                    "nota": data.nota or f"Pago registrado sobre deuda #{deuda_id}",
                    "id_usuario": data.id_usuario,
                },
            )

            repository.update_deuda_saldo_y_estado(
                conn,
                deuda_id=deuda_id,
                saldo_actual=nuevo_saldo,
                estado=nuevo_estado,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_DEUDA,
                entidad_id=deuda_id,
                accion=AUDITORIA_ACCION_DEUDA_PAGO_REGISTRADO,
                detalle=(
                    f"Pago de deuda registrado. "
                    f"base={monto_base_aplicado}, "
                    f"descuento={tramo['descuento_aplicado']}, "
                    f"recargo={tramo['recargo_aplicado']}, "
                    f"cobrado={monto_total_cobrado}, "
                    f"saldo_nuevo={nuevo_saldo}, estado_nuevo={nuevo_estado}"
                ),
                metadata={
                    "tipo": "deuda_pago",
                    "deuda_id": deuda_id,
                    "pago_id": pago_id,
                    "venta_id": venta["id"],
                    "cliente_id": venta["id_cliente"],
                    "medio_pago": tramo["medio_pago"],
                    "monto_base_aplicado": str(monto_base_aplicado),
                    "descuento_aplicado": str(redondear_monto(tramo["descuento_aplicado"])),
                    "recargo_aplicado": str(redondear_monto(tramo["recargo_aplicado"])),
                    "monto_total_cobrado": str(monto_total_cobrado),
                    "saldo_anterior": str(saldo_anterior),
                    "saldo_nuevo": str(nuevo_saldo),
                    "estado_nuevo": nuevo_estado,
                },
                origen_tipo="deuda",
                origen_id=deuda_id,
            )

        return {
            "ok": True,
            "deuda_id": deuda_id,
            "pago_id": pago_id,
            "saldo_actual": nuevo_saldo,
            "estado": nuevo_estado,
            "monto_base_aplicado": monto_base_aplicado,
            "descuento_aplicado": redondear_monto(tramo["descuento_aplicado"]),
            "recargo_aplicado": redondear_monto(tramo["recargo_aplicado"]),
            "monto_total_cobrado": monto_total_cobrado,
        }
    finally:
        conn.close()

def crear_deuda_desde_venta_entregada(
    conn,
    *,
    id_cliente: int,
    id_venta: int,
    monto_inicial,
    id_usuario: int,
    observacion: str | None = None,
):
    monto_inicial = Decimal(str(monto_inicial))

    if monto_inicial <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="El monto inicial de la deuda debe ser mayor a 0",
        )

    _validar_cliente(conn, id_cliente)
    venta = _validar_venta_para_deuda(conn, id_venta, id_cliente)

    deuda = repository.insert_deuda_cliente(
        conn,
        {
            "id_cliente": id_cliente,
            "origen_tipo": ORIGEN_VENTA,
            "origen_id": id_venta,
            "saldo_actual": monto_inicial,
            "genera_recargo": False,
            "tasa_recargo": None,
            "proximo_vencimiento": None,
            "estado": DEUDA_ESTADO_ABIERTA,
            "observacion": observacion,
        },
    )

    repository.insert_deuda_movimiento(
        conn,
        {
            "id_deuda": deuda["id"],
            "tipo_movimiento": DEUDA_MOVIMIENTO_CARGO,
            "monto": monto_inicial,
            "origen_tipo": ORIGEN_VENTA,
            "origen_id": id_venta,
            "nota": f"Deuda generada desde venta #{id_venta}",
            "id_usuario": id_usuario,
        },
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=venta["id_sucursal"],
        entidad=AUDITORIA_ENTIDAD_DEUDA,
        entidad_id=deuda["id"],
        accion=AUDITORIA_ACCION_DEUDA_GENERADA,
        detalle=(
            f"Deuda generada desde venta. "
            f"venta_id={id_venta}, cliente={id_cliente}, monto={monto_inicial}"
        ),
        metadata={
            "tipo": "deuda_generada",
            "deuda_id": deuda["id"],
            "venta_id": id_venta,
            "cliente_id": id_cliente,
            "monto_inicial": str(monto_inicial),
            "saldo_actual": str(monto_inicial),
            "origen": "venta",
        },
        origen_tipo="venta",
        origen_id=id_venta,
    )

    return deuda

def obtener_deuda_abierta_por_origen(conn, *, origen_tipo: str, origen_id: int):
    return repository.get_deuda_abierta_by_origen(
        conn,
        origen_tipo,
        origen_id,
    )

def cancelar_deuda_por_devolucion_venta(
    conn,
    *,
    id_venta: int,
    id_usuario: int,
):
    deuda = repository.get_deuda_abierta_by_origen_for_update(
        conn,
        ORIGEN_VENTA,
        id_venta,
    )

    if deuda is None:
        return {
            "deuda_cancelada": False,
            "deuda_id": None,
            "monto_cancelado": Decimal("0"),
        }

    saldo_actual = Decimal(str(deuda["saldo_actual"]))

    if saldo_actual <= Decimal("0"):
        repository.update_deuda_saldo_y_estado(
            conn,
            deuda_id=deuda["id"],
            saldo_actual=Decimal("0"),
            estado=DEUDA_ESTADO_CERRADA,
        )

        return {
            "deuda_cancelada": True,
            "deuda_id": deuda["id"],
            "monto_cancelado": Decimal("0"),
        }

    repository.insert_deuda_movimiento(
        conn,
        {
            "id_deuda": deuda["id"],
            "tipo_movimiento": DEUDA_MOVIMIENTO_PAGO,
            "monto": saldo_actual,
            "origen_tipo": ORIGEN_VENTA,
            "origen_id": id_venta,
            "nota": f"Deuda cancelada automáticamente por devolución de venta #{id_venta}",
            "id_usuario": id_usuario,
        },
    )

    repository.update_deuda_saldo_y_estado(
        conn,
        deuda_id=deuda["id"],
        saldo_actual=Decimal("0"),
        estado=DEUDA_ESTADO_CERRADA,
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=None,
        entidad=AUDITORIA_ENTIDAD_DEUDA,
        entidad_id=deuda["id"],
        accion="deuda_cancelada_por_devolucion_venta",
        detalle=(
            f"Deuda cancelada por devolución de venta. "
            f"venta_id={id_venta}, deuda_id={deuda['id']}, monto={saldo_actual}"
        ),
        metadata={
            "tipo": "deuda_cancelada_por_devolucion_venta",
            "deuda_id": deuda["id"],
            "venta_id": id_venta,
            "monto_cancelado": str(saldo_actual),
            "estado_nuevo": DEUDA_ESTADO_CERRADA,
        },
        origen_tipo="venta",
        origen_id=id_venta,
    )

    return {
        "deuda_cancelada": True,
        "deuda_id": deuda["id"],
        "monto_cancelado": saldo_actual,
    }