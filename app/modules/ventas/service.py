from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.stock import service as stock_service
from app.modules.creditos import service as creditos_service
from app.modules.pagos.repository import get_total_pagado_confirmado_por_venta
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
)


def _consolidar_items(items):
    consolidados = {}

    for item in items:
        id_variante = item["id_variante"]
        cantidad = Decimal(str(item["cantidad"]))

        if cantidad <= 0:
            raise HTTPException(
                status_code=400,
                detail="La cantidad debe ser mayor a 0",
            )

        if id_variante not in consolidados:
            consolidados[id_variante] = {
                "id_variante": id_variante,
                "cantidad": cantidad,
            }
        else:
            consolidados[id_variante]["cantidad"] += cantidad

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

    if Decimal(str(venta["saldo_pendiente"])) > 0:
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} tiene saldo pendiente y no se puede entregar",
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

            items_consolidados = _consolidar_items(data.items)
            ids_unicos = [item["id_variante"] for item in items_consolidados]
            variantes_map = _obtener_variantes_map(conn, ids_unicos)

            subtotal_total = Decimal("0")
            venta_items = []

            for item in items_consolidados:
                variante = variantes_map[item["id_variante"]]
                precio_minorista = Decimal(str(variante["precio_minorista"]))
                subtotal = precio_minorista * item["cantidad"]
                subtotal_total += subtotal

                venta_items.append(
                    {
                        "item": item,
                        "variante": variante,
                        "subtotal": subtotal,
                    }
                )

            total_final = subtotal_total
            saldo_pendiente = total_final
            estado_venta = "creada"
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
                    "saldo_pendiente": saldo_pendiente,
                    "id_usuario_creador": data.id_usuario,
                    "observaciones": getattr(data, "observaciones", None),
                    "id_reserva_origen": None,
                },
            )

            for fila in venta_items:
                item = fila["item"]
                variante = fila["variante"]
                subtotal = fila["subtotal"]

                precio_minorista = Decimal(str(variante["precio_minorista"]))
                costo_promedio = Decimal(str(variante["costo_promedio_vigente"] or 0))

                insert_venta_item(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_variante": variante["id"],
                        "id_bicicleta_serializada": None,
                        "descripcion_snapshot": f"{variante['producto_nombre']} - {variante['nombre_variante']}",
                        "cantidad": item["cantidad"],
                        "precio_lista": precio_minorista,
                        "precio_final": precio_minorista,
                        "costo_unitario_aplicado": costo_promedio,
                        "subtotal": subtotal,
                    },
                )

                if variante["stockeable"]:
                    try:
                        stock_service.marcar_stock_pendiente_entrega(
                            conn,
                            {
                                "id_sucursal": data.id_sucursal,
                                "id_variante": variante["id"],
                                "cantidad": float(item["cantidad"]),
                                "id_usuario": data.id_usuario,
                                "descontar_de_reservado": False,
                                "origen_tipo": "venta",
                                "origen_id": venta_id,
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
                credito_aplicado = Decimal(
                    str(resultado_credito["credito_aplicado_total"])
                )

            saldo_pendiente = total_final - credito_aplicado

            if saldo_pendiente == Decimal("0"):
                estado_venta = "pagada_total"
            elif credito_aplicado > Decimal("0"):
                estado_venta = "pagada_parcial"
            else:
                estado_venta = "creada"

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                saldo_pendiente,
                estado_venta,
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

        return {
            "venta": venta,
            "items": items,
        }
    finally:
        conn.close()


def entregar_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_entregable(venta, venta_id)

            if Decimal(str(venta["saldo_pendiente"])) > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} tiene saldo pendiente y no se puede entregar",
                )

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para entregar",
                )

            for item in items:
                if not item["stockeable"]:
                    continue

                stock_service.registrar_entrega_stock(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": float(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "nota": f"Entrega de venta #{venta_id}",
                    },
                )

            update_venta_estado(conn, venta_id, "entregada")

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "entregada",
        }

    finally:
        conn.close()


def anular_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_anulable(venta, venta_id)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para anular",
                )

            anulacion_id = insert_venta_anulacion(
                conn,
                venta_id,
                data.motivo,
                data.id_usuario,
            )

            for item in items:
                if not item["stockeable"]:
                    continue

                stock_service.devolver_stock_a_disponible_desde_pendiente(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": float(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
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

            update_venta_saldo_y_estado(conn, venta_id, Decimal("0"), "anulada")

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "anulada",
            "anulacion_id": anulacion_id,
            "credito_generado": total_pagado > 0,
            "monto_credito": total_pagado,
        }

    finally:
        conn.close()