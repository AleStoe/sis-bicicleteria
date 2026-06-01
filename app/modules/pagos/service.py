from decimal import Decimal

from fastapi import HTTPException

from app.shared.money import redondear_monto
from app.db.connection import get_connection
from app.modules.authz.service import exigir_permiso_revertir_pago
from app.modules.auditoria import service as auditoria_service
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)
from app.modules.reglas_comerciales.schema import PagoSimulacionInput
from app.modules.reglas_comerciales.service import _simular_con_conn

from .repository import (
    get_pago_by_id_for_update,
    get_reversion_by_pago_original,
    get_venta_for_update,
    get_pagos,
    insert_pago,
    insert_pago_reversion_relacion,
    obtener_pagos_por_venta,
    update_pago_estado,
    update_venta_saldo_y_estado,
    insert_pago_tarjeta_detalle,
)

from app.shared.constants import (
    MEDIOS_PAGO_VALIDOS,
    ORIGENES_PAGO_VALIDOS,
    ORIGEN_VENTA,
    VENTA_ESTADO_CREADA,
    VENTA_ESTADO_ANULADA,
    VENTA_ESTADO_ENTREGADA,
    VENTA_ESTADO_PAGADA_TOTAL,
    VENTA_ESTADO_PAGADA_PARCIAL,
    PAGO_ESTADO_REVERTIDO,
    AUDITORIA_ENTIDAD_PAGO,
    AUDITORIA_ACCION_PAGO_REGISTRADO,
    AUDITORIA_ACCION_PAGO_REVERTIDO,
    CAJA_MOVIMIENTO_INGRESO,
    CAJA_MOVIMIENTO_EGRESO,
    CAJA_ORIGEN_PAGO,
)


def _obtener_caja_abierta_obligatoria(conn, id_sucursal: int):
    caja = get_caja_abierta_hoy_by_sucursal_for_update(conn, id_sucursal)

    if caja is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No hay caja abierta para la sucursal {id_sucursal}. "
                "Abrí caja antes de registrar pagos"
            ),
        )

    return caja


def _to_decimal(value) -> Decimal | None:
    if value is None:
        return None

    if isinstance(value, Decimal):
        return value

    return Decimal(str(value))


def _calcular_tramo_pago_venta(conn, data: dict):
    """
    V2:
    Si viene monto_base, se calcula un tramo financiero.
    Si solo viene monto, se mantiene compatibilidad vieja: monto = cobrado real.
    """

    medio_pago = data["medio_pago"]

    monto_base = _to_decimal(data.get("monto_base"))

    if monto_base is None:
        monto_cobrado = redondear_monto(_to_decimal(data.get("monto")))

        return {
            "medio_pago": medio_pago,
            "monto_base_aplicado": monto_cobrado,
            "descuento_aplicado": Decimal("0.00"),
            "recargo_aplicado": Decimal("0.00"),
            "monto_total_cobrado": monto_cobrado,
            "cuotas": data.get("cuotas"),
            "entidad": data.get("entidad"),
            "id_tarjeta_plan": data.get("id_tarjeta_plan"),
            "porcentaje_recargo_aplicado": data.get("porcentaje_recargo_aplicado"),
        }

    monto_base = redondear_monto(monto_base)

    pago_simulado = PagoSimulacionInput(
        medio_pago=medio_pago,
        monto_base=monto_base,
        cuotas=data.get("cuotas"),
        entidad=data.get("entidad"),
        nota=data.get("nota"),
    )

    simulacion = _simular_con_conn(
        conn,
        subtotal_base=monto_base,
        pagos=[pago_simulado],
    )

    tramo = simulacion["tramos_pago"][0]

    return {
        "medio_pago": tramo["medio_pago"],
        "monto_base_aplicado": redondear_monto(tramo["monto_base_aplicado"]),
        "descuento_aplicado": redondear_monto(tramo["descuento_aplicado"]),
        "recargo_aplicado": redondear_monto(tramo["recargo_aplicado"]),
        "monto_total_cobrado": redondear_monto(tramo["monto_total_cobrado"]),
        "cuotas": tramo.get("cuotas"),
        "entidad": tramo.get("entidad"),
        "id_tarjeta_plan": tramo.get("id_tarjeta_plan"),
        "porcentaje_recargo_aplicado": tramo.get("porcentaje_recargo_aplicado"),
    }


