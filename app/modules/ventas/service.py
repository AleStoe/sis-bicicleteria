from decimal import Decimal
from app.modules.pagos import service as pagos_service
from app.shared.money import to_decimal
from fastapi import HTTPException
from app.modules.authz.service import (
    exigir_permiso_anular_venta,
    exigir_permiso_entregar_con_deuda,
)
from app.db.connection import get_connection
from app.modules.stock import service as stock_service
from app.modules.creditos import service as creditos_service
from app.modules.auditoria import service as auditoria_service
from app.modules.pagos.repository import get_total_pagado_confirmado_por_venta
from app.modules.serializadas.repository import (
    get_bicicleta_serializada_for_update,
    update_bicicleta_serializada_estado,
    insert_bicicleta_cliente,    
)
from app.shared.money import redondear_monto
from .repository import (
    get_cliente_by_id,
    get_sucursal_by_id,
    get_variantes_by_ids,
    insert_venta,
    insert_venta_item,
    get_ventas,
    get_venta_by_id,
    get_venta_items_by_venta_id,
    get_venta_items_detallados_by_venta_id,
    get_venta_for_update,
    update_venta_estado,
    update_venta_saldo_y_estado,
    insert_venta_anulacion,
    insert_venta_devolucion,
    get_venta_devolucion_by_venta_item_id,
    insert_venta_item_devolucion,
    get_total_devuelto_by_venta_item_id,
)
from app.shared.constants import (
    AUDITORIA_ENTIDAD_VENTA,
    AUDITORIA_ACCION_VENTA_CREADA,
    AUDITORIA_ACCION_VENTA_ENTREGADA,
    AUDITORIA_ACCION_VENTA_ANULADA,
    VENTA_ESTADO_ANULADA,
    VENTA_ESTADO_ENTREGADA,
    AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA,
    AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA,
    ORIGEN_VENTA,
)
from app.modules.deudas import service as deudas_service

def _consolidar_items(items):
    consolidados = {}

    for item in items:
        id_variante = item["id_variante"]
        cantidad = Decimal(str(item["cantidad"]))
        id_bicicleta_serializada = item.get("id_bicicleta_serializada")

        if cantidad <= 0:
            raise HTTPException(
                status_code=400,
                detail="La cantidad debe ser mayor a 0",
            )

        if id_bicicleta_serializada:
            if cantidad != Decimal("1"):
                raise HTTPException(
                    status_code=400,
                    detail="Un item con bicicleta serializada debe tener cantidad = 1",
                )

            clave = (id_variante, id_bicicleta_serializada)

            if clave in consolidados:
                raise HTTPException(
                    status_code=400,
                    detail="La misma bicicleta serializada no puede repetirse en la venta",
                )

            consolidados[clave] = {
                "id_variante": id_variante,
                "cantidad": cantidad,
                "id_bicicleta_serializada": id_bicicleta_serializada,
            }
            continue

        clave = (id_variante, None)

        if clave not in consolidados:
            consolidados[clave] = {
                "id_variante": id_variante,
                "cantidad": cantidad,
                "id_bicicleta_serializada": None,
            }
        else:
            consolidados[clave]["cantidad"] += cantidad

    return list(consolidados.values())

def _validar_cliente(conn, id_cliente: int):
    cliente = get_cliente_by_id(conn, id_cliente)

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


def _validar_sucursal(conn, id_sucursal: int):
    sucursal = get_sucursal_by_id(conn, id_sucursal)

    if sucursal is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la sucursal {id_sucursal}",
        )

    if not sucursal["activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La sucursal {id_sucursal} está inactiva",
        )

    return sucursal


def _obtener_variantes_map(conn, ids_unicos):
    variantes = get_variantes_by_ids(conn, ids_unicos)
    variantes_map = {v["id"]: v for v in variantes}

    if len(variantes_map) != len(ids_unicos):
        raise HTTPException(
            status_code=400,
            detail="Una o más variantes no existen",
        )

    for variante in variantes:
        if not variante["producto_activo"]:
            raise HTTPException(
                status_code=400,
                detail=f"El producto de la variante {variante['id']} está inactivo",
            )

        if not variante["variante_activa"]:
            raise HTTPException(
                status_code=400,
                detail=f"La variante {variante['id']} está inactiva",
            )

    return variantes_map


