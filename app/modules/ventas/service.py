from decimal import Decimal
from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    get_cliente_by_id,
    get_sucursal_by_id,
    get_variantes_by_ids,
    get_stock_for_update,
    insert_venta,
    insert_venta_item,
    mover_a_vendido_pendiente_entrega,
    registrar_entrega_stock,
    liberar_vendido_pendiente_entrega,
    insert_movimiento_venta,
    insert_movimiento_entrega,
    get_ventas,
    get_venta_by_id,
    get_venta_items_by_venta_id,
    get_venta_for_update,
    update_venta_estado,
    insert_venta_anulacion,
    insert_movimiento_anulacion_venta,
)


def _consolidar_items(items):
    consolidados = {}

    for item in items:
        if item.cantidad <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"La cantidad debe ser mayor a 0 para la variante {item.id_variante}",
            )

        if item.id_variante not in consolidados:
            consolidados[item.id_variante] = {
                "id_variante": item.id_variante,
                "cantidad": Decimal(str(item.cantidad)),
            }
        else:
            consolidados[item.id_variante]["cantidad"] += Decimal(str(item.cantidad))

    return list(consolidados.values())


def _calcular_disponible(stock):
    return (
        stock["stock_fisico"]
        - stock["stock_reservado"]
        - stock["stock_vendido_pendiente_entrega"]
    )


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

    if venta["estado"] != "creada":
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
                subtotal = variante["precio_minorista"] * item["cantidad"]
                subtotal_total += subtotal

                venta_items.append(
                    {
                        "item": item,
                        "variante": variante,
                        "subtotal": subtotal,
                    }
                )

            venta_id = insert_venta(conn, data, subtotal_total, data.id_usuario)

            for fila in venta_items:
                item = fila["item"]
                variante = fila["variante"]
                subtotal = fila["subtotal"]

                if variante["stockeable"]:
                    stock = get_stock_for_update(
                        conn,
                        data.id_sucursal,
                        variante["id"],
                    )

                    if stock is None:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"No existe stock cargado para la variante {variante['id']} "
                                f"en la sucursal {data.id_sucursal}"
                            ),
                        )

                    disponible = _calcular_disponible(stock)

                    if disponible < item["cantidad"]:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stock insuficiente para la variante {variante['id']}",
                        )

                insert_venta_item(
                    conn,
                    venta_id,
                    item,
                    variante,
                    subtotal,
                )

                if variante["stockeable"]:
                    stock = get_stock_for_update(
                        conn,
                        data.id_sucursal,
                        variante["id"],
                    )

                    mover_a_vendido_pendiente_entrega(
                        conn,
                        stock["id"],
                        item["cantidad"],
                    )

                    insert_movimiento_venta(
                        conn,
                        {
                            "id_sucursal": data.id_sucursal,
                            "id_variante": variante["id"],
                            "cantidad": item["cantidad"],
                            "venta_id": venta_id,
                            "costo_unitario_aplicado": variante["costo_promedio_vigente"],
                            "nota": f"Venta #{venta_id} pendiente de entrega",
                            "id_usuario": data.id_usuario,
                        },
                    )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "creada",
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

            if venta["saldo_pendiente"] > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} tiene saldo pendiente y no se puede entregar",
                )

            items = get_venta_items_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para entregar",
                )

            for item in items:
                stock = get_stock_for_update(
                    conn,
                    venta["id_sucursal"],
                    item["id_variante"],
                )

                if stock is None:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"No existe stock cargado para la variante {item['id_variante']} "
                            f"en la sucursal {venta['id_sucursal']}"
                        ),
                    )

                if stock["stock_vendido_pendiente_entrega"] < item["cantidad"]:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La variante {item['id_variante']} no tiene suficiente stock "
                            "vendido pendiente de entrega"
                        ),
                    )

                if stock["stock_fisico"] < item["cantidad"]:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La variante {item['id_variante']} no tiene suficiente stock físico "
                            "para concretar la entrega"
                        ),
                    )

                registrar_entrega_stock(
                    conn,
                    stock["id"],
                    item["cantidad"],
                )

                insert_movimiento_entrega(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "venta_id": venta_id,
                        "costo_unitario_aplicado": item["costo_unitario_aplicado"],
                        "nota": f"Entrega de venta #{venta_id}",
                        "id_usuario": data.id_usuario,
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

            items = get_venta_items_by_venta_id(conn, venta_id)

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
                stock = get_stock_for_update(
                    conn,
                    venta["id_sucursal"],
                    item["id_variante"],
                )

                if stock is None:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"No existe stock cargado para la variante {item['id_variante']} "
                            f"en la sucursal {venta['id_sucursal']}"
                        ),
                    )

                if stock["stock_vendido_pendiente_entrega"] < item["cantidad"]:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La variante {item['id_variante']} no tiene suficiente stock "
                            "vendido pendiente para anular la venta"
                        ),
                    )

                liberar_vendido_pendiente_entrega(
                    conn,
                    stock["id"],
                    item["cantidad"],
                )

                insert_movimiento_anulacion_venta(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "costo_unitario_aplicado": item["costo_unitario_aplicado"],
                        "venta_id": venta_id,
                        "nota": f"Liberación por anulación de venta #{venta_id}",
                        "id_usuario": data.id_usuario,
                    },
                )

            update_venta_estado(conn, venta_id, "anulada")

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "anulada",
            "anulacion_id": anulacion_id,
        }

    finally:
        conn.close()