def calcular_tramo_financiero_pago(conn, data: dict):
    """
    Helper público para cualquier origen de pago.
    Mantiene una única fuente de verdad para descuentos/recargos.
    """
    return _calcular_tramo_pago_venta(conn, data)


def _calcular_monto_caja_para_pago(medio_pago: str, tramo: dict) -> Decimal:
    """
    Monto que impacta caja como ingreso/egreso real.

    Para tarjeta, el recargo financiero lo paga el cliente pero no representa
    plata neta para el local; por eso caja debe tomar la base cubierta.
    Para efectivo/transferencia/MP, caja toma el total cobrado luego de reglas.
    """

    if medio_pago == "tarjeta":
        return redondear_monto(tramo["monto_base_aplicado"])

    return redondear_monto(tramo["monto_total_cobrado"])


def _nota_caja_pago(origen_label: str, medio_pago: str, tramo: dict) -> str:
    if medio_pago != "tarjeta":
        return origen_label

    return (
        f"{origen_label} | tarjeta neto_caja={redondear_monto(tramo['monto_base_aplicado'])} "
        f"recargo_financiero={redondear_monto(tramo['recargo_aplicado'])} "
        f"total_cliente={redondear_monto(tramo['monto_total_cobrado'])}"
    )


def resolver_tramo_financiero_para_cobrado_objetivo(
    conn,
    *,
    medio_pago: str,
    monto_cobrado_objetivo,
    maximo_base,
    cuotas=None,
    entidad=None,
    nota=None,
):
    objetivo = redondear_monto(_to_decimal(monto_cobrado_objetivo))
    maximo_base = redondear_monto(_to_decimal(maximo_base))

    if objetivo <= 0:
        raise HTTPException(
            status_code=400,
            detail="El cobrado objetivo debe ser mayor a 0",
        )

    tramo_referencia = calcular_tramo_financiero_pago(
        conn,
        {
            "medio_pago": medio_pago,
            "monto_base": objetivo,
            "cuotas": cuotas,
            "entidad": entidad,
            "nota": nota,
        },
    )

    descuento_ref = redondear_monto(tramo_referencia["descuento_aplicado"])
    recargo_ref = redondear_monto(tramo_referencia["recargo_aplicado"])

    factor = Decimal("1")

    if descuento_ref > 0:
        factor = Decimal("1") - (descuento_ref / objetivo)

    if recargo_ref > 0:
        factor = Decimal("1") + (recargo_ref / objetivo)

    if factor <= 0:
        raise HTTPException(
            status_code=500,
            detail="Factor financiero inválido para simular pago",
        )

    base_calculada = redondear_monto(objetivo / factor)

    if base_calculada > maximo_base:
        raise HTTPException(
            status_code=400,
            detail="La base necesaria para ese cobrado objetivo supera el saldo pendiente",
        )

    tramo = calcular_tramo_financiero_pago(
        conn,
        {
            "medio_pago": medio_pago,
            "monto_base": base_calculada,
            "cuotas": cuotas,
            "entidad": entidad,
            "nota": nota,
        },
    )

    cobrado = redondear_monto(tramo["monto_total_cobrado"])
    diferencia = redondear_monto(objetivo - cobrado)

    # Ajuste de centavos: si por redondeo quedó a 0,01,
    # corregimos la base en el sentido necesario.
    if abs(diferencia) <= Decimal("0.01") and diferencia != 0:
        tramo = calcular_tramo_financiero_pago(
            conn,
            {
                "medio_pago": medio_pago,
                "monto_base": redondear_monto(base_calculada + diferencia),
                "cuotas": cuotas,
                "entidad": entidad,
                "nota": nota,
            },
        )

    return tramo