def _validar_venta_entregable(venta, venta_id: int):
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    if venta["estado"] == "anulada":
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} está anulada y no se puede entregar",
        )

    if venta["estado"] == "entregada":
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} ya fue entregada",
        )


def _validar_venta_anulable(venta, venta_id: int):
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    estados_anulables = {"creada", "pagada_parcial", "pagada_total"}

    if venta["estado"] not in estados_anulables:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La venta {venta_id} no se puede anular porque está en estado "
                f"'{venta['estado']}'"
            ),
        )


def _validar_y_bloquear_bicicleta_serializada_para_venta(
    conn,
    *,
    id_bicicleta_serializada: int,
    id_variante: int,
    id_sucursal: int,
):
    bicicleta = get_bicicleta_serializada_for_update(conn, id_bicicleta_serializada)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la bicicleta serializada {id_bicicleta_serializada}"
            ),
        )

    if bicicleta["id_variante"] != id_variante:
        raise HTTPException(
            status_code=400,
            detail=(
                "La bicicleta serializada no corresponde a la variante informada"
            ),
        )

    if bicicleta["id_sucursal_actual"] != id_sucursal:
        raise HTTPException(
            status_code=400,
            detail=(
                "La bicicleta serializada no pertenece a la sucursal de la venta"
            ),
        )

    if bicicleta["estado"] != "disponible":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {id_bicicleta_serializada} "
                f"no está disponible"
            ),
        )

    return bicicleta


def _validar_y_bloquear_bicicleta_serializada_para_entrega(
    conn,
    *,
    item: dict,
    venta_id: int,
):
    bicicleta_id = item.get("id_bicicleta_serializada")
    if not bicicleta_id:
        return None

    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la bicicleta serializada {bicicleta_id}"
            ),
        )

    if bicicleta["id_variante"] != item["id_variante"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no coincide con la variante del item de la venta {venta_id}"
            ),
        )

    if bicicleta["estado"] != "vendida_pendiente_entrega":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no está en estado vendida_pendiente_entrega"
            ),
        )

    return bicicleta


def _validar_y_bloquear_bicicleta_serializada_para_anulacion(
    conn,
    *,
    item: dict,
    venta_id: int,
):
    bicicleta_id = item.get("id_bicicleta_serializada")
    if not bicicleta_id:
        return None

    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la bicicleta serializada {bicicleta_id}"
            ),
        )

    if bicicleta["id_variante"] != item["id_variante"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no coincide con la variante del item de la venta {venta_id}"
            ),
        )

    if bicicleta["estado"] != "vendida_pendiente_entrega":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no está en estado vendida_pendiente_entrega"
            ),
        )

    return bicicleta



def _validar_y_bloquear_bicicleta_serializada_para_devolucion(
    conn,
    *,
    item: dict,
    venta_id: int,
):
    bicicleta_id = item.get("id_bicicleta_serializada")
    if not bicicleta_id:
        raise HTTPException(
            status_code=400,
            detail="El item indicado no tiene bicicleta serializada",
        )

    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la bicicleta serializada {bicicleta_id}",
        )

    if bicicleta["id_variante"] != item["id_variante"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no coincide con la variante del item de la venta {venta_id}"
            ),
        )

    if bicicleta["estado"] != "entregada":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no está en estado entregada"
            ),
        )

    return bicicleta

def crear_venta(data):
    conn = get_connection()

    try:
        with conn.transaction():
            if not data.items:
                raise HTTPException(
                    status_code=400,
                    detail="La venta debe tener al menos un item",
                )

            _validar_cliente(conn, data.id_cliente)
            _validar_sucursal(conn, data.id_sucursal)

            items_input = [
                {
                    "id_variante": item.id_variante,
                    "cantidad": item.cantidad,
                    "id_bicicleta_serializada": item.id_bicicleta_serializada,
                }
                for item in data.items
            ]

            items_consolidados = _consolidar_items(items_input)
            ids_unicos = list({item["id_variante"] for item in items_consolidados})
            variantes_map = _obtener_variantes_map(conn, ids_unicos)

            subtotal_total = Decimal("0")
            venta_items = []

            for item in items_consolidados:
                variante = variantes_map[item["id_variante"]]
                precio_minorista = redondear_monto(variante["precio_minorista"])
                cantidad = to_decimal(item["cantidad"])
                subtotal = redondear_monto(precio_minorista * cantidad)
                subtotal_total = redondear_monto(subtotal_total + subtotal)

                if item["id_bicicleta_serializada"] is not None:
                    _validar_y_bloquear_bicicleta_serializada_para_venta(
                        conn,
                        id_bicicleta_serializada=item["id_bicicleta_serializada"],
                        id_variante=item["id_variante"],
                        id_sucursal=data.id_sucursal,
                    )

                venta_items.append(
                    {
                        "item": item,
                        "variante": variante,
                        "cantidad": cantidad,
                        "subtotal": subtotal,
                    }
                )

            total_final = redondear_monto(subtotal_total)
            credito_aplicado = Decimal("0")

            venta_id = insert_venta(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "estado": "creada",
                    "subtotal_base": subtotal_total,
                    "descuento_total": Decimal("0"),
                    "recargo_total": Decimal("0"),
                    "total_final": total_final,
                    "saldo_pendiente": total_final,
                    "id_usuario_creador": data.id_usuario,
                    "observaciones": getattr(data, "observaciones", None),
                    "id_reserva_origen": None,
                },
            )

            for fila in venta_items:
                item = fila["item"]
                variante = fila["variante"]
                cantidad = fila["cantidad"]
                subtotal = fila["subtotal"]

                precio_minorista = redondear_monto(variante["precio_minorista"])
                costo_promedio = redondear_monto(variante["costo_promedio_vigente"] or 0)

                insert_venta_item(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_variante": variante["id"],
                        "id_bicicleta_serializada": item["id_bicicleta_serializada"],
                        "descripcion_snapshot": f"{variante['producto_nombre']} - {variante['nombre_variante']}",
                        "cantidad": cantidad,
                        "precio_lista": precio_minorista,
                        "precio_final": precio_minorista,
                        "costo_unitario_aplicado": costo_promedio,
                        "subtotal": subtotal,
                    },
                )

                if item["id_bicicleta_serializada"] is not None:
                    update_bicicleta_serializada_estado(
                        conn,
                        item["id_bicicleta_serializada"],
                        "vendida_pendiente_entrega",
                    )

            items_stock = sorted(
                [fila for fila in venta_items if fila["variante"]["stockeable"]],
                key=lambda fila: fila["variante"]["id"],
            )

            for fila in items_stock:
                item = fila["item"]
                variante = fila["variante"]

                try:
                    stock_service.marcar_stock_pendiente_entrega(
                        conn,
                        {
                            "id_sucursal": data.id_sucursal,
                            "id_variante": variante["id"],
                            "cantidad": to_decimal(item["cantidad"]),
                            "id_usuario": data.id_usuario,
                            "descontar_de_reservado": False,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                            "nota": f"Venta #{venta_id} pendiente de entrega",
                        },
                    )
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

            usar_credito = getattr(data, "usar_credito", True)
            monto_credito_a_aplicar = getattr(data, "monto_credito_a_aplicar", None)

            if usar_credito:
                resultado_credito = creditos_service.aplicar_credito_a_venta(
                    conn,
                    id_cliente=data.id_cliente,
                    id_venta=venta_id,
                    total_venta=total_final,
                    usar_credito=usar_credito,
                    monto_credito_a_aplicar=monto_credito_a_aplicar,
                    id_usuario=data.id_usuario,
                )
                credito_aplicado = redondear_monto(resultado_credito["credito_aplicado_total"])
                saldo_despues_credito = redondear_monto(total_final - credito_aplicado)

                if saldo_despues_credito == Decimal("0"):
                    estado_venta = "pagada_total"
                elif credito_aplicado > Decimal("0"):
                    estado_venta = "pagada_parcial"
                else:
                    estado_venta = "creada"

                update_venta_saldo_y_estado(
                    conn,
                    venta_id,
                    saldo_despues_credito,
                    estado_venta,
                )
            pagos = getattr(data, "pagos", []) or []

            for pago in pagos:
                pagos_service.registrar_pago(
                    conn,
                    {
                        "id_cliente": data.id_cliente,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "medio_pago": pago.medio_pago,
                        "monto": pago.monto,
                        "nota": pago.nota,
                        "id_usuario": data.id_usuario,
                    },
                )

            venta_actualizada = get_venta_for_update(conn, venta_id)
            saldo_pendiente = redondear_monto(venta_actualizada["saldo_pendiente"])

            if saldo_pendiente == Decimal("0"):
                estado_venta = "pagada_total"
            elif saldo_pendiente < total_final:
                estado_venta = "pagada_parcial"
            else:
                estado_venta = "creada"

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                saldo_pendiente,
                estado_venta,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal,
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_CREADA,
                detalle=(
                    f"Venta creada. cliente={data.id_cliente}, "
                    f"total_final={total_final}, "
                    f"credito_aplicado={credito_aplicado}, "
                    f"saldo_pendiente={saldo_pendiente}, "
                    f"estado={estado_venta}"
                ),
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": estado_venta,
            "credito_aplicado": credito_aplicado,
            "saldo_pendiente": saldo_pendiente,
        }

    finally:
        conn.close()