def registrar_pago(conn, data: dict):
    medio_pago = data["medio_pago"]
    origen_tipo = data["origen_tipo"]

    if medio_pago not in MEDIOS_PAGO_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Medio de pago inválido: {medio_pago}",
        )

    if origen_tipo not in ORIGENES_PAGO_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Origen de pago inválido: {origen_tipo}",
        )

    # =====================================================
    # CASO 1: PAGO DE VENTA
    # =====================================================
    if origen_tipo == ORIGEN_VENTA:
        venta = get_venta_for_update(conn, data["origen_id"])

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {data['origen_id']}",
            )

        if venta["estado"] == VENTA_ESTADO_ANULADA:
            raise HTTPException(
                status_code=400,
                detail=f"La venta {venta['id']} está anulada y no puede recibir pagos",
            )

        if venta["estado"] == VENTA_ESTADO_ENTREGADA:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"La venta {venta['id']} ya fue entregada. "
                    "Si tiene saldo pendiente, registrá el pago sobre la deuda correspondiente"
                ),
            )

        saldo_pendiente = redondear_monto(venta["saldo_pendiente"])

        if saldo_pendiente <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"La venta {venta['id']} no tiene saldo pendiente",
            )

        tramo = _calcular_tramo_pago_venta(conn, data)

        monto = redondear_monto(tramo["monto_total_cobrado"])
        monto_base_aplicado = redondear_monto(tramo["monto_base_aplicado"])
        monto_caja = _calcular_monto_caja_para_pago(medio_pago, tramo)

        if monto <= 0:
            raise HTTPException(
                status_code=400,
                detail="El monto del pago debe ser mayor a 0",
            )

        if monto > saldo_pendiente:
            raise HTTPException(
                status_code=400,
                detail="El monto cobrado del tramo supera el saldo pendiente",
            )

        caja = _obtener_caja_abierta_obligatoria(conn, venta["id_sucursal"])

        saldo_restante = redondear_monto(saldo_pendiente - monto)

        # Tolerancia financiera por redondeo de centavos.
        # Evita que queden ventas en pagada_parcial por $0.01.
        if abs(saldo_restante) <= Decimal("0.01"):
            saldo_restante = Decimal("0.00")

        nuevo_estado = (
            VENTA_ESTADO_PAGADA_TOTAL
            if saldo_restante == 0
            else VENTA_ESTADO_PAGADA_PARCIAL
        )

        pago_id = insert_pago(
            conn,
            {
                "id_cliente": venta["id_cliente"],
                "origen_tipo": ORIGEN_VENTA,
                "origen_id": venta["id"],
                "medio_pago": medio_pago,
                "monto_total_cobrado": monto,
                "monto_base_aplicado": tramo["monto_base_aplicado"],
                "monto_descuento_aplicado": tramo["descuento_aplicado"],
                "monto_recargo_aplicado": tramo["recargo_aplicado"],
                "nota": data.get("nota"),
                "id_usuario": data["id_usuario"],
            },
        )

        if medio_pago == "tarjeta":
            cuotas = tramo.get("cuotas") or data.get("cuotas") or 1
            entidad = tramo.get("entidad") or data.get("entidad") or "Sin especificar"

            insert_pago_tarjeta_detalle(
                conn,
                {
                    "id_pago": pago_id,
                    "monto_base": tramo["monto_base_aplicado"],
                    "monto_recargo_financiero": tramo["recargo_aplicado"],
                    "monto_neto_liquidado": monto_caja,
                    "cuotas": cuotas,
                    "entidad": entidad,
                    "observacion": data.get("nota"),
                    "id_tarjeta_plan": tramo.get("id_tarjeta_plan"),
                    "porcentaje_recargo_aplicado": tramo.get("porcentaje_recargo_aplicado"),
                },
            )

        insert_caja_movimiento(
            conn,
            id_caja=caja["id"],
            tipo_movimiento=CAJA_MOVIMIENTO_INGRESO,
            submedio=medio_pago,
            monto=monto_caja,
            origen_tipo=CAJA_ORIGEN_PAGO,
            origen_id=pago_id,
            nota=_nota_caja_pago(f"Pago venta #{venta['id']}", medio_pago, tramo),
            id_usuario=data["id_usuario"],
        )

        update_venta_saldo_y_estado(
            conn,
            venta["id"],
            saldo_restante,
            nuevo_estado,
        )

        auditoria_service.registrar_evento(
            conn,
            id_usuario=data["id_usuario"],
            id_sucursal=venta["id_sucursal"],
            entidad=AUDITORIA_ENTIDAD_PAGO,
            entidad_id=pago_id,
            accion=AUDITORIA_ACCION_PAGO_REGISTRADO,
            detalle=(
                f"Pago registrado para venta #{venta['id']}. "
                f"medio={medio_pago}, "
                f"base={tramo['monto_base_aplicado']}, "
                f"descuento={tramo['descuento_aplicado']}, "
                f"recargo={tramo['recargo_aplicado']}, "
                f"cobrado={monto}, "
                f"saldo_restante={saldo_restante}, "
                f"estado_venta={nuevo_estado}"
            ),
            metadata={
                "tipo": "pago_venta_registrado",
                "pago_id": pago_id,
                "venta_id": venta["id"],
                "cliente_id": venta["id_cliente"],
                "medio_pago": medio_pago,
                "monto_base_aplicado": str(tramo["monto_base_aplicado"]),
                "monto_descuento_aplicado": str(tramo["descuento_aplicado"]),
                "monto_recargo_aplicado": str(tramo["recargo_aplicado"]),
                "monto_total_cobrado": str(monto),
                "monto_caja": str(monto_caja),
                "saldo_restante": str(saldo_restante),
                "estado_venta": nuevo_estado,
            },
            origen_tipo="venta",
            origen_id=venta["id"],
        )

        return {
            "ok": True,
            "pago_id": pago_id,
            "origen_tipo": ORIGEN_VENTA,
            "origen_id": venta["id"],
            "venta_id": venta["id"],
            "estado_venta": nuevo_estado,
            "saldo_restante": saldo_restante,
        }

    # =====================================================
    # CASO 2: PAGO DE RESERVA / DEUDA / OTROS ORÍGENES
    # Si viene monto_base, usa motor financiero.
    # Si solo viene monto, mantiene compatibilidad legacy: monto = cobrado real.
    # =====================================================

    if "id_sucursal" not in data:
        raise HTTPException(
            status_code=400,
            detail="id_sucursal es obligatorio para pagos que no sean de venta",
        )

    id_sucursal = data["id_sucursal"]
    caja = _obtener_caja_abierta_obligatoria(conn, id_sucursal)

    if data.get("monto_base") is not None:
        tramo = calcular_tramo_financiero_pago(conn, data)

        monto = redondear_monto(tramo["monto_total_cobrado"])
        monto_base_aplicado = redondear_monto(tramo["monto_base_aplicado"])
        descuento_aplicado = redondear_monto(tramo["descuento_aplicado"])
        recargo_aplicado = redondear_monto(tramo["recargo_aplicado"])
    else:
        monto = redondear_monto(_to_decimal(data.get("monto")))
        monto_base_aplicado = monto
        descuento_aplicado = Decimal("0.00")
        recargo_aplicado = Decimal("0.00")
        tramo = {
            "monto_base_aplicado": monto_base_aplicado,
            "descuento_aplicado": descuento_aplicado,
            "recargo_aplicado": recargo_aplicado,
            "monto_total_cobrado": monto,
            "cuotas": data.get("cuotas"),
            "entidad": data.get("entidad"),
            "id_tarjeta_plan": data.get("id_tarjeta_plan"),
            "porcentaje_recargo_aplicado": data.get("porcentaje_recargo_aplicado"),
        }

    monto_caja = _calcular_monto_caja_para_pago(medio_pago, tramo)

    if monto <= 0:
        raise HTTPException(
            status_code=400,
            detail="El monto del pago debe ser mayor a 0",
        )

    pago_id = insert_pago(
        conn,
        {
            "id_cliente": data.get("id_cliente"),
            "origen_tipo": origen_tipo,
            "origen_id": data["origen_id"],
            "medio_pago": medio_pago,
            "monto_total_cobrado": monto,
            "monto_base_aplicado": monto_base_aplicado,
            "monto_descuento_aplicado": descuento_aplicado,
            "monto_recargo_aplicado": recargo_aplicado,
            "nota": data.get("nota"),
            "id_usuario": data["id_usuario"],
        },
    )

    if medio_pago == "tarjeta":
        cuotas = tramo.get("cuotas") or data.get("cuotas") or 1
        entidad = tramo.get("entidad") or data.get("entidad") or "Sin especificar"

        insert_pago_tarjeta_detalle(
            conn,
            {
                "id_pago": pago_id,
                "monto_base": monto_base_aplicado,
                "monto_recargo_financiero": recargo_aplicado,
                "monto_neto_liquidado": monto_caja,
                "cuotas": cuotas,
                "entidad": entidad,
                "observacion": data.get("nota"),
                "id_tarjeta_plan": tramo.get("id_tarjeta_plan"),
                "porcentaje_recargo_aplicado": tramo.get("porcentaje_recargo_aplicado"),
            },
        )

    insert_caja_movimiento(
        conn,
        id_caja=caja["id"],
        tipo_movimiento=CAJA_MOVIMIENTO_INGRESO,
        submedio=medio_pago,
        monto=monto_caja,
        origen_tipo=CAJA_ORIGEN_PAGO,
        origen_id=pago_id,
        nota=_nota_caja_pago(f"Pago {origen_tipo} #{data['origen_id']}", medio_pago, tramo),
        id_usuario=data["id_usuario"],
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=data["id_usuario"],
        id_sucursal=id_sucursal,
        entidad=AUDITORIA_ENTIDAD_PAGO,
        entidad_id=pago_id,
        accion=AUDITORIA_ACCION_PAGO_REGISTRADO,
        detalle=(
            f"Pago registrado. origen_tipo={origen_tipo}, "
            f"origen_id={data['origen_id']}, medio={medio_pago}, "
            f"base={monto_base_aplicado}, descuento={descuento_aplicado}, "
            f"recargo={recargo_aplicado}, cobrado={monto}"
        ),
        metadata={
            "tipo": "pago_registrado",
            "pago_id": pago_id,
            "origen_tipo": origen_tipo,
            "origen_id": data["origen_id"],
            "id_cliente": data.get("id_cliente"),
            "medio_pago": medio_pago,
            "monto_base_aplicado": str(monto_base_aplicado),
            "monto_descuento_aplicado": str(descuento_aplicado),
            "monto_recargo_aplicado": str(recargo_aplicado),
            "monto_total_cobrado": str(monto),
            "monto_caja": str(monto_caja),
        },
        origen_tipo=origen_tipo,
        origen_id=data["origen_id"],
    )

    return {
        "ok": True,
        "pago_id": pago_id,
        "origen_tipo": origen_tipo,
        "origen_id": data["origen_id"],
        "monto_base_aplicado": monto_base_aplicado,
        "descuento_aplicado": descuento_aplicado,
        "recargo_aplicado": recargo_aplicado,
        "monto_total_cobrado": monto,
        "monto_caja": monto_caja,
    }