def listar_ventas():
    conn = get_connection()
    try:
        return get_ventas(conn)
    finally:
        conn.close()

def obtener_venta(venta_id: int):
    conn = get_connection()
    try:
        venta = get_venta_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        items = get_venta_items_by_venta_id(conn, venta_id)

        deuda_abierta = deudas_service.obtener_deuda_abierta_por_origen(
            conn,
            origen_tipo=ORIGEN_VENTA,
            origen_id=venta_id,
        )

        situacion_financiera = {
            "tiene_deuda": deuda_abierta is not None,
            "deuda_abierta": (
                {
                    "id": deuda_abierta["id"],
                    "saldo_actual": deuda_abierta["saldo_actual"],
                    "estado": deuda_abierta["estado"],
                    "origen_tipo": deuda_abierta["origen_tipo"],
                    "origen_id": deuda_abierta["origen_id"],
                }
                if deuda_abierta is not None
                else None
            ),
        }

        return {
            "venta": venta,
            "items": items,
            "situacion_financiera": situacion_financiera,
        }

    finally:
        conn.close()

def entregar_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_entregable(venta, venta_id)

            saldo_pendiente = Decimal(str(venta["saldo_pendiente"]))
            entrega_con_deuda = saldo_pendiente > 0

            if entrega_con_deuda:
                exigir_permiso_entregar_con_deuda(conn, data.id_usuario)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para entregar",
                )

            for item in items:
                if item.get("id_bicicleta_serializada") is not None:
                    bicicleta = _validar_y_bloquear_bicicleta_serializada_para_entrega(
                        conn,
                        item=item,
                        venta_id=venta_id,
                    )
                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta["id"],
                        "entregada",
                    )
                    insert_bicicleta_cliente(
                        conn,
                        {
                            "id_cliente": venta["id_cliente"],
                            "numero_cuadro": bicicleta["numero_cuadro"],
                            "notas": f"Generada desde venta #{venta_id}",
                        },
                    )

            items_stock = _ordenar_items_stockeables_por_variante(items)

            for item in items_stock:
                stock_service.registrar_entrega_stock(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": to_decimal(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                        "nota": f"Entrega de venta #{venta_id}",
                    },
                )

            update_venta_estado(conn, venta_id, VENTA_ESTADO_ENTREGADA)
            if entrega_con_deuda:
                deudas_service.crear_deuda_desde_venta_entregada(
                    conn,
                    id_cliente=venta["id_cliente"],
                    id_venta=venta_id,
                    monto_inicial=saldo_pendiente,
                    id_usuario=data.id_usuario,
                    observacion=f"Deuda creada automáticamente al entregar venta #{venta_id}",
                )
            accion_auditoria = (
                AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA
                if entrega_con_deuda
                else AUDITORIA_ACCION_VENTA_ENTREGADA
            )

            detalle_auditoria = (
                f"Venta entregada con deuda. saldo_pendiente={saldo_pendiente}"
                if entrega_con_deuda
                else "Venta entregada. estado_final=entregada"
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=accion_auditoria,
                detalle=detalle_auditoria,
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": VENTA_ESTADO_ENTREGADA,
        }

    finally:
        conn.close()


def anular_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_permiso_anular_venta(conn, data.id_usuario)
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_anulable(venta, venta_id)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para anular",
                )

            for item in items:
                if item.get("id_bicicleta_serializada") is not None:
                    bicicleta = _validar_y_bloquear_bicicleta_serializada_para_anulacion(
                        conn,
                        item=item,
                        venta_id=venta_id,
                    )
                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta["id"],
                        "disponible",
                    )

            anulacion_id = insert_venta_anulacion(
                conn,
                venta_id,
                data.motivo,
                data.id_usuario,
            )

            items_stock = _ordenar_items_stockeables_por_variante(items)

            for item in items_stock:
                stock_service.devolver_stock_a_disponible_desde_pendiente(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": to_decimal(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                        "nota": f"Liberación por anulación de venta #{venta_id}",
                    },
                )

            total_pagado = get_total_pagado_confirmado_por_venta(conn, venta_id)

            if total_pagado > 0:
                creditos_service.crear_credito_por_anulacion_venta(
                    conn,
                    id_cliente=venta["id_cliente"],
                    id_venta=venta_id,
                    monto_credito=total_pagado,
                    id_usuario=data.id_usuario,
                )

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                Decimal("0"),
                VENTA_ESTADO_ANULADA,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_ANULADA,
                detalle=(
                    f"Venta anulada. anulacion_id={anulacion_id}, "
                    f"motivo={data.motivo}, "
                    f"total_pagado={total_pagado}, "
                    f"credito_generado={'si' if total_pagado > 0 else 'no'}"
                ),
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": VENTA_ESTADO_ANULADA,
            "anulacion_id": anulacion_id,
            "credito_generado": total_pagado > 0,
            "monto_credito": total_pagado,
        }

    finally:
        conn.close()


def _ordenar_items_stockeables_por_variante(items: list[dict]) -> list[dict]:
    return sorted(
        [item for item in items if item.get("stockeable", True)],
        key=lambda item: item["id_variante"],
    )