def crear_pago(data):
    conn = get_connection()

    try:
        with conn.transaction():
            payload = {
                "id_cliente": getattr(data, "id_cliente", None),
                "origen_tipo": data.origen_tipo,
                "origen_id": data.origen_id,
                "medio_pago": data.medio_pago,
                "monto": getattr(data, "monto", None),
                "monto_base": getattr(data, "monto_base", None),
                "monto_cobrado_objetivo": getattr(data, "monto_cobrado_objetivo", None),
                "nota": data.nota,
                "id_usuario": data.id_usuario,
                "cuotas": getattr(data, "cuotas", None),
                "entidad": getattr(data, "entidad", None),
                "monto_recargo_financiero": getattr(data, "monto_recargo_financiero", None),
                "monto_neto_liquidado": getattr(data, "monto_neto_liquidado", None),
                "id_tarjeta_plan": getattr(data, "id_tarjeta_plan", None),
                "porcentaje_recargo_aplicado": getattr(data, "porcentaje_recargo_aplicado", None),
            }

            if getattr(data, "id_sucursal", None) is not None:
                payload["id_sucursal"] = data.id_sucursal

            return registrar_pago(conn, payload)

    finally:
        conn.close()


def revertir_pago(pago_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_permiso_revertir_pago(conn, data.id_usuario)

            pago_original = get_pago_by_id_for_update(conn, pago_id)

            if pago_original is None:
                raise HTTPException(status_code=404, detail=f"No existe el pago {pago_id}")

            if pago_original["origen_tipo"] != ORIGEN_VENTA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo está implementada la reversión de pagos de venta",
                )

            if pago_original["estado"] == PAGO_ESTADO_REVERTIDO:
                raise HTTPException(status_code=400, detail=f"El pago {pago_id} ya fue revertido")

            reversion_existente = get_reversion_by_pago_original(conn, pago_id)

            if reversion_existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"El pago {pago_id} ya tiene una reversión registrada",
                )

            venta = get_venta_for_update(conn, pago_original["origen_id"])

            if venta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la venta {pago_original['origen_id']}",
                )

            if venta["estado"] == VENTA_ESTADO_ENTREGADA:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede revertir un pago de una venta ya entregada",
                )

            saldo_pendiente = redondear_monto(venta["saldo_pendiente"])
            monto_original = redondear_monto(pago_original["monto_total_cobrado"])
            tramo_original = {
                "monto_base_aplicado": redondear_monto(pago_original["monto_base_aplicado"]),
                "descuento_aplicado": redondear_monto(pago_original["monto_descuento_aplicado"]),
                "recargo_aplicado": redondear_monto(pago_original["monto_recargo_aplicado"]),
                "monto_total_cobrado": monto_original,
            }
            monto_reversion_caja = _calcular_monto_caja_para_pago(
                pago_original["medio_pago"],
                tramo_original,
            )
            total_final = redondear_monto(venta["total_final"])

            saldo_restante = redondear_monto(
                saldo_pendiente + tramo_original["monto_total_cobrado"]
            )

            if saldo_restante > total_final:
                raise HTTPException(
                    status_code=500,
                    detail="Inconsistencia en cálculo de saldo tras reversión",
                )

            nuevo_estado = (
                VENTA_ESTADO_CREADA
                if saldo_restante == total_final
                else VENTA_ESTADO_PAGADA_PARCIAL
            )

            caja = _obtener_caja_abierta_obligatoria(conn, venta["id_sucursal"])

            pago_reversion_id = insert_pago(
                conn,
                {
                    "id_cliente": pago_original["id_cliente"],
                    "origen_tipo": ORIGEN_VENTA,
                    "origen_id": venta["id"],
                    "medio_pago": pago_original["medio_pago"],
                    "monto_total_cobrado": pago_original["monto_total_cobrado"],
                    "monto_base_aplicado": pago_original["monto_base_aplicado"],
                    "monto_descuento_aplicado": pago_original["monto_descuento_aplicado"],
                    "monto_recargo_aplicado": pago_original["monto_recargo_aplicado"],
                    "nota": f"Reversión de pago #{pago_original['id']}: {data.motivo}",
                    "id_usuario": data.id_usuario,
                },
            )

            reversion_id = insert_pago_reversion_relacion(
                conn,
                id_pago_original=pago_original["id"],
                id_pago_reversion=pago_reversion_id,
                motivo=data.motivo,
            )

            update_pago_estado(conn, pago_original["id"], PAGO_ESTADO_REVERTIDO)
            update_pago_estado(conn, pago_reversion_id, PAGO_ESTADO_REVERTIDO)

            insert_caja_movimiento(
                conn,
                id_caja=caja["id"],
                tipo_movimiento=CAJA_MOVIMIENTO_EGRESO,
                submedio=pago_original["medio_pago"],
                monto=monto_reversion_caja,
                origen_tipo="pago_reversion",
                origen_id=reversion_id,
                nota=f"Reversión pago #{pago_original['id']} venta #{venta['id']}",
                id_usuario=data.id_usuario,
            )

            update_venta_saldo_y_estado(
                conn,
                venta["id"],
                saldo_restante,
                nuevo_estado,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_PAGO,
                entidad_id=pago_original["id"],
                accion=AUDITORIA_ACCION_PAGO_REVERTIDO,
                detalle=(
                    f"Pago revertido. pago_original={pago_original['id']}, "
                    f"pago_reversion={pago_reversion_id}, "
                    f"motivo={data.motivo}"
                ),
                metadata={
                    "tipo": "pago_revertido",
                    "pago_original_id": pago_original["id"],
                    "pago_reversion_id": pago_reversion_id,
                    "reversion_id": reversion_id,
                    "venta_id": venta["id"],
                    "cliente_id": venta["id_cliente"],
                    "medio_pago": pago_original["medio_pago"],
                    "monto": str(monto_original),
                    "monto_caja": str(monto_reversion_caja),
                    "saldo_pendiente_anterior": str(saldo_pendiente),
                    "saldo_pendiente_nuevo": str(saldo_restante),
                    "estado_venta_nuevo": nuevo_estado,
                    "motivo": data.motivo,
                },
                origen_tipo="venta",
                origen_id=venta["id"],
            )

        return {
            "ok": True,
            "pago_id_original": pago_original["id"],
            "pago_id_reversion": pago_reversion_id,
            "venta_id": venta["id"],
            "estado_venta": nuevo_estado,
            "saldo_restante": saldo_restante,
            "reversion_id": reversion_id,
        }

    finally:
        conn.close()