def devolver_item_serializado_entregado(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)

            if venta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la venta {venta_id}",
                )

            if venta["estado"] != VENTA_ESTADO_ENTREGADA:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"La venta {venta_id} no está entregada. "
                        f"Estado actual: {venta['estado']}"
                    ),
                )

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items",
                )

            item_objetivo = None
            for item in items:
                if item.get("id_bicicleta_serializada") == data.id_bicicleta_serializada:
                    item_objetivo = item
                    break

            if item_objetivo is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"La bicicleta serializada {data.id_bicicleta_serializada} "
                        f"no pertenece a la venta {venta_id}"
                    ),
                )

            devolucion_existente = get_venta_devolucion_by_venta_item_id(
                conn,
                item_objetivo["id"],
            )
            if devolucion_existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El item {item_objetivo['id']} de la venta {venta_id} "
                        f"ya fue devuelto"
                    ),
                )

            bicicleta = _validar_y_bloquear_bicicleta_serializada_para_devolucion(
                conn,
                item=item_objetivo,
                venta_id=venta_id,
            )

            devolucion_id = insert_venta_devolucion(
                conn,
                {
                    "id_venta": venta_id,
                    "id_venta_item": item_objetivo["id"],
                    "id_bicicleta_serializada": bicicleta["id"],
                    "id_sucursal_reingreso": venta["id_sucursal"],
                    "motivo": data.motivo,
                    "id_usuario": data.id_usuario,
                },
            )

            update_bicicleta_serializada_estado(
                conn,
                bicicleta["id"],
                "disponible",
            )

            stock_service.registrar_devolucion_stock(
                conn,
                {
                    "id_sucursal": venta["id_sucursal"],
                    "id_variante": item_objetivo["id_variante"],
                    "cantidad": 1,
                    "id_usuario": data.id_usuario,
                    "origen_tipo": "venta",
                    "origen_id": venta_id,
                    "id_bicicleta_serializada": bicicleta["id"],  # ← AGREGAR
                    "nota": (
                        f"Devolución de bicicleta serializada "
                        f"desde venta #{venta_id}. "
                        f"devolucion_id={devolucion_id}. "
                        f"motivo={data.motivo}"
                    ),
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA,
                detalle=(
                    f"Devolución de bicicleta serializada. "
                    f"venta_id={venta_id}, "
                    f"devolucion_id={devolucion_id}, "
                    f"venta_item_id={item_objetivo['id']}, "
                    f"id_bicicleta_serializada={bicicleta['id']}, "
                    f"numero_cuadro={bicicleta['numero_cuadro']}, "
                    f"motivo={data.motivo}"
                ),
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "devolucion_id": devolucion_id,
            "id_bicicleta_serializada": bicicleta["id"],
            "estado_bicicleta": "disponible",
        }

    finally:
        conn.close()

def devolver_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)

            if not venta:
                raise HTTPException(status_code=404, detail="Venta no encontrada")

            if venta["estado"] != "entregada":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden devolver ventas entregadas",
                )

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail="La venta no tiene items",
                )

            total_devolucion = Decimal("0")

            for item in items:
                cantidad = to_decimal(item["cantidad"])

                if item["id_bicicleta_serializada"]:
                    update_bicicleta_serializada_estado(
                        conn,
                        item["id_bicicleta_serializada"],
                        "disponible",
                    )

                if item["stockeable"]:
                    stock_service.registrar_devolucion_stock(
                        conn,
                        {
                            "id_sucursal": venta["id_sucursal"],
                            "id_variante": item["id_variante"],
                            "cantidad": cantidad,
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "nota": f"Devolución venta #{venta_id}",
                        },
                    )

                total_devolucion += to_decimal(item["subtotal"])

            # generar crédito
            creditos_service.crear_credito_por_anulacion_venta(
                conn,
                id_cliente=venta["id_cliente"],
                id_venta=venta_id,
                monto_credito=total_devolucion,
                id_usuario=data.id_usuario,
            )

            # actualizar estado
            update_venta_saldo_y_estado(
                conn,
                venta_id,
                Decimal("0"),
                "devuelta",
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion="devolucion_venta",
                detalle=f"Venta devuelta total. monto={total_devolucion}",
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "credito_generado": total_devolucion,
        }

    finally:
        conn.close()

def devolver_items(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)

            if not venta:
                raise HTTPException(status_code=404, detail="Venta no encontrada")

            if venta["estado"] != VENTA_ESTADO_ENTREGADA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden devolver items de ventas entregadas",
                )

            if not data.items:
                raise HTTPException(
                    status_code=400,
                    detail="Debe informar al menos un item a devolver",
                )

            items_db = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items_db:
                raise HTTPException(
                    status_code=400,
                    detail="La venta no tiene items",
                )

            items_map = {item["id"]: item for item in items_db}
            total_devolucion = Decimal("0")
            devoluciones_ids = []

            for item_input in data.items:
                item = items_map.get(item_input.id_venta_item)

                if not item:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El item {item_input.id_venta_item} no pertenece a la venta {venta_id}",
                    )

                cantidad_devuelta = to_decimal(item_input.cantidad)
                cantidad_original = to_decimal(item["cantidad"])
                cantidad_ya_devuelta = to_decimal(
                    get_total_devuelto_by_venta_item_id(conn, item["id"])
                )

                cantidad_disponible_para_devolver = cantidad_original - cantidad_ya_devuelta

                if cantidad_devuelta <= Decimal("0"):
                    raise HTTPException(
                        status_code=400,
                        detail="La cantidad a devolver debe ser mayor a 0",
                    )

                if cantidad_devuelta > cantidad_disponible_para_devolver:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La cantidad a devolver del item {item['id']} supera "
                            f"lo disponible. vendido={cantidad_original}, "
                            f"ya_devuelto={cantidad_ya_devuelta}, "
                            f"disponible={cantidad_disponible_para_devolver}"
                        ),
                    )

                if item.get("id_bicicleta_serializada") is not None:
                    if cantidad_devuelta != Decimal("1"):
                        raise HTTPException(
                            status_code=400,
                            detail="Un item serializado solo puede devolverse con cantidad 1",
                        )

                    bicicleta = _validar_y_bloquear_bicicleta_serializada_para_devolucion(
                        conn,
                        item=item,
                        venta_id=venta_id,
                    )

                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta["id"],
                        "disponible",
                    )

                    # Mantiene trazabilidad serializada existente.
                    insert_venta_devolucion(
                        conn,
                        {
                            "id_venta": venta_id,
                            "id_venta_item": item["id"],
                            "id_bicicleta_serializada": bicicleta["id"],
                            "id_sucursal_reingreso": venta["id_sucursal"],
                            "motivo": data.motivo,
                            "id_usuario": data.id_usuario,
                        },
                    )

                subtotal_item = to_decimal(item["subtotal"])
                monto_item = redondear_monto(
                    subtotal_item * cantidad_devuelta / cantidad_original
                )

                devolucion_id = insert_venta_item_devolucion(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_venta_item": item["id"],
                        "id_variante": item["id_variante"],
                        "cantidad_devuelta": cantidad_devuelta,
                        "monto_credito_generado": monto_item,
                        "motivo": data.motivo,
                        "id_usuario": data.id_usuario,
                    },
                )
                devoluciones_ids.append(devolucion_id)

                if item["stockeable"]:
                    stock_service.registrar_devolucion_stock(
                        conn,
                        {
                            "id_sucursal": venta["id_sucursal"],
                            "id_variante": item["id_variante"],
                            "cantidad": cantidad_devuelta,
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                            "nota": (
                                f"Devolución parcial venta #{venta_id}. "
                                f"venta_item_id={item['id']}. "
                                f"devolucion_item_id={devolucion_id}. "
                                f"motivo={data.motivo}"
                            ),
                        },
                    )

                total_devolucion = redondear_monto(total_devolucion + monto_item)

            if total_devolucion <= Decimal("0"):
                raise HTTPException(
                    status_code=400,
                    detail="El monto total de devolución debe ser mayor a 0",
                )

            creditos_service.crear_credito_por_devolucion_venta(
                conn,
                id_cliente=venta["id_cliente"],
                id_venta=venta_id,
                monto_credito=total_devolucion,
                id_usuario=data.id_usuario,
            )

            items_actualizados = get_venta_items_detallados_by_venta_id(conn, venta_id)

            venta_totalmente_devuelta = True
            for item in items_actualizados:
                cantidad_original = to_decimal(item["cantidad"])
                cantidad_devuelta_total = to_decimal(
                    get_total_devuelto_by_venta_item_id(conn, item["id"])
                )

                if cantidad_devuelta_total < cantidad_original:
                    venta_totalmente_devuelta = False
                    break

            nuevo_estado = (
                "devuelta"
                if venta_totalmente_devuelta
                else "devuelta_parcial"
            )

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                Decimal("0"),
                nuevo_estado,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA,
                detalle=(
                    f"Devolución parcial registrada. "
                    f"venta_id={venta_id}, "
                    f"devoluciones_ids={devoluciones_ids}, "
                    f"monto={total_devolucion}, "
                    f"estado_final={nuevo_estado}, "
                    f"motivo={data.motivo}"
                ),
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "credito_generado": total_devolucion,
        }

    finally:
        conn.close()