def listar_pagos():
    conn = get_connection()

    try:
        return get_pagos(conn)
    finally:
        conn.close()


def obtener_pagos_venta(venta_id: int):
    conn = get_connection()

    try:
        return obtener_pagos_por_venta(conn, venta_id)
    finally:
        conn.close()

def simular_pago_venta(data):
    conn = get_connection()

    try:
        venta = get_venta_for_update(conn, data.venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {data.venta_id}",
            )

        saldo_pendiente = redondear_monto(venta["saldo_pendiente"])

        if saldo_pendiente <= 0:
            raise HTTPException(
                status_code=400,
                detail="La venta no tiene saldo pendiente",
            )

        if data.monto_cobrado_objetivo is not None:
            tramo = _resolver_base_para_cobrado_objetivo(
                conn,
                data,
                saldo_pendiente,
            )
        else:
            tramo = _calcular_tramo_pago_venta(
                conn,
                {
                    "medio_pago": data.medio_pago,
                    "monto_base": data.monto_base,
                    "cuotas": data.cuotas,
                    "entidad": data.entidad,
                },
            )

        monto_total_cobrado = redondear_monto(
            tramo["monto_total_cobrado"]
        )

        saldo_restante_estimado = redondear_monto(
            saldo_pendiente - monto_total_cobrado
        )

        # Tolerancia financiera por redondeo.
        # Evita saldos residuales de 0.01 / -0.01
        if abs(saldo_restante_estimado) <= Decimal("0.01"):
            saldo_restante_estimado = Decimal("0.00")

        return {
            "medio_pago": tramo["medio_pago"],
            "monto_base_aplicado": tramo["monto_base_aplicado"],
            "descuento_aplicado": tramo["descuento_aplicado"],
            "recargo_aplicado": tramo["recargo_aplicado"],
            "monto_total_cobrado": monto_total_cobrado,
            "saldo_pendiente_actual": saldo_pendiente,
            "saldo_restante_estimado": saldo_restante_estimado,
            "cuotas": tramo.get("cuotas"),
            "entidad": tramo.get("entidad"),
            "id_tarjeta_plan": tramo.get("id_tarjeta_plan"),
            "porcentaje_recargo_aplicado": tramo.get(
                "porcentaje_recargo_aplicado"
            ),
        }

    finally:
        conn.close()

def _resolver_base_para_cobrado_objetivo(conn, data, saldo_pendiente):
    objetivo = redondear_monto(data.monto_cobrado_objetivo)

    if objetivo > saldo_pendiente:
        raise HTTPException(
            status_code=400,
            detail="El cobrado objetivo supera el saldo pendiente",
        )

    # Primero simulamos con base = objetivo solo para conocer
    # el factor financiero del medio.
    tramo_referencia = _calcular_tramo_pago_venta(
        conn,
        {
            "medio_pago": data.medio_pago,
            "monto_base": objetivo,
            "cuotas": data.cuotas,
            "entidad": data.entidad,
        },
    )

    descuento_ref = redondear_monto(tramo_referencia["descuento_aplicado"])
    recargo_ref = redondear_monto(tramo_referencia["recargo_aplicado"])

    factor = Decimal("1")

    if descuento_ref > 0:
        factor = Decimal("1") - (descuento_ref / objetivo)

    if recargo_ref > 0:
        factor = Decimal("1") + (recargo_ref / objetivo)

    if factor <= 0:
        raise HTTPException(
            status_code=500,
            detail="Factor financiero inválido para simular pago",
        )

    base_calculada = redondear_monto(objetivo / factor)

    tramo = _calcular_tramo_pago_venta(
        conn,
        {
            "medio_pago": data.medio_pago,
            "monto_base": base_calculada,
            "cuotas": data.cuotas,
            "entidad": data.entidad,
        },
    )

    cobrado = redondear_monto(tramo["monto_total_cobrado"])

    diferencia = redondear_monto(objetivo - cobrado)

    # Ajuste de centavos: si por redondeo quedó a 0,01,
    # corregimos la base en el sentido necesario.
    if abs(diferencia) <= Decimal("0.01") and diferencia != 0:
        tramo = _calcular_tramo_pago_venta(
            conn,
            {
                "medio_pago": data.medio_pago,
                "monto_base": redondear_monto(
                    base_calculada + diferencia
                ),
                "cuotas": data.cuotas,
                "entidad": data.entidad,
            },
        )

    return tramo